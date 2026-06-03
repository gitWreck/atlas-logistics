"use strict";

/**
 * messengerWebhook (HTTP) + Photo Push Trigger (Firestore)
 * ---------------------------------------------------------
 * ✅ Verify token handshake
 * ✅ Receives messages
 * ✅ Stores PSID link in messenger_links
 * ✅ Replies with shipment status (optional)
 *
 * ✅ NEW (PHOTO → CUSTOMER):
 * - Listens to tracking_photos/{photoId} creates
 * - Resolves trackingNumber → customer phone → PSID (messenger_links)
 * - Sends image + caption to the correct customer via FB Messenger
 * - Logs to message_logs
 *
 * IMPORTANT:
 * - The photo URL MUST be publicly fetchable by Facebook (use Firebase Storage downloadURL)
 * - Do NOT store secrets in Firestore/JS files. Uses FB_PAGE_ACCESS_TOKEN secret.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { requireNormalizedPhone } = require("../../utilities/phoneHelpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const FB_VERIFY_TOKEN = defineSecret("FB_VERIFY_TOKEN");
const FB_PAGE_ACCESS_TOKEN = defineSecret("FB_PAGE_ACCESS_TOKEN");

/* -------------------- Normalizers -------------------- */

function normalizeTracking(s) {
  return String(s || "").trim().toUpperCase();
}

/* -------------------- Messenger senders -------------------- */

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
      const t = await res.text().catch(() => "");
      throw new Error(`FB send failed ${res.status}: ${t}`.slice(0, 500));
    }
    return await res.json().catch(() => ({}));
  } finally {
    clearTimeout(timeout);
  }
}

async function sendMessengerText(psid, text, accessToken) {
  return fbPost(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`,
    { recipient: { id: psid }, message: { text } }
  );
}

/**
 * Send an image attachment (then optional caption text).
 * NOTE: Messenger "image" attachment doesn't support inline captions reliably,
 * so we send the image first, then a text message.
 */
async function sendMessengerImage(psid, imageUrl, caption, accessToken) {
  await fbPost(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`,
    {
      recipient: { id: psid },
      message: {
        attachment: {
          type: "image",
          payload: {
            url: imageUrl,
            is_reusable: true,
          },
        },
      },
    }
  );

  if (caption && String(caption).trim()) {
    await sendMessengerText(psid, String(caption).trim().slice(0, 900), accessToken);
  }
}

/* -------------------- HTTP Webhook -------------------- */

