import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migratePhones() {
  const snap = await db.collection("tracking_records").get();

  let migrated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data.customerPhone) continue;

    await db
      .collection("tracking_private")
      .doc(doc.id)
      .set(
        {
          customerPhone: data.customerPhone,
          migratedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

    migrated++;
    console.log(`✔ Migrated ${doc.id}`);
  }

  console.log(`\n✅ Migration complete: ${migrated} records`);
}

migratePhones().catch(console.error);
