import { useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager } from "react-native";
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
  isAvailableToLoadShipmentForMunicipalities,
  isMyActiveDeliveryShipment,
} from "../components/utilities/checkerDeliveryPool";
import {
  DELIVERY_MUNICIPALITIES,
  formatMunicipalityList,
  resolveShipmentMunicipality,
} from "../components/utilities/deliveryMunicipalities";
import { useOfflineSync } from "../contexts/OfflineSyncContext";

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

function collectCurrentManifestIds(shipmentsById = {}) {
  return [
    ...new Set(
      Object.values(shipmentsById)
        .map((shipment) => String(shipment?.deliveryManifestId || "").trim())
        .filter(Boolean),
    ),
  ].sort();
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
 * Single real-time feed for checker last-mile tabs (Available, My Deliveries, My Load).
 * @param {string} checkerId
 * @param {{ allMunicipalities?: boolean }} [options] — admin/manager: all routes
 */
export function useCheckerLastMileSync(checkerId, options = {}) {
  const allMunicipalities = options.allMunicipalities === true;
  const {
    isOnline,
    cachedShipmentsById,
    setCachedShipmentsById,
    pendingOperations,
    effectiveShipmentsById,
    warmShipmentCache,
  } = useOfflineSync();
  const [queryShipments, setQueryShipments] = useState({});
  const [docShipments, setDocShipments] = useState({});
  const [manifests, setManifests] = useState([]);
  const [assignedMunicipalities, setAssignedMunicipalities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const docUnsubsRef = useRef({});
  const cacheWarmTimerRef = useRef(null);
  const cacheWarmTaskRef = useRef(null);

  useEffect(() => {
    if (!checkerId) {
      setQueryShipments({});
      setDocShipments({});
      setManifests([]);
      setAssignedMunicipalities([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError(null);

    if (allMunicipalities) {
      setAssignedMunicipalities([...DELIVERY_MUNICIPALITIES]);
      return undefined;
    }

    // Only subscribe to the checker profile here. Shipment queries are created
    // in a separate effect that depends on `assignedMunicipalities` so we can
    // include municipality filters in Firestore queries.
    const unsubCheckerProfile = onSnapshot(
      doc(db, "users", String(checkerId)),
      (snap) => {
        const data = snap.exists() ? snap.data() || {} : {};
        setAssignedMunicipalities(
          Array.isArray(data.assignedMunicipalities)
            ? data.assignedMunicipalities
            : [],
        );
      },
      (err) => console.warn("Checker profile listener failed:", err),
    );

    return () => {
      unsubCheckerProfile();
    };
  }, [checkerId, allMunicipalities]);

  // Subscribe to current shipments using municipality-scoped queries.
  useEffect(() => {
    if (!checkerId) return undefined;

    const availableBuckets = new Map();
    const activeBuckets = new Map();
    let publishTimer = null;

    const publishQueries = () => {
      publishTimer = null;
      setQueryShipments(
        mergeShipmentMaps(
          ...availableBuckets.values(),
          ...activeBuckets.values(),
        ),
      );
      setLoading(false);
    };

    const schedulePublishQueries = () => {
      if (publishTimer) return;
      publishTimer = setTimeout(publishQueries, 0);
    };

    // Helper to batch an array into chunks of size n
    const batchesOf = (arr, n) => {
      const out = [];
      for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
      return out;
    };

    const unsubs = [];

    const subscribeAvailable = (muniFilter = null, bucketKey = "all") => {
      const constraints = [where("availableForDelivery", "==", true)];
      if (muniFilter) constraints.push(where("municipality", "in", muniFilter));
      return onSnapshot(
        query(collection(db, "shipments"), ...constraints),
        (snap) => {
          const nextBucket = {};
          snap.docs.forEach((docSnap) => {
            nextBucket[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
          });
          availableBuckets.set(bucketKey, nextBucket);
          schedulePublishQueries();
        },
        (err) => console.warn("Checker available pool failed:", err),
      );
    };

    const subscribeActive = (muniFilter = null, bucketKey = "all") => {
      const constraints = [
        where("activeCheckerIds", "array-contains", String(checkerId)),
      ];
      if (muniFilter) constraints.push(where("municipality", "in", muniFilter));
      return onSnapshot(
        query(collection(db, "shipments"), ...constraints),
        (snap) => {
          const nextBucket = {};
          snap.docs.forEach((docSnap) => {
            nextBucket[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
          });
          activeBuckets.set(bucketKey, nextBucket);
          schedulePublishQueries();
        },
        (err) => console.warn("Checker activeCheckerIds failed:", err),
      );
    };

    // Admin/manager: all municipalities (no municipality filter on queries).
    if (allMunicipalities) {
      unsubs.push(subscribeAvailable());
      unsubs.push(subscribeActive());
    } else if (
      Array.isArray(assignedMunicipalities) &&
      assignedMunicipalities.length > 0
    ) {
      // available shipments filter (only for assigned municipalities)
      if (assignedMunicipalities.length <= 10) {
        unsubs.push(subscribeAvailable(assignedMunicipalities));
      } else {
        batchesOf(assignedMunicipalities, 10).forEach((batch, index) => {
          unsubs.push(subscribeAvailable(batch, `available-${index}`));
        });
      }

      // activeCheckerQuery (array-contains + municipality)
      if (assignedMunicipalities.length <= 10) {
        unsubs.push(subscribeActive(assignedMunicipalities));
      } else {
        batchesOf(assignedMunicipalities, 10).forEach((batch, index) => {
          unsubs.push(subscribeActive(batch, `active-${index}`));
        });
      }
    } else {
      // no assigned municipalities: clear query shipments so UI shows empty
      setQueryShipments({});
      setLoading(false);
    }

    return () => {
      if (publishTimer) clearTimeout(publishTimer);
      unsubs.forEach((u) => {
        try { u(); } catch (e) { /* ignore */ }
      });
    };
  }, [checkerId, allMunicipalities, assignedMunicipalities.join("|")]);

  const currentManifestIds = useMemo(
    () => collectCurrentManifestIds(queryShipments),
    [queryShipments],
  );

  // A checker may have years of closed manifests. Querying all of them at
  // layout startup made high-history accounts download and parse the full
  // history before taps could be handled. Current shipment documents already
  // carry their manifest ID, so observe only those referenced by live work.
  useEffect(() => {
    if (!checkerId || currentManifestIds.length === 0) {
      setManifests([]);
      return undefined;
    }

    const manifestMap = new Map();
    const publishManifests = () => {
      const next = [...manifestMap.values()]
        .filter(
          (manifest) =>
            !CLOSED_MANIFEST_STATUSES.has(normalizeStatus(manifest.status)),
        )
        .sort(
          (a, b) =>
            getTimestampMs(b.updatedAt || b.releasedAt) -
            getTimestampMs(a.updatedAt || a.releasedAt),
        );
      setManifests(next);
    };

    const unsubs = currentManifestIds.map((manifestId) =>
      onSnapshot(
        doc(db, "delivery_manifests", manifestId),
        (snap) => {
          if (snap.exists()) {
            manifestMap.set(snap.id, { id: snap.id, ...snap.data() });
          } else {
            manifestMap.delete(manifestId);
          }
          publishManifests();
        },
        (err) => {
          console.warn("Checker active manifest failed:", manifestId, err);
          setError(err);
        },
      ),
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [checkerId, currentManifestIds.join("|")]);

  const manifestShipmentIds = useMemo(
    () => collectShipmentIdsFromManifests(manifests),
    [manifests],
  );

  const watchedDocIds = useMemo(() => {
    // Query listeners already stream changes for their result documents.
    // Only add per-document listeners for manifest shipments not covered by
    // one of those queries, avoiding one duplicate listener per shipment.
    return manifestShipmentIds.filter((id) => !queryShipments[String(id)]);
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

  const offlineCacheShipments = useMemo(() => {
    const manifestIds = new Set(manifestShipmentIds.map(String));
    return Object.fromEntries(
      Object.entries(shipmentsById).filter(([shipmentId, shipment]) =>
        manifestIds.has(String(shipmentId)) ||
        isAvailableToLoadShipment(shipment) ||
        isMyActiveDeliveryShipment(shipment, checkerId),
      ),
    );
  }, [shipmentsById, manifestShipmentIds, checkerId]);

  const activeShipmentsById = useMemo(() => {
    if (!isOnline) {
      return effectiveShipmentsById;
    }
    if (pendingOperations.length > 0) {
      return mergeShipmentMaps(shipmentsById, effectiveShipmentsById);
    }
    if (Object.keys(shipmentsById).length > 0) {
      return shipmentsById;
    }
    return effectiveShipmentsById;
  }, [
    isOnline,
    shipmentsById,
    effectiveShipmentsById,
    pendingOperations.length,
  ]);

  useEffect(() => {
    if (!checkerId || !isOnline) return;
    if (Object.keys(offlineCacheShipments).length === 0) return;
    if (cacheWarmTimerRef.current) {
      clearTimeout(cacheWarmTimerRef.current);
    }
    cacheWarmTaskRef.current?.cancel?.();
    cacheWarmTimerRef.current = setTimeout(() => {
      cacheWarmTimerRef.current = null;
      cacheWarmTaskRef.current = InteractionManager.runAfterInteractions(() => {
        cacheWarmTaskRef.current = null;
        void warmShipmentCache(
          offlineCacheShipments,
          { manifests, assignedMunicipalities },
          { publish: false, replace: true },
        );
      });
    }, 3000);
    return () => {
      if (cacheWarmTimerRef.current) {
        clearTimeout(cacheWarmTimerRef.current);
        cacheWarmTimerRef.current = null;
      }
      cacheWarmTaskRef.current?.cancel?.();
      cacheWarmTaskRef.current = null;
    };
  }, [
    checkerId,
    isOnline,
    offlineCacheShipments,
    manifests,
    assignedMunicipalities,
    warmShipmentCache,
  ]);

  useEffect(() => {
    if (Object.keys(cachedShipmentsById).length > 0) {
      setLoading(false);
    }
  }, [cachedShipmentsById]);

  const municipalityLabels = useMemo(
    () =>
      allMunicipalities
        ? [...DELIVERY_MUNICIPALITIES]
        : formatMunicipalityList(assignedMunicipalities),
    [allMunicipalities, assignedMunicipalities],
  );

  const municipalityLabel = useMemo(
    () =>
      allMunicipalities
        ? "All routes"
        : municipalityLabels.length
          ? municipalityLabels.join(", ")
          : null,
    [allMunicipalities, municipalityLabels],
  );

  const hasMunicipalityAssignment =
    allMunicipalities || municipalityLabels.length > 0;

  const enrichShipment = (shipment) => {
    if (!shipment?.id) return shipment;
    const fresh = activeShipmentsById[shipment.id] || shipment;
    const poolStats = countDeliveryPoolPieces(fresh, checkerId);
    return {
      ...fresh,
      poolStats,
      displayStatus: getCheckerShipmentDisplayStatus(fresh, checkerId),
      actionPhase: getCheckerPieceActionPhase(fresh, checkerId),
      shipmentMunicipality: resolveShipmentMunicipality(fresh),
    };
  };

  const availableShipments = useMemo(() => {
    if (!hasMunicipalityAssignment) return [];

    return sortShipmentsNewest(
      Object.values(activeShipmentsById)
        .map(enrichShipment)
        .filter((s) =>
          allMunicipalities
            ? isAvailableToLoadShipment(s)
            : isAvailableToLoadShipmentForMunicipalities(
                s,
                assignedMunicipalities,
              ),
        )
        .filter((s) => (s.poolStats?.available || 0) > 0),
    );
  }, [
    activeShipmentsById,
    checkerId,
    allMunicipalities,
    assignedMunicipalities.join("|"),
    hasMunicipalityAssignment,
  ]);

  const myRouteShipments = useMemo(() => {
    return sortShipmentsNewest(
      Object.values(activeShipmentsById)
        .map(enrichShipment)
        .filter((s) => isMyActiveDeliveryShipment(s, checkerId))
        .filter(
          (s) =>
            Boolean(s.actionPhase) || (s.poolStats?.mine || 0) > 0,
        )
        .filter((s) => normalizeStatus(s.status) !== "LOADED"),
    );
  }, [activeShipmentsById, checkerId]);

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
        .map((id) => activeShipmentsById[id])
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
  }, [manifests, activeShipmentsById, checkerId]);

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
    isOnline,
    shipmentsById: activeShipmentsById,
    manifests: enrichedManifests,
    availableShipments,
    myRouteShipments,
    summary,
    routeSummary,
    assignedMunicipalities: municipalityLabels,
    municipalityLabel,
    hasMunicipalityAssignment,
  };
}
