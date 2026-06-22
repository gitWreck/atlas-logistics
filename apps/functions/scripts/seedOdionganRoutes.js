"use strict";

const { Timestamp } = require("firebase-admin/firestore");
const { initAdminApp } = require("./initAdmin");
const {
  ODIONGAN_SEED_ROUTES,
  buildRouteDoc,
} = require("../src/routes/routeHelpers");

async function main() {
  initAdminApp();
  const admin = require("firebase-admin");
  const db = admin.firestore();
  const now = Timestamp.now();

  let created = 0;
  let updated = 0;

  for (const route of ODIONGAN_SEED_ROUTES) {
    const ref = db.collection("routes").doc(route.routeId);
    const existing = await ref.get();
    const payload = buildRouteDoc(route, {
      now,
      ...(existing.exists ? { createdAt: existing.data()?.createdAt || now } : {}),
    });

    if (existing.exists) {
      await ref.set(payload, { merge: true });
      updated += 1;
      console.log(`Updated route ${route.routeId}`);
    } else {
      await ref.set(payload);
      created += 1;
      console.log(`Created route ${route.routeId}`);
    }
  }

  console.log(`Done. Created ${created}, updated ${updated}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
