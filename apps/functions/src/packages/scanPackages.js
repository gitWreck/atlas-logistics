"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireAuth } = require("../utilities/helpers");
const { logger } = require("firebase-functions");
const { FieldValue } = require("firebase-admin/firestore");
const {
  PACKAGE_STATUS,
  normalizePackageStatus,
} = require("./packageStatus");
const {
  packageOnTrip,
  packageEligibleForLinehaulLoad,
  applyLinehaulLoad,
  applyLinehaulUnloadAtHub,
  buildShipmentSnapshot,
  normalizePackageRow,
} = require("./tripPackageOperations");
const { tryAutoCompleteTrip } = require("../trips/autoCompleteTrip");
const {
  assertCanUnloadAtHub,
  isHubTransferTrip,
} = require("../trips/manifestStatus");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const LOADED_LIKE_STATUSES = new Set([
  PACKAGE_STATUS.LOADED,
  PACKAGE_STATUS.LOADED_TO_TRIP,
  PACKAGE_STATUS.IN_TRANSIT,
  PACKAGE_STATUS.PARTIALLY_LOADED,
]);

exports.scanPackages = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const uid = await requireAuth(req);
    const userSnap = await db.collection("users").doc(uid).get();
    const userRole = userSnap.data()?.role;

    const rawBarcode = req.data.barcode;
    const barcode = (rawBarcode || "").trim();
    const mode = req.data.mode;
    const location = req.data.location || null;

    logger.info("SCAN START", { barcode, mode, user: uid, role: userRole });

    if (!barcode) throw new HttpsError("invalid-argument", "Barcode required");

    if (!["loading", "delivering"].includes(mode)) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid mode. Use 'loading' or 'delivering'.",
      );
    }

    if (mode === "loading") {
      if (userRole !== "checker" && userRole !== "admin") {
        throw new HttpsError(
          "permission-denied",
          "Only Checkers can Load items onto the truck.",
        );
      }
    } else if (!["checker", "admin"].includes(userRole)) {
      throw new HttpsError("permission-denied", "Unauthorized role.");
    }

    const shipmentsRef = db.collection("shipments");
    const q = shipmentsRef
      .where("packageBarcodes", "array-contains", barcode)
      .limit(1);
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      throw new HttpsError("not-found", `Package ${barcode} not found.`);
    }

    const shipmentDoc = querySnapshot.docs[0];
    const shipmentData = shipmentDoc.data();
    const shipmentId = shipmentDoc.id;
    const tripId =
      shipmentData.currentTruckTripId ||
      shipmentData.currentTripId ||
      null;

    if (!tripId) {
      throw new HttpsError(
        "failed-precondition",
        "Shipment is not assigned to any trip.",
      );
    }

    const tripRef = db.collection("truck_trips").doc(tripId);
    const tripSnap = await tripRef.get();

    if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");

    const tripData = tripSnap.data() || {};
    if (tripData.status === "COMPLETED") {
      throw new HttpsError("failed-precondition", "Trip is already COMPLETED.");
    }

    if (mode === "delivering" && isHubTransferTrip(tripData)) {
      assertCanUnloadAtHub(tripData, tripId);
    }

    const packages = Array.isArray(shipmentData.packages)
      ? shipmentData.packages.map(normalizePackageRow)
      : [];

    const targetIndex = packages.findIndex(
      (p) => (p.packageId || p.trackingNumber) === barcode,
    );
    if (targetIndex === -1) {
      throw new HttpsError(
        "not-found",
        "Package data missing inside shipment.",
      );
    }

    const targetPackage = packages[targetIndex];
    const oldStatus = normalizePackageStatus(targetPackage);

    if (mode === "loading") {
      if (!packageEligibleForLinehaulLoad(targetPackage)) {
        throw new HttpsError(
          "failed-precondition",
          "Package is not eligible to load on this trip.",
        );
      }
    } else if (!LOADED_LIKE_STATUSES.has(oldStatus) && !packageOnTrip(targetPackage, tripId)) {
      throw new HttpsError(
        "failed-precondition",
        "Package must be loaded on this trip before it can be offloaded.",
      );
    }

    const isoDate = new Date().toISOString();
    const timestamp = FieldValue.serverTimestamp();
    const actorName = userSnap.data()?.name || uid;

    const result = await db.runTransaction(async (tx) => {
      const freshSnap = await tx.get(shipmentDoc.ref);
      const freshData = freshSnap.data() || {};
      const beforePackages = Array.isArray(freshData.packages)
        ? freshData.packages.map(normalizePackageRow)
        : [];

      const idx = beforePackages.findIndex(
        (p) => (p.packageId || p.trackingNumber) === barcode,
      );
      if (idx === -1) {
        throw new HttpsError("not-found", "Package no longer on shipment.");
      }

      const pkg = beforePackages[idx];
      const previousStatus = normalizePackageStatus(pkg);

      let nextPkg = pkg;
      if (mode === "loading") {
        if (!packageEligibleForLinehaulLoad(pkg)) {
          throw new HttpsError(
            "already-exists",
            "Package is already loaded or not eligible.",
          );
        }
        nextPkg = applyLinehaulLoad(pkg, {
          tripId,
          actorName,
          nowIso: isoDate,
        });
      } else {
        if (
          !LOADED_LIKE_STATUSES.has(previousStatus) &&
          !packageOnTrip(pkg, tripId)
        ) {
          throw new HttpsError(
            "failed-precondition",
            "Package must be loaded on this trip before offload.",
          );
        }
        nextPkg = applyLinehaulUnloadAtHub(pkg, { tripId, nowIso: isoDate });
        nextPkg = {
          ...nextPkg,
          deliveredBy: uid,
          audit_log: [
            ...(pkg.audit_log || []),
            {
              action: "OFFLOAD_AT_HUB",
              by: uid,
              at: isoDate,
              tripId,
              location,
            },
          ],
        };
      }

      if (normalizePackageStatus(nextPkg) === previousStatus) {
        throw new HttpsError(
          "already-exists",
          `Package is already ${previousStatus}.`,
        );
      }

      const updatedPackages = [...beforePackages];
      updatedPackages[idx] = nextPkg;

      const snapshot = buildShipmentSnapshot(updatedPackages, {
        previousStatus: freshData.status,
        isHubReceive: mode === "delivering" && isHubTransferTrip(tripData),
        isDeliveryTrip:
          mode === "delivering" && !isHubTransferTrip(tripData),
      });

      const newPackageStatus = normalizePackageStatus(nextPkg);

      tx.update(shipmentDoc.ref, {
        status: snapshot.status,
        packages: snapshot.packages,
        packageBreakdown: snapshot.packageBreakdown,
        currentTripIds: snapshot.currentTripIds,
        currentTripId: snapshot.currentTripId,
        "totals.totalItems": snapshot.totals.totalItems,
        "totals.totalContentQty": snapshot.totals.totalContentQty,
        "totals.loaded": snapshot.totals.loaded,
        "totals.pending": snapshot.totals.pending,
        "totals.received": snapshot.totals.received,
        "totals.delivered": snapshot.totals.delivered,
        "totals.missing": snapshot.totals.missing,
        "totals.damaged": snapshot.totals.damaged,
        updatedAt: timestamp,
        updatedBy: uid,
        ...(location ? { lastLocation: location } : {}),
        statusHistory: FieldValue.arrayUnion({
          status: snapshot.status,
          at: new Date(),
          by: uid,
          note:
            mode === "loading"
              ? `Package ${barcode} loaded to trip ${tripId}.`
              : `Package ${barcode} offloaded at hub from trip ${tripId}.`,
          location: location || null,
        }),
      });

      const tripShipmentRef = tripRef.collection("trip_shipments").doc(shipmentId);
      const tripShipmentSnap = await tx.get(tripShipmentRef);
      const tripShipmentData = tripShipmentSnap.exists
        ? tripShipmentSnap.data() || {}
        : { totalItems: snapshot.totals.totalContentQty };

      const increment = FieldValue.increment;
      const manifestUpdate =
        mode === "loading"
          ? { pendingCount: increment(-1), loadedCount: increment(1) }
          : { loadedCount: increment(-1), deliveredCount: increment(1) };

      const tsLoaded = (tripShipmentData.loadedCount || 0) + (mode === "loading" ? 1 : -1);
      const tsDelivered =
        (tripShipmentData.deliveredCount || 0) + (mode === "delivering" ? 1 : 0);
      const tsTotal = tripShipmentData.totalItems || snapshot.totals.totalContentQty;

      let newManifestStatus = tripShipmentData.status || "ASSIGNED";
      if (mode === "loading") {
        if (tsLoaded >= tsTotal) newManifestStatus = "LOADED";
        else if (tsLoaded > 0) newManifestStatus = "LOADING";
      } else if (tsDelivered >= tsTotal) {
        newManifestStatus = "COMPLETED";
      } else if (tsDelivered > 0) {
        newManifestStatus = "UNLOADING";
      }

      tx.set(
        tripShipmentRef,
        {
          ...manifestUpdate,
          status: newManifestStatus,
          updatedAt: timestamp,
          updatedBy: uid,
        },
        { merge: true },
      );

      const tripUpdate = {
        updatedAt: timestamp,
      };
      if (mode === "loading") {
        tripUpdate.itemPending = increment(-1);
        tripUpdate.totalLoaded = increment(1);
        if (["ASSIGNED", "CREATED"].includes(tripSnap.data().status)) {
          tripUpdate.status = "LOADING";
        }
      } else {
        tripUpdate.totalArrived = increment(1);
      }

      tx.update(tripRef, tripUpdate);

      const auditRef = db.collection("audit_logs").doc();
      tx.set(auditRef, {
        action: "SCAN_ITEM",
        subAction: mode.toUpperCase(),
        trackingNumber: barcode,
        packageId: barcode,
        shipmentId,
        tripId,
        performedBy: uid,
        timestamp,
        details: {
          previousStatus,
          newStatus: newPackageStatus,
          shipmentStatus: snapshot.status,
        },
      });

      return {
        previousStatus,
        newStatus: newPackageStatus,
        shipmentStatus: snapshot.status,
        tripType: tripSnap.data()?.tripType || null,
      };
    });

    try {
      await tryAutoCompleteTrip(tripId, {
        actorId: uid,
        actorName,
        actorRole: userRole,
        source: "SCAN_PACKAGES",
      });
    } catch (autoCompleteError) {
      console.error("Auto-complete trip failed:", autoCompleteError);
    }

    return {
      success: true,
      message: `${result.newStatus}: ${barcode}`,
      previousStatus: result.previousStatus,
      shipmentStatus: result.shipmentStatus,
    };
  },
);
