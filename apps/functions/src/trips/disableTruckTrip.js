const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { writeTripActionLog } = require("../utilities/tripLogger");

// Ensure app is initialized
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   DISABLE / CANCEL TRIP
====================================================== */
exports.disableTruckTrip = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Login required");

    const { tripDocId, reason } = req.data;
    if (!tripDocId) throw new HttpsError("invalid-argument", "Trip ID missing");

    const tripRef = db.collection("truck_trips").doc(tripDocId);

    await db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");
      const trip = tripSnap.data();

      if (trip.manifestLocked) {
        throw new HttpsError(
          "failed-precondition",
          "Cannot disable a locked trip. Unlock it first."
        );
      }

      // Check if cargo is loaded (Safety Check)
      if (trip.packageTotal > 0 || trip.loadedCount > 0) {
        throw new HttpsError(
          "failed-precondition",
          "Cannot disable trip with assigned cargo. Unassign shipments first."
        );
      }

      tx.update(tripRef, {
        active: false,
        status: "CANCELLED",
        cancellationReason: reason || "No reason provided",
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelledBy: req.auth.uid,
      });

      writeTripActionLog({
        db,
        tx,
        action: "DISABLE_TRIP",
        tripDocId,
        reason,
        actorId: req.auth.uid,
        actorName: req.auth.token?.name || null,
        actorRole: req.auth.token?.role || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  }
);
