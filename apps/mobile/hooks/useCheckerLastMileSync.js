import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  collectShipmentIdsFromManifests,
} from "../components/utilities/fetchShipmentsByIds";
import {
  countDeliveryPoolPieces,
  getCheckerPieceActionPhase,
  isAvailableToLoadShipment,
  isMyActiveDeliveryShipment,
} from "../components/utilities/checkerDeliveryPool";

const CLOSED_MANIFEST_STATUSES = new Set(["CLOSED", "COMPLETED", "CANCELLED"]);

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

function mergeShipmentMaps(...maps) {
  const byId = new Map();
  maps.forEach((map) => {
    Object.values(map || {}).forEach((shipment) => {
      if (!shipment?.id) return;
      byId.set(shipment.id, shipment);
    });
  });
  return Object.fromEntries(byId);
}

function sortShipmentsNewest(shipments = []) {
  return [...shipments].sort((a, b) => {
    const aMs = a?.updatedAt?.toMillis?.() || 0;
    const bMs = b?.updatedAt?.toMillis?.() || 0;
    return bMs - aMs;
  });
}

/** Badge status for checker UI — prefers this checker's piece state over master. */
export function getCheckerShipmentDisplayStatus(shipment, checkerUid) {
  const phase = getCheckerPieceActionPhase(shipment, checkerUid);
  if (phase === "deliver") return "OUT_FOR_DELIVERY";
  if (phase === "return") return "FAILED_DELIVERY";

  const stats = countDeliveryPoolPieces(shipment, checkerUid);
  if (stats.mine > 0 && stats.delivered >= stats.mine && stats.available === 0) {
    return "DELIVERED";
  }

  return normalizeStatus(shipment?.status) || "RECEIVED";
}

export function computeManifestStats(shipments = [], checkerUid = null) {
  const stats = {
    total: 0,
    delivered: 0,
    failed: 0,
    returned: 0,
    outForDelivery: 0,
    onVan: 0,
    remaining: 0,
  };

  shipments.forEach((shipment) => {
    const pool = countDeliveryPoolPieces(shipment, checkerUid);
    stats.total += pool.total;
    stats.delivered += pool.delivered;
    stats.onVan += pool.mine;

    const masterStatus = normalizeStatus(shipment?.status);
    const phase = checkerUid
      ? getCheckerPieceActionPhase(shipment, checkerUid)
      : null;

    if (masterStatus === "FAILED_DELIVERY" || phase === "return") {
      stats.failed += 1;
      return;
    }
    if (
      masterStatus === "RECEIVED" &&
      !shipment?.assignedCheckerId &&
      pool.mine === 0
    ) {
      stats.returned += 1;
      return;
    }
    if (phase === "deliver" || masterStatus === "OUT_FOR_DELIVERY") {
      stats.outForDelivery += 1;
      return;
    }
    if (pool.mine > 0 || pool.available > 0) {
      stats.remaining += 1;
    }
  });

  return stats;
}

