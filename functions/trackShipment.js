"use strict";

/**
 * =========================================================
 * 🌍 PUBLIC SHIPMENT TRACKING (READ-ONLY)
 * ---------------------------------------------------------
 * • No Firestore exposure
 * • No auth required
 * • Sanitized public response
 * • Status timeline included
 * • Node 20 / Functions v2 / CommonJS
 * =========================================================
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

/* ---------------------------------------------------------
   INIT (IDEMPOTENT)
--------------------------------------------------------- */
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/* ---------------------------------------------------------
   FUNCTION
--------------------------------------------------------- */
exports.trackShipment = onRequest(
  {
    region: "asia-southeast1",
    cors: true
  },
  async (req, res) => {
    try {
      /* ===============================
         METHOD GUARD
      =============================== */
      if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      /* ===============================
         INPUT NORMALIZATION
      =============================== */
      const tracking = String(req.query.tracking || "")
        .trim()
        .toUpperCase();

      if (!tracking || tracking.length > 64) {
        return res.json({ found: false });
      }

      /* ===============================
         FETCH SHIPMENT
      =============================== */
      const snap = await db
        .collection("tracking_records")
        .where("trackingNumber", "==", tracking)
        .limit(1)
        .get();

      if (snap.empty) {
        return res.json({
          found: false,
          trackingNumber: tracking
        });
      }

      const shipDoc = snap.docs[0];
      const d = shipDoc.data();

      /* ===============================
         FETCH STATUS TIMELINE
      =============================== */
      const eventsSnap = await shipDoc.ref
        .collection("status_events")
        .orderBy("statusIndex", "asc")
        .limit(20)
        .get();

      const timeline = eventsSnap.docs.map(doc => {
        const e = doc.data() || {};
        return {
          status: e.status || "",
          statusIndex: Number.isInteger(e.statusIndex)
            ? e.statusIndex
            : null,
          at: e.at?.toDate
            ? e.at.toDate().toISOString()
            : null
        };
      });

      /* ===============================
         PUBLIC RESPONSE (SANITIZED)
      =============================== */
      return res.json({
        found: true,

        trackingNumber: d.trackingNumber,
        origin: d.origin,
        destination: d.destination,

        status: d.status,
        statusIndex: d.statusIndex,

        currentTruckTripId: d.currentTruckTripId || null,

        timeline,

        createdAt: d.createdAt?.toMillis
          ? d.createdAt.toMillis()
          : null
      });

    } catch (err) {
      console.error("🚨 trackShipment error:", err);
      return res.status(500).json({
        found: false,
        error: "Internal server error"
      });
    }
  }
);
