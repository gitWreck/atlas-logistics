const admin = require("firebase-admin");
const fs = require("fs");

// 🔑 Load service account
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrate() {
  console.log("\n🚀 Atlas Trip Migration Started\n");

  const trackingSnap = await db.collection("tracking_records").get();

  let movedTrips = 0;
  let movedPackages = 0;
  let movedEvents = 0;

  for (const trDoc of trackingSnap.docs) {
    const trId = trDoc.id;

    const nestedTrips = await trDoc.ref.collection("truck_trips").get();
    if (nestedTrips.empty) continue;

    console.log(`\n📦 tracking_record: ${trId}`);

    for (const tripDoc of nestedTrips.docs) {
      const tripId = tripDoc.id;
      const tripData = tripDoc.data();

      const topTripRef = db.collection("truck_trips").doc(tripId);
      const exists = await topTripRef.get();

      if (!exists.exists) {
        await topTripRef.set(tripData);
        console.log(`  🚛 Trip moved → truck_trips/${tripId}`);
        movedTrips++;
      } else {
        console.log(`  ⚠️ Trip already exists → ${tripId}`);
      }

      // 🔄 Update tracking_records.tripDocId
      await trDoc.ref.update({
        tripDocId: tripId,
      });

      // 📦 Move trip_packages
      const pkgSnap = await tripDoc.ref.collection("trip_packages").get();

      for (const pkgDoc of pkgSnap.docs) {
        const pkgId = pkgDoc.id;
        const pkgData = pkgDoc.data();

        const newPkgRef = topTripRef.collection("trip_packages").doc(pkgId);
        await newPkgRef.set(pkgData);
        movedPackages++;

        // 📜 Move status_events
        const eventSnap = await pkgDoc.ref.collection("status_events").get();

        for (const evDoc of eventSnap.docs) {
          await newPkgRef
            .collection("status_events")
            .doc(evDoc.id)
            .set(evDoc.data());
          movedEvents++;
        }

        // Delete old events
        for (const evDoc of eventSnap.docs) {
          await evDoc.ref.delete();
        }

        await pkgDoc.ref.delete();
      }

      // Delete old nested trip
      await tripDoc.ref.delete();
    }
  }

  console.log("\n✅ MIGRATION COMPLETE");
  console.log(`🚛 Trips moved: ${movedTrips}`);
  console.log(`📦 Packages moved: ${movedPackages}`);
  console.log(`📜 Status events moved: ${movedEvents}`);
  console.log("\n🔥 Atlas is now top-level trip architecture compliant.\n");

  process.exit();
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
});
