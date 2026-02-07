"use strict";

/**
 * autoMessenger (Trigger)
 * ---------------------------------------------------------
 * ✅ When tracking_records status or delay changes
 * ✅ Builds message
 * ✅ Sends if messenger link exists
 * ✅ Idempotent via message_state
 * ✅ Logs message_logs
 * ✅ Safe: failure does not break write
 */

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const FB_PAGE_ACCESS_TOKEN = defineSecret("FB_PAGE_ACCESS_TOKEN");

function normPhonePH(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[^\d]/g, "");
  if (p.startsWith("09")) p = "63" + p.slice(1);
  if (p.startsWith("63") && p.length === 12) return p;
  return null;
}

async function sendMessengerText(psid, text, accessToken) {
  const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: psid }, message: { text } }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`FB send failed ${res.status}: ${t}`.slice(0, 300));
  }
  return await res.json().catch(() => ({}));
}

function buildMessage(tr) {
  const tn = tr.trackingNumber || "AT-UNKNOWN";
  const origin = tr.origin || "";
  const destination = tr.destination || "";
  const status = tr.status || "Updated";

  const delayReason = tr.delayReason && !tr.delayCleared ? String(tr.delayReason).toUpperCase() : null;
  const delayLine = delayReason ? `Delay: ${delayReason}` : "";

  return `📦 Atlas Update\n${tn}\nRoute: ${origin} → ${destination}\nStatus: ${status}${delayLine ? `\n${delayLine}` : ""}`;
}

exports.autoMessenger = onDocumentUpdated(
  {
    region: "asia-southeast1",
    document: "tracking_records/{docId}",
    secrets: [FB_PAGE_ACCESS_TOKEN],
  },
  async (event) => {
    try {
      const before = event.data?.before?.data() || {};
      const after = event.data?.after?.data() || {};

      const tn = String(after.trackingNumber || "").trim().toUpperCase();
      if (!tn) return;

      const changed =
        String(before.status || "") !== String(after.status || "") ||
        String(before.delayReason || "") !== String(after.delayReason || "") ||
        !!before.delayCleared !== !!after.delayCleared;

      if (!changed) return;

      const phone = normPhonePH(after.phone || after.customerPhone || "");
      if (!phone) return; // cannot lookup psid

      // lookup active messenger link
      const linkSnap = await db
        .collection("messenger_links")
        .where("phone", "==", phone)
        .where("active", "==", true)
        .limit(1)
        .get();

      if (linkSnap.empty) return;

      const link = linkSnap.docs[0].data() || {};
      const psid = link.psid;
      if (!psid) return;

      // idempotency key (per status/delay)
      const idempotencyKey = `MSG|${tn}|${after.status || ""}|${after.delayReason || ""}|${after.delayCleared ? "CLEARED" : "ACTIVE"}`;

      const stateRef = db.collection("message_state").doc(`MESSENGER__${tn}__${phone}`);
      const stateDoc = await stateRef.get();
      if (stateDoc.exists && stateDoc.data()?.lastKey === idempotencyKey) return;

      const text = buildMessage(after);
      const accessToken = FB_PAGE_ACCESS_TOKEN.value();

      const result = await sendMessengerText(psid, text, accessToken);

      const logRef = await db.collection("message_logs").add({
        channel: "MESSENGER",
        trackingNumber: tn,
        phone,
        psid,
        idempotencyKey,
        messageText: text,
        result,
        at: FieldValue.serverTimestamp(),
        status: "SENT",
        source: "autoMessenger",
      });

      await stateRef.set(
        { lastKey: idempotencyKey, lastSentAt: FieldValue.serverTimestamp(), lastLogId: logRef.id },
        { merge: true }
      );
    } catch (err) {
      console.error("autoMessenger error:", err);
    }
  }
);
