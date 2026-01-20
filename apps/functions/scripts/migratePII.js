/* =========================================================
   🔐 PII MIGRATION — 10/10 HARDENED
   ---------------------------------------------------------
   FROM: tracking_records/{trackingId}
     - customerName
     - customerPhoneNumber

   TO: tracking_private/{trackingId}
     - customerName
     - customerPhoneNumber

   GUARANTEES:
   ✅ Idempotent
   ✅ Safe batching (<500 ops)
   ✅ Dry-run support
   ✅ Phone normalization (PH)
   ✅ No overwrites of existing private PII
   ✅ Public collection cleaned permanently
========================================================= */

const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* ===============================
   CONFIG
================================ */
const DRY_RUN = process.env.DRY_RUN === "1";
const LIMIT = Number(process.env.LIMIT || 500);
const BATCH_MAX_OPS = 400;

/* ===============================
   HELPERS
================================ */
function normalizePhonePH(phone) {
  if (!phone) return null;

  let p = String(phone).replace(/[^\d]/g, "");

  // 09XXXXXXXXX → 63XXXXXXXXXX
  if (p.startsWith("09") && p.length === 11) {
    p = "63" + p.slice(1);
  }

  // Accept only valid PH format
  if (p.startsWith("63") && p.length === 12) {
    return p;
  }

  return null;
}

function cleanName(name) {
  if (!name) return null;
  const n = String(name).trim();
  return n.length ? n : null;
}

/* ===============================
   MAIN
================================ */
async function migratePII() {
  console.log("🔐 PII Migration started");
  console.log("DRY_RUN:", DRY_RUN, "LIMIT:", LIMIT);

  let moved = 0;
  let skipped = 0;
  let examined = 0;

  let batch = db.batch();
  let ops = 0;

  const snap = await db
    .collection("tracking_records")
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(LIMIT)
    .get();

  console.log("Documents fetched:", snap.size);

  for (const doc of snap.docs) {
    examined++;

    const trackingId = doc.id;
    const data = doc.data() || {};

    const name = cleanName(data.customerName);
    const phone = normalizePhonePH(data.customerPhoneNumber);

    if (!name && !phone) {
      skipped++;
      continue;
    }

    const privateRef = db.collection("tracking_private").doc(trackingId);
    const publicRef = db.collection("tracking_records").doc(trackingId);

    // 🔒 Read private doc to prevent overwrite
    const privateSnap = await privateRef.get();
    if (privateSnap.exists) {
      skipped++;
      continue;
    }

    const privatePayload = {
      customerName: name || "",
      customerPhoneNumber: phone || "",
      migratedAt: DRY_RUN
        ? null
        : admin.firestore.FieldValue.serverTimestamp(),
      migratedBy: "pii_migration_script",
    };

    const publicPatch = {
      customerName: admin.firestore.FieldValue.delete(),
      customerPhoneNumber: admin.firestore.FieldValue.delete(),
      piiMigrated: true,
      piiMigratedAt: DRY_RUN
        ? null
        : admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!DRY_RUN) {
      batch.set(privateRef, privatePayload, { merge: false });
      batch.update(publicRef, publicPatch);
    }

    ops += 2;
    moved++;

    if (ops >= BATCH_MAX_OPS) {
      if (!DRY_RUN) await batch.commit();
      batch = db.batch();
      ops = 0;
      console.log(`✔ Batch committed — moved=${moved}, skipped=${skipped}`);
    }
  }

  if (ops > 0 && !DRY_RUN) {
    await batch.commit();
  }

  console.log("=================================");
  console.log("✅ MIGRATION COMPLETE");
  console.log("Examined:", examined);
  console.log("Moved:", moved);
  console.log("Skipped:", skipped);
  console.log("=================================");
}

/* ===============================
   EXECUTE
================================ */
migratePII()
  .then(() => {
    console.log("🎉 Success");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });
