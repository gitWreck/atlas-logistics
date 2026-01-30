"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole } = require("../utilities/helpers"); // Your auth helper

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.resolveDelayReport = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    // 1. SECURITY: Only Admins/Managers can approve/reject
    await requireRole(db, req, ["admin", "manager"]);

    const { alertId, decision, managerNotes } = req.data;
    const uid = req.auth.uid;

    if (!alertId)
      throw new HttpsError("invalid-argument", "Alert ID is required");
    if (!["APPROVED", "REJECTED"].includes(decision)) {
      throw new HttpsError("invalid-argument", "Invalid decision");
    }

    const alertRef = db.collection("admin_alerts").doc(alertId);

    await db.runTransaction(async (tx) => {
      // 2. FETCH ALERT
      const alertSnap = await tx.get(alertRef);
      if (!alertSnap.exists) {
        throw new HttpsError("not-found", "Alert not found");
      }

      const alertData = alertSnap.data();
      const { tripId, details } = alertData;

      // Check if already resolved to prevent double-clicks
      if (alertData.status !== "UNREAD" && alertData.status !== "PENDING") {
        throw new HttpsError("failed-precondition", "Alert already resolved.");
      }

      const tripRef = db.collection("truck_trips").doc(tripId);
      const now = admin.firestore.FieldValue.serverTimestamp();

      // 3. LOGIC BRANCH
      if (decision === "APPROVED") {
        // --- APPROVE LOGIC ---
        // 1. Update Trip: Set status to DELAYED
        tx.update(tripRef, {
          status: "DELAYED",
          delayReason: details?.reason || "Delay Approved",
          delayCleared: true, // Keep this true
          updatedAt: now,
        });
      } else {
        // --- REJECT LOGIC ---
        // 1. Update Trip: Clear the "Active Delay" flag so it stops flashing red
        tx.update(tripRef, {
          delayCleared: true,
          // We don't change the status back to IN_TRANSIT here
          // just in case it was something else, but we remove the flag.
          updatedAt: now,
        });
      }

      // 4. RESOLVE THE ALERT
      tx.update(alertRef, {
        status: decision, // "APPROVED" or "REJECTED"
        managerNotes: managerNotes || "",
        resolvedAt: now,
        resolvedBy: uid,
      });
    });

    return { success: true };
  },
);
