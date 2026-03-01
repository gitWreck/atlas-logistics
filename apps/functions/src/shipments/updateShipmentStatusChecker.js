"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updateShipmentStatusChecker = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. AUTH & ROLE CHECK
    if (!req.auth) throw new HttpsError("unauthenticated", "Auth required.");
    await requireRole(db, req, ["admin", "manager", "checker"]);

    const uid = req.auth.uid;
    const { shipmentId, tripId, newStatus, remarks, location } = req.data;

    if (!shipmentId || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing shipmentId or status.");
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const tripRef = tripId ? db.collection("truck_trips").doc(tripId) : null;
    const tripShipmentRef = tripRef
      ? tripRef.collection("trip_shipments").doc(shipmentId)
      : null;

    // 2. TRANSACTION
    await db.runTransaction(async (tx) => {
      // --- PHASE 1: READS ---
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists)
        throw new HttpsError("not-found", "Shipment not found.");

      let tripShipSnap = null;
      if (tripShipmentRef) {
        tripShipSnap = await tx.get(tripShipmentRef);
      }

      const currentData = shipmentSnap.data();
      const oldStatus = currentData.status;

      // If status is already the same, skip to avoid double-counting
      if (oldStatus === newStatus)
        return { success: true, message: "No change" };

      // --- PHASE 2: CALCULATE PACKAGE COUNT ---
      // We look at the actual array length to determine how much to increment/decrement
      const pkgCount =
        currentData.packages?.length || currentData.totals?.totalItems || 0;

      // --- PHASE 3: WRITES ---

      // Update individual packages status inside the array
      const updatedPackages = (currentData.packages || []).map((pkg) => ({
        ...pkg,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      }));

      // A. Update Main Shipment
      tx.update(shipmentRef, {
        status: newStatus,
        packages: updatedPackages,
        "totals.loaded": newStatus === "LOADED" ? pkgCount : 0,
        "totals.received": newStatus === "RECEIVED" ? pkgCount : 0,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        remarks: remarks || null,
        statusHistory: FieldValue.arrayUnion({
          status: newStatus,
          at: new Date(),
          by: uid,
          note: remarks || `Status updated via Checker UI`,
          location: location || null,
        }),
        ...(location ? { lastLocation: location } : {}),
      });

      // B. Update Trip & Trip_Shipment Sub-collection
      if (tripShipmentRef && tripShipSnap && tripShipSnap.exists) {
        const tripUpdate = { updatedAt: FieldValue.serverTimestamp() };

        // 🟢 THE FIX: Decrement OLD status by pkgCount
        if (oldStatus === "LOADED") {
          tripUpdate.totalLoaded = FieldValue.increment(-pkgCount);
        } else if (oldStatus === "RECEIVED") {
          tripUpdate.totalArrived = FieldValue.increment(-pkgCount);
        }

        // 🟢 THE FIX: Increment NEW status by pkgCount
        if (newStatus === "LOADED") {
          tripUpdate.totalLoaded = FieldValue.increment(pkgCount);
        } else if (newStatus === "RECEIVED") {
          tripUpdate.totalArrived = FieldValue.increment(pkgCount);
        } else if (newStatus === "MISSING") {
          tripUpdate.totalExceptions = FieldValue.increment(pkgCount);
        }

        // Update the sub-document (Manifest entry)
        tx.update(tripShipmentRef, {
          status: newStatus,
          loadedCount: newStatus === "LOADED" ? pkgCount : 0,
          arrivedCount: newStatus === "RECEIVED" ? pkgCount : 0,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Update the parent Trip (Dashboard)
        tx.update(tripRef, tripUpdate);
      }

      // C. Global Audit Log
      const auditRef = db.collection("audit_logs").doc();
      tx.set(auditRef, {
        action: `CHECKER_${newStatus}`,
        targetId: shipmentId,
        actorId: uid,
        details: {
          oldStatus,
          newStatus,
          packageCount: pkgCount,
          tripId: tripId || "N/A",
        },
        timestamp: FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  },
);
