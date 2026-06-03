"use strict";

/**
 * messengerWebhook (HTTP)
 * ---------------------------------------------------------
 * ✅ Verify token handshake
 * ✅ Receives messages
 * ✅ Stores PSID link in messenger_links
 * ✅ Replies with shipment status (optional)
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { requireNormalizedPhone } = require("../../utilities/phoneHelpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const FB_VERIFY_TOKEN = defineSecret("FB_VERIFY_TOKEN");
const FB_PAGE_ACCESS_TOKEN = defineSecret("FB_PAGE_ACCESS_TOKEN");

function normalizeTracking(s) {
  return String(s || "").trim().toUpperCase();
}

async function sendMessengerText(psid, text, accessToken) {
  const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: psid },
      message: { text },
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`FB send failed ${res.status}: ${t}`.slice(0, 300));
  }
  return await res.json().catch(() => ({}));
}

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

            await sendMessengerText(psid, "✅ Atlas: Phone linked. Send your Tracking Number to get updates.", accessToken);
            continue;
          }

          // 2) If tracking number, fetch shipment and reply; also link if we can match phone
          const snap = await db.collection("tracking_records").where("trackingNumber", "==", maybeTracking).limit(1).get();

          if (snap.empty) {
            await sendMessengerText(psid, "❌ Tracking not found. Please check and try again.", accessToken);
            continue;
          }

          const shipDoc = snap.docs[0];
          const d = shipDoc.data() || {};
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
