import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

const CLOSED_STATUSES = new Set(["CLOSED", "COMPLETED", "CANCELLED"]);

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function getTimestampMs(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value?._seconds) return value._seconds * 1000;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function computeManifestStats(shipments = []) {
  const stats = {
    total: shipments.length,
    delivered: 0,
    failed: 0,
    returned: 0,
    outForDelivery: 0,
    remaining: 0,
  };

  shipments.forEach((shipment) => {
    const status = normalizeStatus(shipment?.status);
    if (status === "DELIVERED" || status === "COMPLETED") {
      stats.delivered += 1;
      return;
    }
    if (status === "FAILED_DELIVERY") {
      stats.failed += 1;
      return;
    }
    if (status === "RECEIVED" && !shipment?.assignedCheckerId) {
      stats.returned += 1;
      return;
    }
    if (status === "OUT_FOR_DELIVERY") {
      stats.outForDelivery += 1;
      return;
    }
    stats.remaining += 1;
  });

  return stats;
}

export function deriveManifestDisplayStatus(manifest, stats) {
  if (stats.outForDelivery > 0) return "OUT_FOR_DELIVERY";
  if (stats.failed > 0 && stats.remaining === 0 && stats.outForDelivery === 0) {
    return "FAILED_DELIVERY";
  }
  if (
    stats.delivered === stats.total &&
    stats.total > 0
  ) {
    return "COMPLETED";
  }
  const manifestStatus = normalizeStatus(manifest?.status);
  if (manifestStatus === "LOADED") return "LOADED";
  if (manifestStatus === "DRAFT") return "RELEASED";
  return manifestStatus || "RELEASED";
}

async function fetchShipmentsByIds(ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const entries = await Promise.all(
    uniqueIds.map(async (shipmentId) => {
      try {
        const snap = await getDoc(doc(db, "shipments", String(shipmentId)));
        if (!snap.exists()) return null;
        return [snap.id, { id: snap.id, ...snap.data() }];
      } catch (error) {
        console.warn("Failed to load shipment for manifest:", shipmentId, error);
        return null;
      }
    }),
  );

  return Object.fromEntries(entries.filter(Boolean));
}

export function useDeliveryManifests(checkerId) {
  const [manifests, setManifests] = useState([]);
  const [shipmentsById, setShipmentsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshManifestShipments = useCallback(async (manifestList) => {
    const shipmentIds = manifestList.flatMap((manifest) =>
      Array.isArray(manifest.shipmentIds) ? manifest.shipmentIds : [],
    );
    if (shipmentIds.length === 0) {
      return;
    }

    const fetched = await fetchShipmentsByIds(shipmentIds);
    setShipmentsById((current) => ({ ...current, ...fetched }));
  }, []);

  useEffect(() => {
    if (!checkerId) {
      setManifests([]);
      setShipmentsById({});
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const manifestQuery = query(
      collection(db, "delivery_manifests"),
      where("checkerId", "==", String(checkerId)),
    );

    const unsubManifests = onSnapshot(
      manifestQuery,
      async (snap) => {
        const nextManifests = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter(
            (manifest) =>
              !CLOSED_STATUSES.has(normalizeStatus(manifest.status)),
          )
          .sort(
            (a, b) =>
              getTimestampMs(b.updatedAt || b.releasedAt) -
              getTimestampMs(a.updatedAt || a.releasedAt),
          );

        setManifests(nextManifests);
        await refreshManifestShipments(nextManifests);
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Delivery manifests snapshot failed:", snapshotError);
        setError(snapshotError);
        setLoading(false);
      },
    );

    const mergeShipmentSnapshot = (snap) => {
      const nextMap = {};
      snap.docs.forEach((docSnap) => {
        nextMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
      });
      setShipmentsById((current) => ({ ...current, ...nextMap }));
    };

    const assignedQuery = query(
      collection(db, "shipments"),
      where("assignedCheckerId", "==", String(checkerId)),
    );
    const availableQuery = query(
      collection(db, "shipments"),
      where("availableForDelivery", "==", true),
    );

    const unsubAssigned = onSnapshot(
      assignedQuery,
      mergeShipmentSnapshot,
      (snapshotError) => {
        console.warn("Assigned shipments snapshot for manifests failed:", snapshotError);
      },
    );

    const unsubAvailable = onSnapshot(
      availableQuery,
      mergeShipmentSnapshot,
      (snapshotError) => {
        console.warn("Available shipments snapshot for manifests failed:", snapshotError);
      },
    );

    return () => {
      unsubManifests();
      unsubAssigned();
      unsubAvailable();
    };
  }, [checkerId, refreshManifestShipments]);

  const enrichedManifests = useMemo(() => {
    return manifests.map((manifest) => {
      const shipmentIds = Array.isArray(manifest.shipmentIds)
        ? manifest.shipmentIds
        : [];
      const shipments = shipmentIds
        .map((shipmentId) => shipmentsById[String(shipmentId)])
        .filter(Boolean);
      const stats = computeManifestStats(shipments);
      const displayStatus = deriveManifestDisplayStatus(manifest, stats);

      return {
        ...manifest,
        shipments,
        stats,
        displayStatus,
      };
    });
  }, [manifests, shipmentsById]);

  const summary = useMemo(() => {
    return enrichedManifests.reduce(
      (acc, manifest) => {
        acc.manifestCount += 1;
        acc.totalPackages += manifest.stats.total;
        acc.delivered += manifest.stats.delivered;
        acc.failed += manifest.stats.failed;
        acc.remaining += manifest.stats.remaining;
        acc.outForDelivery += manifest.stats.outForDelivery;
        return acc;
      },
      {
        manifestCount: 0,
        totalPackages: 0,
        delivered: 0,
        failed: 0,
        remaining: 0,
        outForDelivery: 0,
      },
    );
  }, [enrichedManifests]);

  return {
    manifests: enrichedManifests,
    summary,
    loading,
    error,
  };
}
