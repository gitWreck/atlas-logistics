import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

export async function fetchShipmentsByIds(ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const entries = await Promise.all(
    uniqueIds.map(async (shipmentId) => {
      try {
        const snap = await getDoc(doc(db, "shipments", String(shipmentId)));
        if (!snap.exists()) return null;
        return [snap.id, { id: snap.id, ...snap.data() }];
      } catch (error) {
        console.warn("Failed to load shipment:", shipmentId, error);
        return null;
      }
    }),
  );

  return Object.fromEntries(entries.filter(Boolean));
}

export function collectShipmentIdsFromManifests(manifestDocs = []) {
  const ids = new Set();
  manifestDocs.forEach((manifest) => {
    const lists = [
      manifest.shipmentIds,
      manifest.loadedShipmentIds,
    ];
    lists.forEach((list) => {
      if (!Array.isArray(list)) return;
      list.forEach((id) => {
        if (id) ids.add(String(id));
      });
    });
  });
  return [...ids];
}
