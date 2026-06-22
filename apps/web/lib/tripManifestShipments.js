function packageQty(pkg = {}) {
  return Math.max(Number(pkg.quantity) || 1, 1);
}

const TRIP_SCOPED_STATUSES = new Set([
  "LOADED",
  "LOADED_TO_TRIP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "ARRIVED_AT_ODIONGAN",
  "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
  "RELEASED_FOR_DELIVERY",
  "AVAILABLE_FOR_DELIVERY",
  "READY_FOR_DELIVERY",
  "LOADED_TO_DELIVERY_VEHICLE",
  "DELIVERED",
  "COMPLETED",
  "FAILED_DELIVERY",
  "RETURNED_TO_WAREHOUSE",
  "RETURNED_RECEIVED_AT_HUB",
  "RETURNED_RECEIVED_AT_ODIONGAN",
]);

function packageBelongsToTrip(pkg, tripDocId, tripBarcodeSet) {
  const packageTripId = pkg.currentTripId || pkg.loadedOnTrip || null;
  const packageId = pkg.packageId || pkg.trackingNumber || null;

  if (packageTripId) return packageTripId === tripDocId;
  if (!packageId || !tripBarcodeSet.has(String(packageId))) return false;

  const loadedQty = Math.min(Number(pkg.loadedQty) || 0, packageQty(pkg));
  const receivedQty = Math.min(Number(pkg.receivedQty) || 0, packageQty(pkg));
  if (loadedQty > 0 || receivedQty > 0) return true;

  return TRIP_SCOPED_STATUSES.has(String(pkg.status || "").toUpperCase());
}

export async function loadTripManifestShipments(adminDb, tripDocId) {
  if (!tripDocId) return [];

  const tripShipmentsSnap = await adminDb
    .collection("truck_trips")
    .doc(tripDocId)
    .collection("trip_shipments")
    .get();

  if (!tripShipmentsSnap.empty) {
    const shipmentIds = tripShipmentsSnap.docs.map((doc) => doc.id);
    const rootSnaps = shipmentIds.length
      ? await adminDb.getAll(
          ...shipmentIds.map((id) => adminDb.collection("shipments").doc(id)),
        )
      : [];

    const rootMap = {};
    rootSnaps.forEach((snap) => {
      if (snap.exists) rootMap[snap.id] = snap.data();
    });

    return tripShipmentsSnap.docs.map((doc) => {
      const data = doc.data() || {};
      const root = rootMap[doc.id] || {};
      const rootPackages = Array.isArray(root.packages) ? root.packages : [];
      const tripBarcodeSet = new Set(
        (data.packageBarcodes || []).filter(Boolean).map(String),
      );

      const tripPackages = rootPackages.filter((pkg) =>
        packageBelongsToTrip(pkg, tripDocId, tripBarcodeSet),
      );
      const hasPackageScopedManifest = tripPackages.length > 0 || tripBarcodeSet.size > 0;
      const visiblePackages = hasPackageScopedManifest ? tripPackages : rootPackages;

      return {
        id: doc.id,
        ...data,
        shipmentId: data.shipmentId || root.shipmentId || doc.id,
        trackingShipmentId:
          data.trackingShipmentId || root.trackingNumber || root.shipmentId || doc.id,
        sender: root.sender || data.sender || null,
        recipient: root.recipient || data.recipient || null,
        originCode: root.originCode || data.originCode || null,
        destinationCode: root.destinationCode || data.destinationCode || null,
        destinationCity: root.destinationCity || data.destinationCity || null,
        destination: root.destination || data.destination || null,
        route:
          data.route ||
          root.route ||
          `${root.originCode || data.originCode || "ORG"} -> ${
            root.destinationCode || data.destinationCode || "DEST"
          }`,
        packages: visiblePackages,
        proofOfDelivery: root.proofOfDelivery || null,
        currentTripId: root.currentTripId || data.currentTripId || tripDocId,
      };
    });
  }

  const byCurrentTripSnap = await adminDb
    .collection("shipments")
    .where("currentTripId", "==", tripDocId)
    .get();

  return byCurrentTripSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    shipmentId: doc.data()?.shipmentId || doc.id,
  }));
}
