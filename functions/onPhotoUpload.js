"use strict";
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { sendMessengerImage } = require("./lib/messenger");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function normPhonePH(p="") {
  p = String(p).replace(/[^\d]/g, "");
  if (p.startsWith("09")) p = "63" + p.slice(1);
  if (p.startsWith("9")) p = "63" + p;
  return p;
}

exports.onTrackingPhotoCreated = onDocumentCreated(
  "tracking_photos/{photoId}",
  async (event) => {
    const photo = event.data?.data();
    if (!photo?.trackingNumber || !photo?.url) return;

    // get tracking record
    const qs = await db.collection("tracking_records")
      .where("trackingNumber", "==", photo.trackingNumber)
      .limit(1).get();
    if (qs.empty) return;

    const tr = qs.docs[0].data();
    const phone = normPhonePH(tr.phone || tr.customerPhone || "");
    if (!phone) return;

    // get PSID
    const linkSnap = await db.collection("messenger_links").doc(phone).get();
    const psid = linkSnap.exists ? linkSnap.data().psid : null;
    if (!psid) return;

    const caption =
`📦 Atlas Update
${photo.trackingNumber}
${photo.type} photo attached
Route: ${tr.origin || ""} → ${tr.destination || ""}
Status: ${tr.status || ""}`;

    await sendMessengerImage(psid, photo.url, caption);

    // log
    await db.collection("message_logs").add({
      channel: "messenger",
      psid,
      trackingNumber: photo.trackingNumber,
      type: "image",
      photoType: photo.type,
      sentAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
);