export function deriveManifestDisplayStatus(manifest, stats, shipments = []) {
  const manifestStatus = normalizeStatus(manifest?.status);
  if (manifestStatus === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  if (stats.outForDelivery > 0) return "OUT_FOR_DELIVERY";
  if (stats.failed > 0 && stats.remaining === 0 && stats.outForDelivery === 0) {
    return "FAILED_DELIVERY";
  }
  if (stats.total > 0 && stats.delivered >= stats.total) {
    return "COMPLETED";
  }
  if (stats.onVan > 0 && stats.outForDelivery === 0) {
    return manifestStatus === "LOADED" ? "LOADED" : "LOADED";
  }
  if (manifestStatus === "LOADED") return "LOADED";
  if (manifestStatus === "DRAFT") return "RELEASED";
  return manifestStatus || "RELEASED";
}

/**
 * Single real-time feed for checker last-mile tabs (Available, My Route, My Load).
 */
export function useCheckerLastMileSync(checkerId) {
  const [queryShipments, setQueryShipments] = useState({});
  const [docShipments, setDocShipments] = useState({});
  const [manifests, setManifests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const docUnsubsRef = useRef({});

  useEffect(() => {
    if (!checkerId) {
      setQueryShipments({});
      setDocShipments({});
      setManifests([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);

    let assignedMap = {};
    let availableMap = {};
    let activeMap = {};

    const publishQueries = () => {
      setQueryShipments(mergeShipmentMaps(assignedMap, availableMap, activeMap));
    };

    const assignedQuery = query(
      collection(db, "shipments"),
      where("assignedCheckerId", "==", String(checkerId)),
    );
    const availableQuery = query(
      collection(db, "shipments"),
      where("availableForDelivery", "==", true),
    );
    const activeCheckerQuery = query(
      collection(db, "shipments"),
      where("activeCheckerIds", "array-contains", String(checkerId)),
    );
    const manifestQuery = query(
      collection(db, "delivery_manifests"),
      where("checkerId", "==", String(checkerId)),
    );

    const unsubAssigned = onSnapshot(
      assignedQuery,
      (snap) => {
        assignedMap = {};
        snap.docs.forEach((docSnap) => {
          assignedMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        });
        publishQueries();
      },
      (err) => {
        console.error("Checker assigned shipments failed:", err);
        setError(err);
      },
    );

    const unsubAvailable = onSnapshot(
      availableQuery,
      (snap) => {
        availableMap = {};
        snap.docs.forEach((docSnap) => {
          availableMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        });
        publishQueries();
      },
      (err) => console.warn("Checker available pool failed:", err),
    );

    const unsubActive = onSnapshot(
      activeCheckerQuery,
      (snap) => {
        activeMap = {};
        snap.docs.forEach((docSnap) => {
          activeMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        });
        publishQueries();
      },
      (err) => console.warn("Checker activeCheckerIds failed:", err),
    );

    const unsubManifests = onSnapshot(
      manifestQuery,
      (snap) => {
        const next = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter(
            (m) => !CLOSED_MANIFEST_STATUSES.has(normalizeStatus(m.status)),
          )
          .sort(
            (a, b) =>
              getTimestampMs(b.updatedAt || b.releasedAt) -
              getTimestampMs(a.updatedAt || a.releasedAt),
          );
        setManifests(next);
        setLoading(false);
      },
      (err) => {
        console.error("Checker manifests failed:", err);
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsubAssigned();
      unsubAvailable();
      unsubActive();
      unsubManifests();
    };
  }, [checkerId]);

  const manifestShipmentIds = useMemo(
    () => collectShipmentIdsFromManifests(manifests),
    [manifests],
  );

  const watchedDocIds = useMemo(() => {
    const ids = new Set(manifestShipmentIds);
    Object.keys(queryShipments).forEach((id) => ids.add(id));
    return [...ids];
  }, [manifestShipmentIds, queryShipments]);

  useEffect(() => {
    if (!checkerId) return undefined;

    const wanted = new Set(watchedDocIds.map(String));
    const currentUnsubs = docUnsubsRef.current;

    Object.keys(currentUnsubs).forEach((id) => {
      if (!wanted.has(id)) {
        currentUnsubs[id]();
        delete currentUnsubs[id];
      }
    });

    wanted.forEach((shipmentId) => {
      if (currentUnsubs[shipmentId]) return;

      currentUnsubs[shipmentId] = onSnapshot(
        doc(db, "shipments", shipmentId),
        (snap) => {
          if (!snap.exists()) {
            setDocShipments((prev) => {
              const next = { ...prev };
              delete next[shipmentId];
              return next;
            });
            return;
          }
          setDocShipments((prev) => ({
            ...prev,
            [shipmentId]: { id: snap.id, ...snap.data() },
          }));
        },
        (err) =>
          console.warn("Shipment doc listener failed:", shipmentId, err),
      );
    });

    return () => {
      Object.values(docUnsubsRef.current).forEach((unsub) => unsub());
      docUnsubsRef.current = {};
    };
  }, [checkerId, watchedDocIds.join("|")]);

  const shipmentsById = useMemo(
    () => mergeShipmentMaps(queryShipments, docShipments),
    [queryShipments, docShipments],
  );

  const enrichShipment = (shipment) => {
    if (!shipment?.id) return shipment;
    const fresh = shipmentsById[shipment.id] || shipment;
    return {
      ...fresh,
      poolStats: countDeliveryPoolPieces(fresh, checkerId),
      displayStatus: getCheckerShipmentDisplayStatus(fresh, checkerId),
      actionPhase: getCheckerPieceActionPhase(fresh, checkerId),
    };
  };

  const availableShipments = useMemo(() => {
    return sortShipmentsNewest(
      Object.values(shipmentsById)
        .map(enrichShipment)
        .filter(
          (s) =>
            isAvailableToLoadShipment(s) && (s.poolStats?.available || 0) > 0,
        ),
    );
  }, [shipmentsById, checkerId]);

  const myRouteShipments = useMemo(() => {
    return sortShipmentsNewest(
      Object.values(shipmentsById)
        .map(enrichShipment)
        .filter((s) => isMyActiveDeliveryShipment(s, checkerId))
        .filter(
          (s) =>
            Boolean(s.actionPhase) || (s.poolStats?.mine || 0) > 0,
        ),
    );
  }, [shipmentsById, checkerId]);

  const enrichedManifests = useMemo(() => {
    return manifests.map((manifest) => {
      const shipmentIds = [
        ...new Set(
          [
            ...(Array.isArray(manifest.shipmentIds) ? manifest.shipmentIds : []),
            ...(Array.isArray(manifest.loadedShipmentIds)
              ? manifest.loadedShipmentIds
              : []),
          ].map(String),
        ),
      ];
      const shipments = shipmentIds
        .map((id) => shipmentsById[id])
        .filter(Boolean)
        .map(enrichShipment);
      const stats = computeManifestStats(shipments, checkerId);
      const displayStatus = deriveManifestDisplayStatus(
        manifest,
        stats,
        shipments,
      );

      return {
        ...manifest,
        shipments,
        stats,
        displayStatus,
      };
    });
  }, [manifests, shipmentsById, checkerId]);

  const summary = useMemo(() => {
    return enrichedManifests.reduce(
      (acc, manifest) => {
        acc.manifestCount += 1;
        acc.totalPackages += manifest.stats.total;
        acc.delivered += manifest.stats.delivered;
        acc.failed += manifest.stats.failed;
        acc.remaining += manifest.stats.remaining;
        acc.outForDelivery += manifest.stats.outForDelivery;
        acc.onVan += manifest.stats.onVan;
        return acc;
      },
      {
        manifestCount: 0,
        totalPackages: 0,
        delivered: 0,
        failed: 0,
        remaining: 0,
        outForDelivery: 0,
        onVan: 0,
      },
    );
  }, [enrichedManifests]);

  const routeSummary = useMemo(() => {
    let outForDelivery = 0;
    let onVan = 0;
    myRouteShipments.forEach((s) => {
      if (s.displayStatus === "OUT_FOR_DELIVERY") outForDelivery += 1;
      else if ((s.poolStats?.mine || 0) > 0) onVan += 1;
    });
    return {
      total: myRouteShipments.length,
      outForDelivery,
      onVan,
    };
  }, [myRouteShipments]);

  return {
    loading,
    error,
    shipmentsById,
    manifests: enrichedManifests,
    availableShipments,
    myRouteShipments,
    summary,
    routeSummary,
  };
}
