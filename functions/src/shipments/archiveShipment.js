// functions/archiveShipment.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { assertAdminOrManager } = require("./../system/authGuards");

exports.archiveShipment = onCall(
  { region: "asia-southeast1" },
  async (request) => {
    await assertAdminOrManager(request);

    const { trackingId, archived = true } = request.data || {};
    if (!trackingId)
      throw new HttpsError("invalid-argument", "Missing trackingId");

    const uid = request.auth?.uid || "unknown";
    const ref = admin
      .firestore()
      .collection("tracking_records")
      .doc(trackingId);

    await ref.update({
      archived: !!archived,
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
      archivedBy: uid,
    });

    // optional audit log
    await admin
      .firestore()
      .collection("audit_logs")
      .add({
        type: archived ? "SHIPMENT_ARCHIVED" : "SHIPMENT_UNARCHIVED",
        trackingId,
        by: uid,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });

    return { success: true };
  }
);
