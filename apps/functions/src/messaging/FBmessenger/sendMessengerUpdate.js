"use strict";

/**
 * Atlas — Customer Safe Messenger Sender
 * --------------------------------------
 * - NO driver
 * - NO trip
 * - NO internal data
 * - Uses messenger_links to find PSID
 * - Logs message
 */

const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { requireNormalizedPhone } = require("../../utilities/phoneHelpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const FB_PAGE_ACCESS_TOKEN = defineSecret("FB_PAGE_ACCESS_TOKEN");

/* -------------------- Helpers -------------------- */

function buildCustomerMessage(tr) {
  const tn = tr.trackingNumber || "AT-UNKNOWN";
  const origin = tr.origin || "";
  const destination = tr.destination || "";
  const status = tr.status || "Updated";

  const received = Number(tr.receivedCount || tr.totalItems || 0);
  const loaded = Number(tr.loadedCount || 0);
  const pending =
    typeof tr.pendingCount === "number"
      ? Number(tr.pendingCount)
      : Math.max(0, received - loaded);

  const delay =
    tr.delayReason && !tr.delayCleared
      ? `\nDelay: ${String(tr.delayReason).toUpperCase()}`
      : "";

  const url = `https://atlas-tracking.web.app/?t=${encodeURIComponent(tn)}`;

  return (
`📦 Atlas Update
Tracking: ${tn}
Route: ${origin} → ${destination}

Status: ${status}${delay}

Package Summary
• Received: ${received}
• Loaded: ${loaded}
• Pending: ${pending}

🔎 Track your package:
${url}`
  );
}

async function sendMessenger(psid, message, token) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: psid },
        message: { text: message }
      })
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`FB Messenger error ${res.status}: ${txt}`.slice(0, 300));
  }
}

/* -------------------- Main -------------------- */

exports.sendMessengerUpdate = async function sendMessengerUpdate(trackingNumber) {
  if (!trackingNumber) return;

  // Find shipment
  const snap = await db
    .collection("tracking_records")
    .where("trackingNumber", "==", trackingNumber)
    .limit(1)
    .get();

  if (snap.empty) return;

  const tr = snap.docs[0].data() || {};

  // Find phone → PSID
  const phone = requireNormalizedPhone(tr.phone || tr.customerPhone || "");
  if (!phone) return;

  const linkSnap = await db
    .collection("messenger_links")
    .where("phone", "==", phone)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (linkSnap.empty) return;

  const psid = linkSnap.docs[0].data().psid;
  if (!psid) return;

  // Build safe message
  const message = buildCustomerMessage(tr);

  // Send
  const token = FB_PAGE_ACCESS_TOKEN.value();
  await sendMessenger(psid, message, token);

  // Log
  await db.collection("message_logs").add({
    channel: "MESSENGER",
    trackingNumber,
    phone,
    psid,
    message,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "sendMessengerUpdate"
  });
};
