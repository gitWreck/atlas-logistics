"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

// Ideally, import your shared writeAuditLog helper
// const { writeAuditLog } = require("../_shared");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updateShipmentStatus = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    // 1. AUTHENTICATION
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in.");
    }
    const uid = req.auth.uid;

    // 2. INPUT VALIDATION
    const { shipmentId, tripId, newStatus, remarks, location } = req.data;

    if (!shipmentId || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing shipmentId or status.");
    }

    // Allowed Statuses for this function
    const ALLOWED = ["OUT_FOR_DELIVERY", "DELIVERED", "FAILED"];
    if (!ALLOWED.includes(newStatus)) {
      throw new HttpsError("invalid-argument", "Invalid status transition.");
    }

    // 3. REFERENCES
    const shipmentRef = db.collection("shipments").doc(shipmentId);

    // If tripId is provided, we update the sub-collection too
    const tripShipmentRef = tripId
      ? db
          .collection("truck_trips")
          .doc(tripId)
          .collection("trip_shipments")
          .doc(shipmentId)
      : null;

    // 4. TRANSACTION
    await db.runTransaction(async (tx) => {
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found.");
      }

      const currentData = shipmentSnap.data();
      const oldStatus = currentData.status;

      // (Optional) Logic Check: Prevent "DELIVERED" if not yet "OUT_FOR_DELIVERY"
      // if (newStatus === "DELIVERED" && oldStatus !== "OUT_FOR_DELIVERY") {
      //    throw new HttpsError("failed-precondition", "Must be Out for Delivery first.");
      // }

      // A. Prepare History Entry
      const historyEntry = {
        status: newStatus,
        at: new Date(), // Use JS Date for arrayUnion, Firestore converts it
        by: uid,
        note: remarks || `Marked via Driver App`,
        location: location || null, // { lat, lng }
      };

      // B. Update Main Shipment
      tx.update(shipmentRef, {
        status: newStatus,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        statusHistory: FieldValue.arrayUnion(historyEntry),
      });

      // C. Update Trip Link (If exists)
      if (tripShipmentRef) {
        // We check if it exists just to be safe, though it should
        const tsSnap = await tx.get(tripShipmentRef);
        if (tsSnap.exists) {
          tx.update(tripShipmentRef, {
            status: newStatus,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      // D. AUDIT LOG (Manual Write if you don't have the helper imported)
      const auditRef = db.collection("audit_logs").doc();
      tx.set(auditRef, {
        action: "UPDATE_SHIPMENT_STATUS",
        targetCollection: "shipments",
        targetId: shipmentId,
        actorId: uid,
        details: {
          oldStatus,
          newStatus,
          tripId,
          remarks,
        },
        timestamp: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, status: newStatus };
  },
);
