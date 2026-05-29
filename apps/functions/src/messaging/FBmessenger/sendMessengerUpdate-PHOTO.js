"use strict";

/**
 * Atlas — Customer Safe Messenger Sender
 * --------------------------------------
 * - NO driver
 * - NO trip
 * - NO internal data
 * - Uses messenger_links to find PSID
 * - Logs message
 *
 * ✅ NEW:
 * - sendMessengerPhotoUpdate(trackingNumber, imageUrl, caption)
 */

const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { requireNormalizedPhone } = require("../../utilities/phoneHelpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const FB_PAGE_ACCESS_TOKEN = defineSecret("FB_PAGE_ACCESS_TOKEN");

/* -------------------- Helpers -------------------- */

function normalizeTracking(s) {
  return String(s || "").trim().toUpperCase();
}

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

async function fbPost(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`FB Messenger error ${res.status}: ${txt}`.slice(0, 500));
    }
    return await res.json().catch(() => ({}));
  } finally {
    clearTimeout(timeout);
  }
}

async function sendMessengerText(psid, message, token) {
  return fbPost(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
    { recipient: { id: psid }, message: { text: message } }
  );
}

async function sendMessengerImage(psid, imageUrl, token) {
  return fbPost(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
    {
      recipient: { id: psid },
      message: {
        attachment: {
          type: "image",
          payload: { url: imageUrl, is_reusable: true },
        },
      },
    }
  );
}

async function resolvePsidByTracking(trackingNumber) {
  const tn = normalizeTracking(trackingNumber);
  if (!tn) return null;

  const snap = await db
    .collection("tracking_records")
    .where("trackingNumber", "==", tn)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const tr = snap.docs[0].data() || {};
  const phone = requireNormalizedPhone(tr.phone || tr.customerPhone || "");
  if (!phone) return null;

  const linkSnap = await db
    .collection("messenger_links")
    .where("phone", "==", phone)
    .where("active", "==", true)
    .limit(1)
    .get();

  if (linkSnap.empty) return null;

  return {
    tr,
    phone,
    psid: linkSnap.docs[0].data()?.psid || null,
  };
}

/* -------------------- Main -------------------- */

exports.sendMessengerUpdate = async function sendMessengerUpdate(trackingNumber) {
  if (!trackingNumber) return;

  const resolved = await resolvePsidByTracking(trackingNumber);
  if (!resolved?.psid) return;

  const { tr, phone, psid } = resolved;
  const message = buildCustomerMessage(tr);

  const token = FB_PAGE_ACCESS_TOKEN.value();
  await sendMessengerText(psid, message, token);

  await db.collection("message_logs").add({
    channel: "MESSENGER",
    type: "STATUS",
    trackingNumber: normalizeTracking(tr.trackingNumber || trackingNumber),
    phone,
    psid,
    message,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "sendMessengerUpdate",
  });
};

/**
 * Send a package photo to the customer linked to this tracking number.
 * imageUrl must be publicly fetchable by Facebook (use Firebase Storage downloadURL).
 */
exports.sendMessengerPhotoUpdate = async function sendMessengerPhotoUpdate(trackingNumber, imageUrl, caption = "") {
  if (!trackingNumber || !imageUrl) return;

  const resolved = await resolvePsidByTracking(trackingNumber);
  if (!resolved?.psid) return;

  const { tr, phone, psid } = resolved;

  const token = FB_PAGE_ACCESS_TOKEN.value();
  await sendMessengerImage(psid, String(imageUrl).trim(), token);

  const safeCaption =
    String(caption || "").trim() ||
    `📸 Atlas Photo Update\nTracking: ${normalizeTracking(tr.trackingNumber || trackingNumber)}`;

  await sendMessengerText(psid, safeCaption.slice(0, 900), token);

  await db.collection("message_logs").add({
    channel: "MESSENGER",
    type: "PHOTO",
    trackingNumber: normalizeTracking(tr.trackingNumber || trackingNumber),
    phone,
    psid,
    imageUrl: String(imageUrl).trim(),
    caption: safeCaption,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    source: "sendMessengerPhotoUpdate",
  });
};
