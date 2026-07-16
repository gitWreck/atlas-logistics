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
  isAvailableToLoadShipmentForMunicipalities,
  isMyActiveDeliveryShipment,
} from "../components/utilities/checkerDeliveryPool";
import {
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
 */
export function useCheckerLastMileSync(checkerId) {
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
  }, [checkerId]);

  // Subscribe to shipments and manifests using municipality-scoped queries.
  useEffect(() => {
    if (!checkerId) return undefined;

    let assignedMap = {};
    let availableMap = {};
    let activeMap = {};

    const publishQueries = () => {
      setQueryShipments(mergeShipmentMaps(assignedMap, availableMap, activeMap));
    };

    // Helper to batch an array into chunks of size n
    const batchesOf = (arr, n) => {
      const out = [];
      for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
      return out;
    };

    const unsubs = [];

    // If no assignment, avoid subscribing to large general availability feed.
    if (Array.isArray(assignedMunicipalities) && assignedMunicipalities.length > 0) {
      // assigned shipments (explicitly assigned to this checker)
      if (assignedMunicipalities.length <= 10) {
        const q = query(
          collection(db, "shipments"),
          where("assignedCheckerId", "==", String(checkerId)),
          where("municipality", "in", assignedMunicipalities),
        );
        unsubs.push(
          onSnapshot(
            q,
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
          ),
        );
      } else {
        // batch assigned queries if more than 10 municipalities
        batchesOf(assignedMunicipalities, 10).forEach((batch) => {
          const q = query(
            collection(db, "shipments"),
            where("assignedCheckerId", "==", String(checkerId)),
            where("municipality", "in", batch),
          );
          unsubs.push(
            onSnapshot(
              q,
              (snap) => {
                snap.docs.forEach((docSnap) => {
                  assignedMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
                });
                publishQueries();
              },
              (err) => {
                console.error("Checker assigned shipments failed (batch):", err);
                setError(err);
              },
            ),
          );
        });
      }

      // available shipments filter (only for assigned municipalities)
      if (assignedMunicipalities.length <= 10) {
        const q = query(
          collection(db, "shipments"),
          where("availableForDelivery", "==", true),
          where("municipality", "in", assignedMunicipalities),
        );
        unsubs.push(
          onSnapshot(
            q,
            (snap) => {
              availableMap = {};
              snap.docs.forEach((docSnap) => {
                availableMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
              });
              publishQueries();
            },
            (err) => console.warn("Checker available pool failed:", err),
          ),
        );
      } else {
        batchesOf(assignedMunicipalities, 10).forEach((batch) => {
          const q = query(
            collection(db, "shipments"),
            where("availableForDelivery", "==", true),
            where("municipality", "in", batch),
          );
          unsubs.push(
            onSnapshot(
              q,
              (snap) => {
                snap.docs.forEach((docSnap) => {
                  availableMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
                });
                publishQueries();
              },
              (err) => console.warn("Checker available pool failed (batch):", err),
            ),
          );
        });
      }

      // activeCheckerQuery (array-contains + municipality)
      if (assignedMunicipalities.length <= 10) {
        const q = query(
          collection(db, "shipments"),
          where("activeCheckerIds", "array-contains", String(checkerId)),
          where("municipality", "in", assignedMunicipalities),
        );
        unsubs.push(
          onSnapshot(
            q,
            (snap) => {
              activeMap = {};
              snap.docs.forEach((docSnap) => {
                activeMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
              });
              publishQueries();
            },
            (err) => console.warn("Checker activeCheckerIds failed:", err),
          ),
        );
      } else {
        batchesOf(assignedMunicipalities, 10).forEach((batch) => {
          const q = query(
            collection(db, "shipments"),
            where("activeCheckerIds", "array-contains", String(checkerId)),
            where("municipality", "in", batch),
          );
          unsubs.push(
            onSnapshot(
              q,
              (snap) => {
                snap.docs.forEach((docSnap) => {
                  activeMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
                });
                publishQueries();
              },
              (err) => console.warn("Checker activeCheckerIds failed (batch):", err),
            ),
          );
        });
      }
    } else {
      // no assigned municipalities: clear query shipments so UI shows empty
      setQueryShipments({});
    }

    // Manifests (unchanged, still scoped to checkerId)
    const manifestQuery = query(
      collection(db, "delivery_manifests"),
      where("checkerId", "==", String(checkerId)),
    );
    const unsubManifests = onSnapshot(
      manifestQuery,
      (snap) => {
        const next = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((m) => !CLOSED_MANIFEST_STATUSES.has(normalizeStatus(m.status)))
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

    // Track manifest unsub as well
    unsubs.push(unsubManifests);

    return () => {
      unsubs.forEach((u) => {
        try { u(); } catch (e) { /* ignore */ }
      });
    };
  }, [checkerId, assignedMunicipalities.join("|")]);

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
    if (Object.keys(shipmentsById).length === 0) return;
    void warmShipmentCache(shipmentsById, {
      manifests,
      assignedMunicipalities,
    });
  }, [
    checkerId,
    isOnline,
    shipmentsById,
    manifests,
    assignedMunicipalities,
    warmShipmentCache,
  ]);

  useEffect(() => {
    if (!isOnline && Object.keys(cachedShipmentsById).length > 0) {
      setLoading(false);
    }
  }, [isOnline, cachedShipmentsById]);

  const municipalityLabels = useMemo(
    () => formatMunicipalityList(assignedMunicipalities),
    [assignedMunicipalities],
  );

  const municipalityLabel = useMemo(
    () => (municipalityLabels.length ? municipalityLabels.join(", ") : null),
    [municipalityLabels],
  );

  const hasMunicipalityAssignment = municipalityLabels.length > 0;

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
          isAvailableToLoadShipmentForMunicipalities(s, assignedMunicipalities),
        )
        .filter((s) => (s.poolStats?.available || 0) > 0),
    );
  }, [
    activeShipmentsById,
    checkerId,
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