exports.messengerWebhook = onRequest(
  {
    region: "asia-southeast1",
    cors: false,
    secrets: [FB_VERIFY_TOKEN, FB_PAGE_ACCESS_TOKEN],
  },
  async (req, res) => {
    try {
      // --- Verify (GET) ---
      if (req.method === "GET") {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        if (mode === "subscribe" && token === FB_VERIFY_TOKEN.value()) {
          return res.status(200).send(challenge);
        }
        return res.status(403).send("Forbidden");
      }

      // --- Receive (POST) ---
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      const body = req.body || {};
      const entry = Array.isArray(body.entry) ? body.entry : [];
      const accessToken = FB_PAGE_ACCESS_TOKEN.value();

      for (const e of entry) {
        const messaging = Array.isArray(e.messaging) ? e.messaging : [];
        for (const m of messaging) {
          const psid = m?.sender?.id;
          const text = String(m?.message?.text || "").trim();

          if (!psid || !text) continue;

          // Heuristic: phone or tracking?
          const maybePhone = requireNormalizedPhone(text);
          const maybeTracking = normalizeTracking(text);

          // 1) If phone, link psid -> phone
          if (maybePhone) {
            const linkId = `${maybePhone}__${psid}`;
            await db.collection("messenger_links").doc(linkId).set(
              {
                phone: maybePhone,
                psid,
                active: true,
                connectedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastInboundAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

            await sendMessengerText(
              psid,
              "✅ Atlas: Phone linked. Send your Tracking Number to get updates.",
              accessToken
            );
            continue;
          }

          // 2) If tracking number, fetch shipment and reply; also link if we can match phone
          const snap = await db
            .collection("tracking_records")
            .where("trackingNumber", "==", maybeTracking)
            .limit(1)
            .get();

          if (snap.empty) {
            await sendMessengerText(psid, "❌ Tracking not found. Please check and try again.", accessToken);
            continue;
          }

          const d = snap.docs[0].data() || {};
          const status = d.status || "Unknown";
          const origin = d.origin || "";
          const destination = d.destination || "";

          // If shipment has phone, auto-link
          const phone = requireNormalizedPhone(d.phone || d.customerPhone || "");
          if (phone) {
            const linkId = `${phone}__${psid}`;
            await db.collection("messenger_links").doc(linkId).set(
              {
                phone,
                psid,
                active: true,
                linkedTrackingNumber: maybeTracking,
                lastInboundAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }

          await sendMessengerText(
            psid,
            `📦 Atlas Update\n${maybeTracking}\nRoute: ${origin} → ${destination}\nStatus: ${status}`,
            accessToken
          );
        }
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("messengerWebhook error:", err);
      return res.status(500).json({ ok: false });
    }
  }
);

/* -------------------- Firestore Trigger: Photo → Messenger -------------------- */

/**
 * Collection design (recommended):
 * tracking_photos/{photoId}
 *   - trackingNumber (string, required)
 *   - downloadUrl (string, required)  // Firebase Storage download URL
 *   - caption (string, optional)
 *   - uploadedByUid (string, optional)
 *   - uploadedByRole (string, optional) // driver/checker/manager/admin
 *   - createdAt (timestamp)
 *   - status: "PENDING" | "SENT" | "FAILED" (optional)
 *   - error (string, optional)
 */
exports.pushTrackingPhotoToMessenger = onDocumentCreated(
  {
    document: "tracking_photos/{photoId}",
    region: "asia-southeast1",
    secrets: [FB_PAGE_ACCESS_TOKEN],
  },
  async (event) => {
    const photoId = event.params.photoId;
    const data = event.data?.data() || {};

    const trackingNumber = normalizeTracking(data.trackingNumber);
    const downloadUrl = String(data.downloadUrl || "").trim();
    const caption = String(data.caption || "").trim();

    if (!trackingNumber || !downloadUrl) {
      await db.collection("tracking_photos").doc(photoId).set(
        {
          status: "FAILED",
          error: "Missing trackingNumber or downloadUrl",
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    // 1) Resolve shipment → customer phone
    const snap = await db
      .collection("tracking_records")
      .where("trackingNumber", "==", trackingNumber)
      .limit(1)
      .get();

    if (snap.empty) {
      await db.collection("tracking_photos").doc(photoId).set(
        {
          status: "FAILED",
          error: "Tracking number not found in tracking_records",
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    const tr = snap.docs[0].data() || {};
    const phone = requireNormalizedPhone(tr.phone || tr.customerPhone || "");

    if (!phone) {
      await db.collection("tracking_photos").doc(photoId).set(
        {
          status: "FAILED",
          error: "Customer phone missing/invalid on tracking_records",
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    // 2) Resolve phone → PSID (active link)
    const linkSnap = await db
      .collection("messenger_links")
      .where("phone", "==", phone)
      .where("active", "==", true)
      .limit(1)
      .get();

    if (linkSnap.empty) {
      // Customer hasn't linked messenger yet.
      await db.collection("tracking_photos").doc(photoId).set(
        {
          status: "PENDING",
          reason: "No active messenger_links for customer phone (customer not linked yet)",
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    const psid = linkSnap.docs[0].data()?.psid;
    if (!psid) {
      await db.collection("tracking_photos").doc(photoId).set(
        {
          status: "FAILED",
          error: "messenger_links doc missing psid",
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    // 3) Send image + caption
    const accessToken = FB_PAGE_ACCESS_TOKEN.value();
    const customerCaption =
      caption ||
      `📸 Atlas Photo Update\nTracking: ${trackingNumber}\n(Your package photo has been uploaded.)`;

    try {
      await sendMessengerImage(psid, downloadUrl, customerCaption, accessToken);

      await db.collection("tracking_photos").doc(photoId).set(
        {
          status: "SENT",
          sentToPsid: psid,
          sentToPhone: phone,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await db.collection("message_logs").add({
        channel: "MESSENGER",
        type: "PHOTO",
        trackingNumber,
        phone,
        psid,
        imageUrl: downloadUrl,
        caption: customerCaption,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "pushTrackingPhotoToMessenger",
      });
    } catch (err) {
      await db.collection("tracking_photos").doc(photoId).set(
        {
          status: "FAILED",
          error: String(err?.message || err).slice(0, 500),
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      throw err;
    }
  }
);
