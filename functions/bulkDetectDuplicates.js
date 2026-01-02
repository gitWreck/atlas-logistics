"use strict";

/**
 * ======================================================
 * ATLAS — bulkDetectDuplicates (Option B)
 *
 * PURPOSE:
 * - Detect duplicate shipments BEFORE creation
 * - Used by:
 *   ✅ Browser UI (preview & warning)
 *   ✅ bulkCreateShipments (server enforcement)
 *
 * DUPLICATE RULE (SAFE DEFAULT):
 * - Same customerPhone
 * - Same originCode
 * - Same destinationCode
 * - archived == false
 *
 * ROLE RULES:
 * - Admin / Manager may preview
 * - Only Admin may override later
 * ======================================================
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { assertAdminOrManager } = require("./_shared");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ======================================================
   HELPERS
====================================================== */
function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[^\d]/g, "");
  if (p.startsWith("09")) p = "63" + p.slice(1);
  if (p.startsWith("9") && p.length === 10) p = "63" + p;
  if (p.startsWith("63") && p.length === 12) return p;
  return null;
}

function requireString(v, field) {
  if (!v || !String(v).trim()) {
    throw new HttpsError("invalid-argument", `${field} is required`);
  }
  return String(v).trim();
}

function buildDuplicateKey({ phone, originCode, destinationCode }) {
  const raw = `${phone}|${originCode}|${destinationCode}`.toLowerCase();
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/* ======================================================
   FUNCTION
====================================================== */
exports.bulkDetectDuplicates = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    const actor = await assertAdminOrManager(req);
    const { uid, role } = actor;

    const rows = req.data?.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new HttpsError("invalid-argument", "rows[] is required");
    }

    if (rows.length > 500) {
      throw new HttpsError(
        "failed-precondition",
        "Max 500 rows per check"
      );
    }

    /* --------------------------------------------
       1️⃣ Build dedupe keys from input
    -------------------------------------------- */
    const rowMeta = [];
    const keyToRows = new Map();

    rows.forEach((r, idx) => {
      try {
        const phone = normalizePhone(r.customerPhone);
        const originCode = requireString(r.originCode, "originCode");
        const destinationCode = requireString(
          r.destinationCode,
          "destinationCode"
        );

        if (!phone) return;

        const duplicateKey = buildDuplicateKey({
          phone,
          originCode,
          destinationCode,
        });

        rowMeta.push({
          row: idx + 1,
          phone,
          originCode,
          destinationCode,
          duplicateKey,
        });

        if (!keyToRows.has(duplicateKey)) {
          keyToRows.set(duplicateKey, []);
        }
        keyToRows.get(duplicateKey).push(idx + 1);
      } catch {
        /* row-level validation handled elsewhere */
      }
    });

    /* --------------------------------------------
       2️⃣ Query Firestore (ONE per key)
    -------------------------------------------- */
    const duplicates = [];

    for (const [key, rowNumbers] of keyToRows.entries()) {
      const snap = await db
        .collection("tracking_records")
        .where("duplicateKey", "==", key)
        .where("archived", "==", false)
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        const d = doc.data();

        duplicates.push({
          duplicateKey: key,
          existingShipmentId: doc.id,
          existingTrackingNumber: d.trackingNumber || null,
          rows: rowNumbers,
          route: `${d.originCode || "?"} → ${d.destinationCode || "?"}`,
          phone: d.customerPhone || null,
          status: d.status || null,
          createdAt: d.createdAt || null,
        });
      }
    }

    /* --------------------------------------------
       3️⃣ Audit (preview only)
    -------------------------------------------- */
    await db.collection("admin_logs").add({
      action: "DUPLICATE_PREVIEW",
      actorId: uid,
      actorRole: role,
      inputRows: rows.length,
      duplicateGroups: duplicates.length,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    /* --------------------------------------------
       4️⃣ Response
    -------------------------------------------- */
    return {
      ok: true,
      checked: rows.length,
      duplicateGroups: duplicates.length,
      duplicates,
    };
  }
);
