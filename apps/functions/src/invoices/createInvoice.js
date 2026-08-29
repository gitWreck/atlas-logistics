const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { writeInvoiceActionLog } = require("../utilities/invoiceLogger");
const { updatedBy } = require("../utilities/helpers");
const { canAccessRecord } = require("../manager/managerAccess");
const { formatAddress } = require("../utilities/addressHelpers");
const { Timestamp } = admin.firestore;

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const ALLOWED_STATUSES = new Set(["DRAFT", "ISSUED"]);

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

    if (!shipmentId) {
      throw new HttpsError("invalid-argument", "Missing shipmentId.");
    }

    if (amount === undefined || isNaN(Number(amount))) {
      throw new HttpsError("invalid-argument", "Invalid amount.");
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const shipmentDoc = await shipmentRef.get();

    if (!shipmentDoc.exists) {
      throw new HttpsError("not-found", "Shipment not found.");
    }

    const shipmentData = shipmentDoc.data();
    const requestedBillingName = String(billingName || "").trim();
    const shipmentRecipientName = String(
      shipmentData?.recipient?.name || shipmentData?.recipientName || "",
    ).trim();
    const resolvedBillingName =
      requestedBillingName || shipmentRecipientName || "Unknown Recipient";

    const requestedTripId = String(truckTripId || tripId || "").trim();

    if (requestedTripId) {
      const activeTripIds = new Set(
        [
          shipmentData.currentTripId,
          shipmentData.currentTruckTripId,
          shipmentData.truckTripId,
          ...(Array.isArray(shipmentData.currentTripIds)
            ? shipmentData.currentTripIds
            : []),
        ]
          .filter(Boolean)
          .map(String),
      );

      if (!activeTripIds.has(requestedTripId)) {
        const manifestShipmentDoc = await db
          .collection("truck_trips")
          .doc(requestedTripId)
          .collection("trip_shipments")
          .doc(shipmentId)
          .get();

        if (!manifestShipmentDoc.exists) {
          throw new HttpsError(
            "failed-precondition",
            "The selected shipment does not belong to the selected trip.",
          );
        }
      }
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
    if (actorRole === "manager" && !canAccessRecord(actorProfile, shipmentData)) {
      throw new HttpsError(
        "permission-denied",
        "This shipment is outside your assigned scope.",
      );
    }

    const existingInvoices = await db
      .collection("invoices")
      .where("shipmentId", "==", shipmentId)
      .get();

    const hasActiveInvoice = existingInvoices.docs.some((doc) => {
      const invoiceStatus = doc.data()?.status || "DRAFT";
      return invoiceStatus !== "CANCELLED";
    });

    if (hasActiveInvoice) {
      throw new HttpsError(
        "already-exists",
        "An active invoice already exists for this shipment.",
      );
    }

    const now = Timestamp.now();
    const nowAt = admin.firestore.FieldValue.serverTimestamp();

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const invoiceNumber = `INV-${dateStr}-${Date.now().toString().slice(-6)}`;

    const invoiceRef = db.collection("invoices").doc(invoiceNumber);
    const collisionCheck = await invoiceRef.get();

    if (collisionCheck.exists) {
      throw new HttpsError("already-exists", "Invoice ID collision.");
    }

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
    const finalRouteLabel = `${finalOrigin || "Unknown"} → ${finalDestination || "Unknown"}`;

    const finalBillingName = resolvedBillingName;
    const finalBillingAddress =
      String(billingAddress || "").trim() ||
      shipmentData?.sender?.formattedAddress ||
      formatAddress(
        shipmentData?.sender?.address || shipmentData?.sender?.details || {},
      );

    const finalTrackingNumber =
      shipmentData?.trackingNumber || shipmentData?.shipmentId || shipmentId;

    const finalShipmentStatus = shipmentData?.status || "";
    const finalTripId = requestedTripId || shipmentData?.currentTripId || null;

    const finalTotalPackages = shipmentData?.packages?.length || 0;
    const finalTotalItems = shipmentData?.totals?.totalItems || 0;

    const finalAmount = Number(amount) || 0;
    const finalStatus = ALLOWED_STATUSES.has(status) ? status : "DRAFT";

    const finalShipmentSnapshot = {
      id: shipmentId,
      shipmentId: finalTrackingNumber,
      sender: shipmentData?.sender || null,
      recipient: shipmentData?.recipient || null,
      origin: shipmentData?.origin || null,
      destination: shipmentData?.destination || null,
      totals: shipmentData?.totals || null,
      packages: shipmentData?.packages || [],
      status: shipmentData?.status || null,
      currentTripId: finalTripId,
    };

    const batch = db.batch();

    batch.set(invoiceRef, {
      invoiceNumber,
      shipmentId,
      shipmentTrackingNumber: finalTrackingNumber,

      billingName: finalBillingName,
      billingAddress: finalBillingAddress,

      senderName: finalSenderName,
      senderPhone: finalSenderPhone,
      recipientName: finalRecipientName,
      recipientPhone: finalRecipientPhone,

      origin: finalOrigin,
      destination: finalDestination,
      routeLabel: finalRouteLabel,

      shipmentStatus: finalShipmentStatus,
      tripId: finalTripId,

      totalPackages: finalTotalPackages,
      totalItems: finalTotalItems,
      amount: finalAmount,
      notes: notes || "",
      status: finalStatus,

      invoiceDate: invoiceDate || null,
      dueDate: dueDate || null,

      shipmentSnapshot: finalShipmentSnapshot,

      createdAt: nowAt,
      updatedAt: nowAt,
      createdBy: name,
      updatedBy: name,
    });

    batch.set(
      shipmentRef,
      {
        invoiceId: invoiceRef.id,
        invoiceNumber,
        invoiceStatus: finalStatus,
        hasInvoice: true,
        updatedAt: nowAt,
        updatedBy: name,
      },
      { merge: true },
    );

    writeInvoiceActionLog({
      db,
      batch,
      action: "CREATE_INVOICE",
      invoiceId: invoiceRef.id,
      invoiceDocId: invoiceRef.id,
      invoiceNumber,
      shipmentId,
      actorId: uid,
      actorName: name,
      actorRole: role,
      details: {
        amount: finalAmount,
        status: finalStatus,
      },
      createdAt: nowAt,
    });

    batch.set(db.collection("invoice_events").doc(), {
      invoiceId: invoiceRef.id,
      invoiceNumber,
      type: "INVOICE_CREATED",
      status: finalStatus,
      actorId: uid,
      at: now,
      note: `Invoice ${invoiceNumber} created`,
    });

    try {
      await batch.commit();

      return {
        success: true,
        invoiceId: invoiceRef.id,
        invoiceNumber,
      };
    } catch (error) {
      console.error("Invoice creation failed:", error);
      throw new HttpsError("internal", "Failed to create invoice.");
    }
  },
);
