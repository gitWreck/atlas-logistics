"use strict";

/* =========================================================
   Backfill shipment.municipality from destination / recipient.

   Usage (from apps/functions):
     DRY_RUN=1 node scripts/backfillShipmentMunicipalities.js
     SHIPMENT_ID=AT-20260612-SHP-123456 node scripts/backfillShipmentMunicipalities.js
     LIMIT=500 node scripts/backfillShipmentMunicipalities.js
     ONLY_MISSING=0 node scripts/backfillShipmentMunicipalities.js
========================================================= */

const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { initAdminApp } = require("./initAdmin");
const {
  canonicalMunicipalityLabel,
  resolveShipmentMunicipality,
} = require("../shared/deliveryMunicipalities");

const DRY_RUN = process.env.DRY_RUN === "1";
const SHIPMENT_ID = process.env.SHIPMENT_ID || null;
const LIMIT = Number(process.env.LIMIT || 500);
const ONLY_MISSING = process.env.ONLY_MISSING !== "0";

async function main() {
  initAdminApp();
  const db = admin.firestore();

  let docs = [];

  if (SHIPMENT_ID) {
    const direct = await db.collection("shipments").doc(SHIPMENT_ID).get();
    if (direct.exists) {
      docs = [direct];
    } else {
      const querySnap = await db
        .collection("shipments")
        .where("shipmentId", "==", SHIPMENT_ID)
        .limit(1)
        .get();
      docs = querySnap.docs;
    }

    if (!docs.length) {
      console.error(`Shipment not found: ${SHIPMENT_ID}`);
      process.exit(1);
    }
  } else {
    const snap = await db.collection("shipments").limit(LIMIT).get();
    docs = snap.docs;
  }

  let scanned = 0;
  let updated = 0;
  let skippedHasMunicipality = 0;
  let skippedUnresolved = 0;
  let unchanged = 0;

  for (const docSnap of docs) {
    scanned += 1;
    const data = docSnap.data() || {};
    const existing = canonicalMunicipalityLabel(data.municipality);

    if (ONLY_MISSING && existing) {
      skippedHasMunicipality += 1;
      continue;
    }

    const resolved = resolveShipmentMunicipality(data);
    if (!resolved) {
      skippedUnresolved += 1;
      console.log(
        `[skip] ${docSnap.id} — could not resolve municipality (destination=${data.destination || "—"})`,
      );
      continue;
    }

    if (existing === resolved) {
      unchanged += 1;
      continue;
    }

    updated += 1;
    console.log(
      `${DRY_RUN ? "[dry-run] " : ""}update ${docSnap.id}: ${existing || "—"} -> ${resolved}`,
    );

    if (!DRY_RUN) {
      await docSnap.ref.set(
        {
          municipality: resolved,
          municipalityBackfilledAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  console.log("");
  console.log(`Scanned: ${scanned}`);
  console.log(`Updated: ${updated}${DRY_RUN ? " (dry run)" : ""}`);
  console.log(`Already set: ${skippedHasMunicipality}`);
  console.log(`Unchanged (same value): ${unchanged}`);
  console.log(`Unresolved: ${skippedUnresolved}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { main };
