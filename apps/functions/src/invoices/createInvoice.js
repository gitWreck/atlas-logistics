const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { writeInvoiceActionLog } = require("../utilities/invoiceLogger");
const { updatedBy } = require("../utilities/helpers");
const { canAccessRecord } = require("../manager/managerAccess");
const { formatAddress } = require("../utilities/addressHelpers");
const {
  applyInvoiceToPackages,
  inferredInvoicePackageIds,
  invoicePackageIds,
  invoiceTripId,
  isActiveInvoice,
  isLegacyWholeShipmentInvoice,
  packageBelongsToTrip,
  packageIdFor,
  packageLineItem,
  packageReservationId,
  shipmentInvoicingSummary,
} = require("./packageInvoiceScope.cjs");
const { Timestamp } = admin.firestore;

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const ALLOWED_STATUSES = new Set(["DRAFT", "ISSUED"]);

function manifestPackageIds(manifest = {}) {
  return [
    ...(Array.isArray(manifest.packageBarcodes) ? manifest.packageBarcodes : []),
    ...(Array.isArray(manifest.loadedPackageIds) ? manifest.loadedPackageIds : []),
  ];
}

exports.createInvoice = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const {
      shipmentId,
      invoiceDate,
      dueDate,
      billingName,
      billingAddress,
      senderName,
      amount,
      notes,
      status,
      truckTripId,
      tripId,
    } = request.data || {};

    const { uid, role, name } = updatedBy(request);
    const requestedTripId = String(truckTripId || tripId || "").trim();

    if (!shipmentId) {
      throw new HttpsError("invalid-argument", "Missing shipmentId.");
    }
    if (!requestedTripId) {
      throw new HttpsError(
        "invalid-argument",
        "Select a trip before creating the invoice.",
      );
    }
    if (amount === undefined || isNaN(Number(amount))) {
      throw new HttpsError("invalid-argument", "Invalid amount.");
    }

    const actorDoc = await db.collection("users").doc(request.auth.uid).get();
    const actorProfile = actorDoc.exists ? actorDoc.data() : null;
    const actorRole = String(actorProfile?.role || "").toLowerCase();
    if (!["admin", "manager"].includes(actorRole)) {
      throw new HttpsError(
        "permission-denied",
        "Only an Admin or Manager can create invoices.",
      );
    }

    const now = Timestamp.now();
    const nowAt = admin.firestore.FieldValue.serverTimestamp();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const invoiceNumber = `INV-${dateStr}-${Date.now().toString().slice(-6)}`;
    const invoiceRef = db.collection("invoices").doc(invoiceNumber);
    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const tripRef = db.collection("truck_trips").doc(requestedTripId);
    const tripShipmentRef = tripRef.collection("trip_shipments").doc(shipmentId);

    try {
      const result = await db.runTransaction(async (transaction) => {
        const [
          shipmentDoc,
          tripDoc,
          tripShipmentDoc,
          shipmentInvoices,
          collisionCheck,
        ] = await Promise.all([
          transaction.get(shipmentRef),
          transaction.get(tripRef),
          transaction.get(tripShipmentRef),
          transaction.get(
            db.collection("invoices").where("shipmentId", "==", shipmentId),
          ),
          transaction.get(invoiceRef),
        ]);

        if (!shipmentDoc.exists) {
          throw new HttpsError("not-found", "Shipment not found.");
        }
        if (!tripDoc.exists) {
          throw new HttpsError("not-found", "Trip not found.");
        }
        if (!tripShipmentDoc.exists) {
          throw new HttpsError(
            "failed-precondition",
            "The selected shipment does not belong to the selected trip.",
          );
        }
        if (collisionCheck.exists) {
          throw new HttpsError("already-exists", "Invoice ID collision.");
        }

        const shipmentData = shipmentDoc.data() || {};
        const tripShipment = tripShipmentDoc.data() || {};
        if (
          actorRole === "manager" &&
          !canAccessRecord(actorProfile, shipmentData)
        ) {
          throw new HttpsError(
            "permission-denied",
            "This shipment is outside your assigned scope.",
          );
        }

        const packages = Array.isArray(shipmentData.packages)
          ? shipmentData.packages
          : [];
        const loadedPackages = packages.filter((pkg) =>
          packageBelongsToTrip(
            pkg,
            requestedTripId,
            manifestPackageIds(tripShipment),
          ),
        );

        if (loadedPackages.length === 0) {
          throw new HttpsError(
            "failed-precondition",
            "No scanned and loaded packages are available to invoice on this trip.",
          );
        }

        const activeInvoices = shipmentInvoices.docs
          .map((document) => ({ id: document.id, ...(document.data() || {}) }))
          .filter(isActiveInvoice);

        const legacyInvoices = activeInvoices.filter(isLegacyWholeShipmentInvoice);
        const legacyWithoutTrip = legacyInvoices.find(
          (invoice) => !invoiceTripId(invoice),
        );
        if (legacyWithoutTrip) {
          throw new HttpsError(
            "already-exists",
            "A legacy whole-shipment invoice has no trip reference and cannot be safely split by package.",
          );
        }

        const legacyTripIds = [
          ...new Set(legacyInvoices.map(invoiceTripId).filter(Boolean)),
        ];
        const legacyManifestEntries = await Promise.all(
          legacyTripIds.map(async (legacyTripId) => {
            if (legacyTripId === requestedTripId) {
              return [legacyTripId, tripShipment];
            }
            const snapshot = await transaction.get(
              db
                .collection("truck_trips")
                .doc(legacyTripId)
                .collection("trip_shipments")
                .doc(shipmentId),
            );
            return [legacyTripId, snapshot.exists ? snapshot.data() || {} : {}];
          }),
        );
        const legacyManifests = new Map(legacyManifestEntries);
        const legacyInvoiceMigrations = legacyInvoices.map((invoice) => {
          const legacyTripId = invoiceTripId(invoice);
          const inferredPackageIds = inferredInvoicePackageIds(
            invoice,
            packages,
            manifestPackageIds(legacyManifests.get(legacyTripId) || {}),
          );
          const inferredIdSet = new Set(inferredPackageIds);
          return {
            invoice,
            tripId: legacyTripId,
            packageIds: inferredPackageIds,
            packages: packages.filter((pkg) =>
              inferredIdSet.has(packageIdFor(pkg)),
            ),
          };
        });
        if (legacyInvoiceMigrations.some((migration) => migration.packageIds.length === 0)) {
          throw new HttpsError(
            "already-exists",
            "A legacy invoice could not be matched to its trip packages. Update its package scope before creating another invoice.",
          );
        }

        const resolvedActiveInvoices = activeInvoices.map((invoice) => {
          const migration = legacyInvoiceMigrations.find(
            (item) => item.invoice.id === invoice.id,
          );
          return migration
            ? { ...invoice, packageIds: migration.packageIds }
            : invoice;
        });

        const activeInvoicePackageIds = resolvedActiveInvoices.flatMap(
          invoicePackageIds,
        );
        const invoicedPackageIds = new Set(activeInvoicePackageIds);
        if (invoicedPackageIds.size !== activeInvoicePackageIds.length) {
          throw new HttpsError(
            "failed-precondition",
            "Existing invoices overlap on one or more package IDs. Correct the invoice package scopes before continuing.",
          );
        }
        const invoicePackages = loadedPackages.filter(
          (pkg) => !invoicedPackageIds.has(packageIdFor(pkg)),
        );

        if (invoicePackages.length === 0) {
          throw new HttpsError(
            "already-exists",
            "Every package loaded on this trip already has an active invoice.",
          );
        }

        const packageIds = invoicePackages.map(packageIdFor).filter(Boolean);
        if (new Set(packageIds).size !== packageIds.length) {
          throw new HttpsError(
            "failed-precondition",
            "Loaded packages must have unique package IDs before invoicing.",
          );
        }
        const reservationRefs = packageIds.map((packageId) =>
          db
            .collection("packageInvoiceReservations")
            .doc(packageReservationId(shipmentId, packageId)),
        );
        const reservationSnapshots = await Promise.all(
          reservationRefs.map((reference) => transaction.get(reference)),
        );
        if (reservationSnapshots.some((snapshot) => snapshot.exists)) {
          throw new HttpsError(
            "already-exists",
            "One or more packages were already invoiced. Refresh and try again.",
          );
        }

        const requestedBillingName = String(billingName || "").trim();
        const shipmentRecipientName = String(
          shipmentData?.recipient?.name || shipmentData?.recipientName || "",
        ).trim();
        const resolvedBillingName =
          requestedBillingName || shipmentRecipientName || "Unknown Recipient";
        const finalSenderName =
          String(senderName || "").trim().slice(0, 500) ||
          shipmentData?.sender?.name ||
          shipmentData?.senderName ||
          "Unknown Sender";
        const finalSenderPhone =
          shipmentData?.sender?.phone || shipmentData?.senderPhone || "";
        const finalRecipientName =
          shipmentData?.recipient?.name || shipmentData?.recipientName || "";
        const finalRecipientPhone =
          shipmentData?.recipient?.phone || shipmentData?.recipientPhone || "";
        const finalOrigin = shipmentData?.origin || "";
        const finalDestination = shipmentData?.destination || "";
        const finalRouteLabel = `${finalOrigin || "Unknown"} -> ${finalDestination || "Unknown"}`;
        const finalBillingAddress =
          String(billingAddress || "").trim() ||
          shipmentData?.sender?.formattedAddress ||
          formatAddress(
            shipmentData?.sender?.address || shipmentData?.sender?.details || {},
          );
        const finalTrackingNumber =
          shipmentData?.trackingNumber || shipmentData?.shipmentId || shipmentId;
        const finalShipmentStatus = shipmentData?.status || "";
        const finalAmount = Number(amount) || 0;
        const finalStatus = ALLOWED_STATUSES.has(status) ? status : "DRAFT";
        const packageLineItems = invoicePackages.map((pkg) =>
          packageLineItem(pkg, requestedTripId),
        );
        const finalTotalPackages = packageLineItems.length;
        const finalTotalItems = packageLineItems.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0,
        );
        const scopedPackages = invoicePackages.map((pkg) => ({
          ...pkg,
          invoicedTripId: requestedTripId,
        }));
        const finalShipmentSnapshot = {
          id: shipmentId,
          shipmentId: finalTrackingNumber,
          sender: shipmentData?.sender || null,
          recipient: shipmentData?.recipient || null,
          origin: shipmentData?.origin || null,
          destination: shipmentData?.destination || null,
          totals: {
            totalPackages: finalTotalPackages,
            totalItems: finalTotalItems,
            totalContentQty: finalTotalItems,
          },
          packages: scopedPackages,
          status: shipmentData?.status || null,
          currentTripId: requestedTripId,
        };
        let packagesWithExistingInvoices = packages;
        legacyInvoiceMigrations.forEach((migration) => {
          packagesWithExistingInvoices = applyInvoiceToPackages(
            packagesWithExistingInvoices,
            migration.packageIds,
            {
              invoiceId: migration.invoice.id,
              invoiceNumber:
                migration.invoice.invoiceNumber || migration.invoice.id,
              invoiceStatus: migration.invoice.status || "DRAFT",
              tripId: migration.tripId,
            },
          );
        });
        const updatedPackages = applyInvoiceToPackages(
          packagesWithExistingInvoices,
          packageIds,
          {
          invoiceId: invoiceRef.id,
          invoiceNumber,
          invoiceStatus: finalStatus,
          tripId: requestedTripId,
          },
        );
        const invoicingSummary = shipmentInvoicingSummary(updatedPackages);

        legacyInvoiceMigrations.forEach((migration) => {
          const migratedLineItems = migration.packages.map((pkg) =>
            packageLineItem(pkg, migration.tripId),
          );
          const migratedTotalItems = migratedLineItems.reduce(
            (sum, item) => sum + Number(item.quantity || 0),
            0,
          );
          transaction.set(
            db.collection("invoices").doc(migration.invoice.id),
            {
              packageIds: migration.packageIds,
              packageAssignmentIds: migratedLineItems.map(
                (item) => item.tripPackageAssignmentId,
              ),
              packageLineItems: migratedLineItems,
              totalPackages: migratedLineItems.length,
              totalItems: migratedTotalItems,
              shipmentSnapshot: {
                ...(migration.invoice.shipmentSnapshot || {}),
                packages: migration.packages.map((pkg) => ({
                  ...pkg,
                  invoicedTripId: migration.tripId,
                })),
                totals: {
                  totalPackages: migratedLineItems.length,
                  totalItems: migratedTotalItems,
                  totalContentQty: migratedTotalItems,
                },
                currentTripId: migration.tripId,
              },
              packageScopeMigrationVersion: 1,
              packageScopeMigratedAt: now,
            },
            { merge: true },
          );
        });

        transaction.set(invoiceRef, {
          invoiceNumber,
          shipmentId,
          shipmentTrackingNumber: finalTrackingNumber,
          billingName: resolvedBillingName,
          billingAddress: finalBillingAddress,
          senderName: finalSenderName,
          senderPhone: finalSenderPhone,
          recipientName: finalRecipientName,
          recipientPhone: finalRecipientPhone,
          origin: finalOrigin,
          destination: finalDestination,
          routeLabel: finalRouteLabel,
          shipmentStatus: finalShipmentStatus,
          tripId: requestedTripId,
          packageIds,
          packageAssignmentIds: packageLineItems.map(
            (item) => item.tripPackageAssignmentId,
          ),
          packageLineItems,
          totalPackages: finalTotalPackages,
          totalItems: finalTotalItems,
          amount: finalAmount,
          notes: notes || "",
          status: finalStatus,
          financeSourceVersion: 1,
          invoiceDate: invoiceDate || null,
          dueDate: dueDate || null,
          shipmentSnapshot: finalShipmentSnapshot,
          createdAt: nowAt,
          updatedAt: nowAt,
          createdBy: name,
          updatedBy: name,
        });

        transaction.set(
          shipmentRef,
          {
            packages: updatedPackages,
            ...invoicingSummary,
            invoiceId: invoiceRef.id,
            invoiceNumber,
            invoiceStatus: finalStatus,
            hasInvoice: true,
            updatedAt: nowAt,
            updatedBy: name,
          },
          { merge: true },
        );

        reservationRefs.forEach((reference, index) => {
          transaction.create(reference, {
            shipmentId,
            packageId: packageIds[index],
            tripId: requestedTripId,
            invoiceId: invoiceRef.id,
            invoiceNumber,
            createdAt: now,
          });
        });

        writeInvoiceActionLog({
          db,
          batch: transaction,
          action: "CREATE_INVOICE",
          invoiceId: invoiceRef.id,
          invoiceDocId: invoiceRef.id,
          invoiceNumber,
          shipmentId,
          tripId: requestedTripId,
          actorId: uid,
          actorName: name,
          actorRole: role,
          details: {
            amount: finalAmount,
            status: finalStatus,
            packageIds,
            packageCount: packageIds.length,
          },
          createdAt: nowAt,
        });

        transaction.set(db.collection("invoice_events").doc(), {
          invoiceId: invoiceRef.id,
          invoiceNumber,
          shipmentId,
          tripId: requestedTripId,
          packageIds,
          type: "INVOICE_CREATED",
          status: finalStatus,
          actorId: uid,
          at: now,
          note: `Invoice ${invoiceNumber} created for ${packageIds.length} package(s) on trip ${requestedTripId}`,
        });

        return { packageIds };
      });

      return {
        success: true,
        invoiceId: invoiceRef.id,
        invoiceNumber,
        tripId: requestedTripId,
        packageIds: result.packageIds,
      };
    } catch (error) {
      console.error("Invoice creation failed:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Failed to create invoice.");
    }
  },
);
