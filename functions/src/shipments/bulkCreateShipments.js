"use strict";

/**
 * ======================================================
 * ATLAS — bulkCreateShipments (Option B, DUPLICATE SAFE)
 *
 * ✅ Server-authoritative
 * ✅ Manager can create (NO duplicates allowed)
 * ✅ Admin can override duplicates
 * ✅ Uses deterministic duplicateKey
 * ✅ Batched writes (Firestore safe)
 * ======================================================
 */

const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const crypto = require("crypto");
const { assertAdminOrManager, nowTs } = require("./../../_shared");

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

function requireRow(row, key) {
  const v = row?.[key];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing ${key}`);
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
exports.bulkCreateShipments = onCall(
  { region: "asia-southeast1" },
  async (req) => {
    const actor = await assertAdminOrManager(req);
    const { uid, role } = actor;

    const rows = req.data?.rows;
    const allowDuplicates = req.data?.allowDuplicates === true;

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new HttpsError("invalid-argument", "rows[] is required.");
    }

    if (rows.length > 500) {
      throw new HttpsError("invalid-argument", "Max 500 rows per batch.");
    }

    // 🔒 Manager may NEVER override duplicates
    if (allowDuplicates && role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Only admin may override duplicate detection"
      );
    }

    const createdIds = [];
    const errors = [];
    const duplicateHits = [];

    /* --------------------------------------------
       1️⃣ Pre-scan duplicates (server authoritative)
    -------------------------------------------- */
    const rowMeta = [];

    rows.forEach((r, i) => {
      try {
        const phone = normalizePhone(r.customerPhone);
        const originCode = requireRow(r, "originCode");
        const destinationCode = requireRow(r, "destinationCode");

        if (!phone) return;

        const duplicateKey = buildDuplicateKey({
          phone,
          originCode,
          destinationCode,
        });

        rowMeta.push({
          row: i + 1,
          duplicateKey,
          phone,
          originCode,
          destinationCode,
        });
      } catch {
        /* handled later */
      }
    });

    for (const meta of rowMeta) {
      const snap = await db
        .collection("tracking_records")
        .where("duplicateKey", "==", meta.duplicateKey)
        .where("archived", "==", false)
        .limit(1)
        .get();

      if (!snap.empty) {
        duplicateHits.push({
          row: meta.row,
          existingShipmentId: snap.docs[0].id,
        });
      }
    }

    if (duplicateHits.length && !allowDuplicates) {
      throw new HttpsError(
        "failed-precondition",
        "Duplicate shipments detected",
        { duplicates: duplicateHits }
      );
    }

    /* --------------------------------------------
       2️⃣ Batched create
    -------------------------------------------- */
    let batch = db.batch();
    let batchCount = 0;

    const commitBatch = async () => {
      if (batchCount === 0) return;
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      try {
        const customerName = requireRow(r, "customerName");
        const customerPhone = normalizePhone(r.customerPhone);
        const originCode = requireRow(r, "originCode");
        const destinationCode = requireRow(r, "destinationCode");

        if (!customerPhone) {
          throw new Error("Invalid customerPhone");
        }

        const duplicateKey = buildDuplicateKey({
          phone: customerPhone,
          originCode,
          destinationCode,
        });

        const ref = db.collection("tracking_records").doc();

        batch.set(ref, {
          customerName,
          customerPhone,
          originCode,
          destinationCode,
          originLabel: String(r.originLabel || "").trim(),
          destinationLabel: String(r.destinationLabel || "").trim(),

          status: "RECEIVED",
          statusIndex: 0,

          duplicateKey,
          archived: false,

          createdAt: nowTs(),
          createdBy: uid,
          createdRole: role,

          lastUpdatedAt: nowTs(),
          lastUpdatedBy: uid,
          lastUpdatedRole: role,
        });

        createdIds.push(ref.id);
        batchCount++;

        if (batchCount >= 450) {
          await commitBatch();
        }
      } catch (e) {
        errors.push({
          row: i + 1,
          message: e.message || String(e),
        });
      }
    }

    await commitBatch();

    /* --------------------------------------------
       3️⃣ Audit
    -------------------------------------------- */
    await db.collection("admin_logs").add({
      action: "BULK_CREATE_SHIPMENTS",
      actorId: uid,
      actorRole: role,
      totalRows: rows.length,
      created: createdIds.length,
      duplicatesOverridden: allowDuplicates ? duplicateHits.length : 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      created: createdIds.length,
      createdIds,
      failed: errors.length,
      errors,
      duplicatesOverridden: allowDuplicates ? duplicateHits : [],
    };
  }
);
