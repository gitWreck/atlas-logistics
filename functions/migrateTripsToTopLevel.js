const admin = require("firebase-admin");

module.exports = async function migrateTripsToTopLevel(req, res) {
  const db = admin.firestore();

  const shipments = await db.collection("tracking_records").get();
  let migrated = 0;

  for (const shipDoc of shipments.docs) {
    const trackingId = shipDoc.id;

    const trips = await shipDoc.ref.collection("truck_trips").get();

    for (const tripDoc of trips.docs) {
      const tripId = tripDoc.id;
      const tripData = tripDoc.data();

      const newTripRef = db.collection("truck_trips").doc(tripId);

      // Write trip to top-level
      await newTripRef.set({
        ...tripData,
        trackingId,
        migratedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Copy trip_packages
      const packages = await tripDoc.ref.collection("trip_packages").get();

      for (const pkgDoc of packages.docs) {
        const pkgData = pkgDoc.data();

        const newPkgRef = newTripRef
          .collection("trip_packages")
          .doc(pkgDoc.id);

        await newPkgRef.set({
          ...pkgData,
          trackingId,
          tripId
        }, { merge: true });

        // Copy status_events
        const events = await pkgDoc.ref.collection("status_events").get();

        for (const ev of events.docs) {
          await newPkgRef
            .collection("status_events")
            .doc(ev.id)
            .set(ev.data());
        }
      }

      // Back-link shipment
      await shipDoc.ref.update({
        tripDocId: tripId,
        tripMigrated: true
      });

      migrated++;
    }
  }

  res.send(`✅ Migrated ${migrated} trips to top-level`);
};
