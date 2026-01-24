"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireAuth } = require("../../utilities/helpers");
const { logger } = require("firebase-functions");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   HELPER: Count Logic (+1 / -1)
====================================================== */
function getCountUpdates(oldStatus, mode) {
  const updates = {};
  const increment = admin.firestore.FieldValue.increment;

  // 1. DETERMINE THE "FROM" BUCKET (Subtract)
  if (!oldStatus || oldStatus === "PENDING") {
    updates["totals.pending"] = increment(-1);
  } else if (oldStatus === "RECEIVED") {
    updates["totals.received"] = increment(-1);
  } else if (oldStatus === "LOADED") {
    updates["totals.loaded"] = increment(-1);
  }

  // 2. DETERMINE THE "TO" BUCKET (Add)
  if (mode === "loading") {
    updates["totals.loaded"] = increment(1);
  } else if (mode === "receiving") {
    updates["totals.received"] = increment(1);
  }

  return updates;
}

/* ======================================================
   MAIN FUNCTION: SCAN PACKAGE
   Accepts: { barcode: string, mode: "loading" | "receiving" }
====================================================== */
exports.scanPackages = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    const uid = await requireAuth(req);

    const rawBarcode = req.data.barcode;
    const cleanBarcode = (rawBarcode || "").trim();

    // ✅ USE logger.info INSTEAD OF console.log
    // Pass an object as the second argument for pretty JSON formatting in the console
    logger.info("🔍 DEBUG SCAN START", {
      raw: rawBarcode,
      cleaned: cleanBarcode,
      user: req.auth ? req.auth.uid : "Unauthenticated",
    });

    // const uid = req.auth.uid;
    const barcode = (req.data.barcode || "").trim();
    const mode = req.data.mode; // "loading" or "receiving"

    // 2. VALIDATION
    if (!barcode) throw new HttpsError("invalid-argument", "Barcode required");
    if (!["loading", "receiving"].includes(mode)) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid mode. Use 'loading' or 'receiving'.",
      );
    }

    // 3. FIND SHIPMENT (Query by Array)
    const shipmentsRef = db.collection("shipments");
    const q = shipmentsRef.where("packageBarcodes", "array-contains", barcode);
    // .limit(1);
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      throw new HttpsError("not-found", "Package not found in any shipment.");
    }

    const shipmentDoc = querySnapshot.docs[0];
    const shipmentData = shipmentDoc.data();
    const shipmentId = shipmentDoc.id;

    const tripSnap = await db
      .collection("truck_trips")
      .doc(shipmentData.currentTruckTripId)
      .get();
    if (tripSnap.data().status === "COMPLETED") {
      throw new HttpsError("failed-precondition", "Trip is already COMPLETED.");
    }

    // 4. CHECK TRIP ASSIGNMENT
    if (!shipmentData.currentTruckTripId) {
      throw new HttpsError(
        "failed-precondition",
        "Shipment is not assigned to a trip.",
      );
    }

    // 5. FIND SPECIFIC PACKAGE & VALIDATE STATUS
    const targetPackage = shipmentData.packages.find(
      (p) => p.trackingNumber === barcode,
    );
    if (!targetPackage) {
      throw new HttpsError(
        "not-found",
        "Barcode exists in index but package data is missing.",
      );
    }

    const oldStatus = targetPackage.status || "PENDING";

    // Prevent Double Scans
    if (mode === "loading" && oldStatus === "LOADED") {
      throw new HttpsError("already-exists", "Package is already LOADED.");
    }
    if (mode === "receiving" && oldStatus === "RECEIVED") {
      throw new HttpsError("already-exists", "Package is already RECEIVED.");
    }

    // ======================================================
    // PREPARE BATCH UPDATES
    // ======================================================
    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const isoDate = new Date().toISOString();

    // A. Update Shipment (Packages Array + Totals)
    const shipmentRef = shipmentDoc.ref;

    // Create Audit Log Entry (Internal)
    const newLogEntry = {
      action: mode === "loading" ? "LOADED" : "RECEIVED",
      by: uid,
      at: isoDate,
      tripId: shipmentData.currentTruckTripId,
    };

    const updatedPackages = shipmentData.packages.map((pkg) => {
      if (pkg.trackingNumber === barcode) {
        const isLoading = mode === "loading";
        const isReceiving = mode === "receiving";

        return {
          ...pkg,
          status: isLoading ? "LOADED" : "RECEIVED",
          loadedAt: isLoading ? isoDate : pkg.loadedAt,
          loadedBy: isLoading ? uid : pkg.loadedBy,
          loadedOnTrip: isLoading
            ? shipmentData.currentTruckTripId
            : pkg.loadedOnTrip,
          receivedAt: isReceiving ? isoDate : pkg.receivedAt || null,
          receivedBy: isReceiving ? uid : pkg.receivedBy || null,
          // Append to internal audit log
          audit_log: [...(pkg.audit_log || []), newLogEntry],
        };
      }
      return pkg;
    });

    const totalUpdates = getCountUpdates(oldStatus, mode);

    batch.update(shipmentRef, {
      packages: updatedPackages,
      updatedAt: timestamp,
      updatedBy: uid,
      ...totalUpdates,
    });

    // B. Update Trip Shipment (Manifest)
    const tripId = shipmentData.currentTruckTripId;
    const tripShipmentRef = db
      .collection("truck_trips")
      .doc(tripId)
      .collection("trip_shipments")
      .doc(shipmentId);

    const increment = admin.firestore.FieldValue.increment;
    const countUpdate =
      mode === "loading"
        ? { loadedCount: increment(1), pendingCount: increment(-1) }
        : { loadedCount: increment(-1), pendingCount: increment(1) };

    // Use set with merge in case the trip_shipment doc doesn't exist yet (safety)
    batch.set(
      tripShipmentRef,
      {
        ...countUpdate,
        updatedAt: timestamp,
        updatedBy: uid,
      },
      { merge: true },
    );

    // C. Update Root Trip (Dashboard Counts)
    const rootTripRef = db.collection("truck_trips").doc(tripId);
    const rootUpdate =
      mode === "loading"
        ? { totalLoaded: increment(1), itemPending: increment(-1) }
        : { totalLoaded: increment(-1), itemPending: increment(1) };

    batch.update(rootTripRef, {
      ...rootUpdate,
      updatedAt: timestamp,
    });

    // D. Global Audit Log (Separate Collection)
    const auditRef = db.collection("audit_logs").doc();
    batch.set(auditRef, {
      action: "SCAN_ITEM",
      subAction: mode === "loading" ? "LOAD_ITEM" : "RECEIVE_ITEM",
      trackingNumber: barcode,
      shipmentId: shipmentId,
      tripId: tripId,
      performedBy: uid,
      timestamp: timestamp,
      details: {
        previousStatus: oldStatus,
        newStatus: mode === "loading" ? "LOADED" : "RECEIVED",
      },
    });

    // ======================================================
    // COMMIT
    // ======================================================
    await batch.commit();

    return {
      success: true,
      message: `${mode === "loading" ? "Loaded" : "Received"}: ${barcode}`,
      previousStatus: oldStatus,
    };
  },
);
