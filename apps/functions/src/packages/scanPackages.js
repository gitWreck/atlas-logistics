"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireAuth } = require("../utilities/helpers");
const { logger } = require("firebase-functions");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   HELPER: Count Logic (+1 / -1)
   Updates the 'shipments' parent document totals
====================================================== */
function getCountUpdates(oldStatus, newStatus) {
  const updates = {};
  const increment = admin.firestore.FieldValue.increment;

  // 1. SUBTRACT from Old Bucket
  if (oldStatus === "PENDING") updates["totals.pending"] = increment(-1);
  else if (oldStatus === "RECEIVED") updates["totals.received"] = increment(-1);
  else if (oldStatus === "LOADED") updates["totals.loaded"] = increment(-1);
  else if (oldStatus === "DELIVERED")
    updates["totals.delivered"] = increment(-1);

  // 2. ADD to New Bucket
  if (newStatus === "LOADED") updates["totals.loaded"] = increment(1);
  else if (newStatus === "DELIVERED")
    updates["totals.delivered"] = increment(1);
  else if (newStatus === "RECEIVED") updates["totals.received"] = increment(1);

  return updates;
}

/* ======================================================
   MAIN FUNCTION: SCAN PACKAGES
   Accepts: { barcode: string, mode: "loading" | "delivering" }
====================================================== */
exports.scanPackages = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. AUTH & ROLES
    const uid = await requireAuth(req);
    const userSnap = await db.collection("users").doc(uid).get();
    const userRole = userSnap.data().role; // "checker", "driver", "admin"

    // 2. INPUT CLEANING
    const rawBarcode = req.data.barcode;
    const barcode = (rawBarcode || "").trim();
    const mode = req.data.mode; // "loading" or "delivering"
    const location = req.data.location || null; // Optional { lat, lng }

    logger.info("🔍 SCAN START", { barcode, mode, user: uid, role: userRole });

    if (!barcode) throw new HttpsError("invalid-argument", "Barcode required");

    // 3. VALIDATION & PERMISSIONS
    if (!["loading", "delivering"].includes(mode)) {
      throw new HttpsError(
        "invalid-argument",
        "Invalid mode. Use 'loading' or 'delivering'.",
      );
    }

    if (mode === "loading") {
      // ⛔️ ONLY CHECKERS CAN LOAD (Drivers cannot mark items as loaded onto their own truck)
      if (userRole !== "checker" && userRole !== "admin") {
        throw new HttpsError(
          "permission-denied",
          "Only Checkers can Load items onto the truck.",
        );
      }
    } else if (mode === "delivering") {
      // ✅ BOTH CAN DELIVER (Offload)
      if (!["checker", "driver", "admin"].includes(userRole)) {
        throw new HttpsError("permission-denied", "Unauthorized role.");
      }
    }

    // 4. FIND SHIPMENT
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
    const tripId = shipmentData.currentTruckTripId;

    if (!tripId) {
      throw new HttpsError(
        "failed-precondition",
        "Shipment is not assigned to any trip.",
      );
    }

    // 5. CHECK TRIP STATUS
    const tripRef = db.collection("truck_trips").doc(tripId);
    const tripSnap = await tripRef.get();

    if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found.");
    if (tripSnap.data().status === "COMPLETED") {
      throw new HttpsError("failed-precondition", "Trip is already COMPLETED.");
    }

    // 6. FIND PACKAGE & VALIDATE
    const targetPackage = shipmentData.packages.find(
      (p) => p.trackingNumber === barcode,
    );
    if (!targetPackage)
      throw new HttpsError(
        "not-found",
        "Package data missing inside shipment.",
      );

    const oldStatus = targetPackage.status || "PENDING";
    const newStatus = mode === "loading" ? "LOADED" : "DELIVERED";

    // Prevent Redundant Scans
    if (oldStatus === newStatus) {
      throw new HttpsError(
        "already-exists",
        `Package is already ${newStatus}.`,
      );
    }

    // 🛡️ LOGIC GUARD: Can't deliver if not loaded
    if (mode === "delivering" && oldStatus !== "LOADED") {
      throw new HttpsError(
        "failed-precondition",
        "Package must be LOADED before it can be DELIVERED.",
      );
    }

    // ======================================================
    // PREPARE BATCH UPDATES
    // ======================================================
    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const isoDate = new Date().toISOString();

    // A. Update Shipment (Packages Array)
    const newLogEntry = {
      action: newStatus,
      by: uid,
      at: isoDate,
      tripId: tripId,
      location: location || null,
    };

    const updatedPackages = shipmentData.packages.map((pkg) => {
      if (pkg.trackingNumber === barcode) {
        return {
          ...pkg,
          status: newStatus,
          loadedAt: mode === "loading" ? isoDate : pkg.loadedAt,
          deliveredAt:
            mode === "delivering" ? isoDate : pkg.deliveredAt || null,
          loadedBy: mode === "loading" ? uid : pkg.loadedBy,
          deliveredBy: mode === "delivering" ? uid : pkg.deliveredBy || null,
          loadedOnTrip: mode === "loading" ? tripId : pkg.loadedOnTrip,
          audit_log: [...(pkg.audit_log || []), newLogEntry],
        };
      }
      return pkg;
    });

    // Update Shipment Totals
    const totalUpdates = getCountUpdates(oldStatus, newStatus);

    batch.update(shipmentDoc.ref, {
      packages: updatedPackages,
      updatedAt: timestamp,
      updatedBy: uid,
      ...totalUpdates,
      ...(location ? { lastLocation: location } : {}),
    });

    // B. Update Trip Shipment (Manifest Logic)
    const tripShipmentRef = tripRef
      .collection("trip_shipments")
      .doc(shipmentId);
    const increment = admin.firestore.FieldValue.increment;

    let manifestUpdate = {};
    if (mode === "loading") {
      manifestUpdate = {
        pendingCount: increment(-1),
        loadedCount: increment(1),
      };
    } else if (mode === "delivering") {
      manifestUpdate = {
        loadedCount: increment(-1),
        deliveredCount: increment(1),
      };
    }

    // C. Update Root Trip (Dashboard Stats)
    let tripUpdate = {};
    if (mode === "loading") {
      tripUpdate = {
        itemPending: increment(-1),
        totalLoaded: increment(1),
      };
      if (
        tripSnap.data().status === "ASSIGNED" ||
        tripSnap.data().status === "CREATED"
      ) {
        tripUpdate.status = "LOADING";
      }
    } else if (mode === "delivering") {
      tripUpdate = {
        totalLoaded: increment(-1),
        totalDelivered: increment(1),
      };
    }

    batch.update(tripRef, {
      ...tripUpdate,
      updatedAt: timestamp,
    });

    // D. Global Audit Log
    const auditRef = db.collection("audit_logs").doc();
    batch.set(auditRef, {
      action: "SCAN_ITEM",
      subAction: mode.toUpperCase(),
      trackingNumber: barcode,
      shipmentId: shipmentId,
      tripId: tripId,
      performedBy: uid,
      timestamp: timestamp,
      details: { previousStatus: oldStatus, newStatus: newStatus },
    });

    // ======================================================
    // E. STATUS AUTOMATION (Auto-Update Text Status)
    // ======================================================

    // 1. SHIPMENT STATUS
    const currentLoaded =
      (shipmentData.totals.loaded || 0) + (mode === "loading" ? 1 : -1);
    const currentDelivered =
      (shipmentData.totals.delivered || 0) + (mode === "delivering" ? 1 : 0);
    const totalItems = shipmentData.totals.totalItems;

    if (
      mode === "loading" &&
      currentLoaded > 0 &&
      shipmentData.status !== "IN_TRANSIT"
    ) {
      // 🚛 Start moving
      const historyEntry = {
        status: "IN_TRANSIT",
        at: new Date(),
        by: uid,
        note: "Auto-marked IN_TRANSIT via scan",
        location: location || null,
      };

      batch.update(shipmentDoc.ref, {
        status: "IN_TRANSIT",
        updatedAt: timestamp,
        statusHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
        ...(location ? { lastLocation: location } : {}),
      });
    } else if (mode === "delivering" && currentDelivered >= totalItems) {
      // ✅ Finished
      const historyEntry = {
        status: "COMPLETED",
        at: new Date(),
        by: uid,
        note: "Auto-marked COMPLETED via scan",
        location: location || null,
      };

      batch.update(shipmentDoc.ref, {
        status: "COMPLETED",
        updatedAt: timestamp,
        statusHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
        ...(location ? { lastLocation: location } : {}),
      });
    }

    // 2. TRIP SHIPMENT STATUS (Manifest)
    const tsSnap = await tripShipmentRef.get();
    const tsData = tsSnap.exists
      ? tsSnap.data()
      : { loadedCount: 0, deliveredCount: 0, totalItems: totalItems };

    const tsLoaded = (tsData.loadedCount || 0) + (mode === "loading" ? 1 : -1);
    const tsDelivered =
      (tsData.deliveredCount || 0) + (mode === "delivering" ? 1 : 0);

    let newManifestStatus = tsData.status || "ASSIGNED";

    if (mode === "loading") {
      if (tsLoaded >= tsData.totalItems) newManifestStatus = "LOADED";
      else if (tsLoaded > 0) newManifestStatus = "LOADING";
    }

    if (mode === "delivering") {
      if (tsDelivered >= tsData.totalItems) newManifestStatus = "COMPLETED";
      else if (tsDelivered > 0) newManifestStatus = "UNLOADING";
    }

    batch.set(
      tripShipmentRef,
      {
        ...manifestUpdate, // Include counts here to ensure atomic set
        status: newManifestStatus,
        updatedAt: timestamp,
        updatedBy: uid,
      },
      { merge: true },
    );

    // ======================================================
    // COMMIT
    // ======================================================
    await batch.commit();

    return {
      success: true,
      message: `${newStatus}: ${barcode}`,
      previousStatus: oldStatus,
    };
  },
);
