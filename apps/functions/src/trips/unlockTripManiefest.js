"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { requireRole, requireString } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   unlockTripManifest
   ======================================================
   ✅ Allows Admin/Manager to edit a trip again
   ✅ Sets manifestLocked = false
   ✅ Logs the security event (Important!)
====================================================== */
exports.unlockTripManifest = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    // 1. Auth & Role Check
    await requireRole(db, req, ["admin", "manager"]);
    const uid = req.auth.uid;

    const tripDocId = requireString(req.data?.tripDocId, "tripDocId");
    const reason = requireString(req.data?.reason, "reason"); // Reason is mandatory for audits

    const tripRef = db.collection("truck_trips").doc(tripDocId);

    // Get user details for the log
    const userSnap = await db.collection("users").doc(uid).get();
    const actorName = userSnap.data()?.name || "Unknown Manager";

    await db.runTransaction(async (tx) => {
      const tripSnap = await tx.get(tripRef);
      if (!tripSnap.exists) throw new HttpsError("not-found", "Trip not found");

      const trip = tripSnap.data();

      // Check if it's actually locked
      if (trip.manifestLocked !== true) {
        return { success: true, message: "Trip was already unlocked." };
      }

      // 2. UNLOCK OPERATIONS
      tx.update(tripRef, {
        manifestLocked: false,
        // We DO NOT clear manifestId yet. We keep it as a reference to the "last generated" one.
        // But we mark the status so the UI knows the current state is "dirty" or "open".
        manifestStatus: "OPEN_FOR_EDIT",

        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid,
      });

      // 3. AUDIT LOG (Crucial for compliance)
      // Since Manifests are legal documents, unlocking them is a sensitive action.
      const logRef = db.collection("audit_log").doc();
      tx.set(logRef, {
        action: "UNLOCK_MANIFEST",
        targetId: tripDocId,
        targetCollection: "truck_trips",
        previousManifestId: trip.manifestId || null,
        reason: reason,
        at: admin.firestore.FieldValue.serverTimestamp(),
        by: uid,
        actorName: actorName,
        note: `Manifest unlocked by manager. Reason: ${reason}`,
      });

      // Optional: Add event to trip subcollection history
      const eventRef = tripRef.collection("manifest_events").doc();
      tx.set(eventRef, {
        type: "MANIFEST_UNLOCKED",
        reason,
        unlockedBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return { success: true };
  },
);
