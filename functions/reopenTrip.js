"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   reopenTrip (Manager Undo)
====================================================== */
exports.reopenTrip = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Login required");

    const tripDocId = String(req.data?.tripDocId || "").trim();
    const reason = String(req.data?.reason || "").trim();

    if (!tripDocId) throw new HttpsError("invalid-argument", "tripDocId required");
    if (!reason) throw new HttpsError("invalid-argument", "reason required");

    const tripRef = db.collection("truck_trips").doc(tripDocId);
    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (tx) => {
      const [tripSnap, userSnap] = await Promise.all([
        tx.get(tripRef),
        tx.get(userRef),
      ]);

      if (!userSnap.exists || userSnap.data().active !== true) {
        throw new HttpsError("permission-denied", "Inactive user");
      }

      const role = String(userSnap.data().role || "").toLowerCase();
      const name = userSnap.data().name || "";

      if (!["admin", "manager"].includes(role)) {
        throw new HttpsError("permission-denied", "Admin or Manager only");
      }

      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");

      const trip = tripSnap.data();
      if (trip.active === true) {
        throw new HttpsError("failed-precondition", "Trip already active");
      }

      // 🔁 Reopen
      tx.update(tripRef, {
        active: true,
        status: "REOPENED",
        reopenedAt: admin.firestore.FieldValue.serverTimestamp(),
        reopenedBy: uid,
        reopenedByName: name,
      });

      // 🧾 Black-box audit
      tx.set(db.collection("admin_logs").doc(), {
        action: "REOPEN_TRIP",
        tripDocId,
        reason,
        actorId: uid,
        actorRole: role,
        actorName: name,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { success: true, tripDocId };
  }
);
