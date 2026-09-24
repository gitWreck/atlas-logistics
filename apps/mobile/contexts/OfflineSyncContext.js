import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, InteractionManager } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useAuth } from "./AuthContext";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import {
  applyOptimisticUpdateToCache,
  applyPendingOperationsToShipments,
  loadShipmentCache,
  mergeShipmentMaps,
  upsertShipmentsInCache,
} from "../components/utilities/offlineShipmentCache";
import {
  enqueueOperation,
  preparePendingQueue,
  summarizeQueueOperations,
} from "../components/utilities/offlineQueue";
import { persistOfflinePhotos } from "../components/utilities/offlinePhotoStore";
import { syncPendingOperations } from "../components/utilities/offlineSyncWorker";

const OfflineSyncContext = createContext(null);

export function OfflineSyncProvider({ children }) {
  const { profile } = useAuth();
  const checkerId = profile?.uid || null;
  const { isOnline } = useNetworkStatus();

  const [cachedShipmentsById, setCachedShipmentsById] = useState({});
  const [cachedManifests, setCachedManifests] = useState([]);
  const [cachedAssignedMunicipalities, setCachedAssignedMunicipalities] =
    useState([]);
  const [cacheSavedAt, setCacheSavedAt] = useState(null);
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const [pendingOperations, setPendingOperations] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [queueHydrated, setQueueHydrated] = useState(false);
  const syncInFlightRef = useRef(false);
  const cacheLoadGenerationRef = useRef(0);
  const prevOnlineRef = useRef(true);
  const initialSyncDoneRef = useRef(false);

  const refreshQueueState = useCallback(async ({ pruneSynced = false } = {}) => {
    if (!checkerId) {
      setPendingOperations([]);
      setPendingCount(0);
      setQueueHydrated(true);
      return;
    }
    const { pending } = await preparePendingQueue(checkerId, { pruneSynced });
    setPendingOperations(pending);
    setPendingCount(pending.length);
    setQueueHydrated(true);
  }, [checkerId]);

  const refreshCacheState = useCallback(async () => {
    const generation = ++cacheLoadGenerationRef.current;
    if (!checkerId) {
      setCachedShipmentsById({});
      setCachedManifests([]);
      setCachedAssignedMunicipalities([]);
      setCacheSavedAt(null);
      setCacheHydrated(true);
      return;
    }
    try {
      const cached = await loadShipmentCache(checkerId);
      if (generation !== cacheLoadGenerationRef.current) return;
      setCachedShipmentsById(cached.shipmentsById || {});
      setCachedManifests(cached.manifests || []);
      setCachedAssignedMunicipalities(
        cached.assignedMunicipalities || [],
      );
      setCacheSavedAt(cached.savedAt || null);
    } finally {
      if (generation === cacheLoadGenerationRef.current) {
        setCacheHydrated(true);
      }
    }
  }, [checkerId]);

  useEffect(() => {
    // The cache contains only the current checker work set. Hydrate it on
    // every launch so useful UI can render while Firestore listeners reconcile
    // newer documents in the background.
    setCachedShipmentsById({});
    setCachedManifests([]);
    setCachedAssignedMunicipalities([]);
    setCacheSavedAt(null);
    setCacheHydrated(false);
    setPendingOperations([]);
    setPendingCount(0);
    setQueueHydrated(false);
    initialSyncDoneRef.current = false;
    void refreshCacheState();

    let timer = null;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        void refreshQueueState();
      }, 750);
    });

    return () => {
      task?.cancel?.();
      if (timer) clearTimeout(timer);
    };
  }, [checkerId, refreshCacheState, refreshQueueState]);

  const syncNow = useCallback(async ({ retryFailed = true } = {}) => {
    if (!checkerId || !profile || syncInFlightRef.current) {
      return lastSyncResult;
    }

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert(
        "No connection",
        "Connect to the internet before syncing queued scans.",
      );
      return lastSyncResult;
    }

    syncInFlightRef.current = true;
    setSyncing(true);

    try {
      const { pending } = await preparePendingQueue(checkerId, {
        includeFailed: retryFailed,
        pruneSynced: true,
      });
      if (!pending.length) {
        const empty = { synced: 0, failed: 0, errors: [] };
        setLastSyncResult(empty);
        await refreshQueueState();
        return empty;
      }

      const sortedPending = [...pending].sort(
        (a, b) => (a.createdAt || 0) - (b.createdAt || 0),
      );

      const result = await syncPendingOperations({
        checkerId,
        profile,
        operations: sortedPending,
      });

      await refreshQueueState({ pruneSynced: true });
      setLastSyncResult(result);

      if (result.failed > 0) {
        const detail = result.errors
          .map((entry) => `• ${entry.label}\n  ${entry.message}`)
          .join("\n\n");
        Alert.alert(
          "Sync incomplete",
          `${result.synced} synced, ${result.failed} failed.\n\n${detail}`,
        );
      } else if (result.synced > 0) {
        Alert.alert(
          "Sync complete",
          `${result.synced} scan${result.synced === 1 ? "" : "s"} synced successfully.`,
        );
      }

      return result;
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
    }
  }, [checkerId, profile, refreshQueueState, lastSyncResult]);

  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;
    if (isOnline && wasOffline && checkerId && pendingCount > 0 && !syncing) {
      // Freshly queued work can resume automatically. Previously failed work
      // stays visible for an explicit retry instead of storming every launch
      // or brief network reconnect.
      void syncNow({ retryFailed: false });
    }
  }, [isOnline, checkerId, pendingCount, syncing, syncNow]);

  useEffect(() => {
    if (
      !checkerId ||
      !isOnline ||
      !queueHydrated ||
      initialSyncDoneRef.current
    ) return undefined;
    initialSyncDoneRef.current = true;
    const hasNewPendingWork = pendingOperations.some(
      (operation) => operation.status === "pending",
    );
    if (hasNewPendingWork) {
      void syncNow({ retryFailed: false });
    }
    return () => {
      // The worker is durable and owns its own in-flight guard.
    };
  }, [
    checkerId,
    isOnline,
    queueHydrated,
    pendingOperations,
    syncNow,
  ]);

  const enqueueOfflineOperation = useCallback(
    async (payload) => {
      if (!checkerId) {
        throw new Error("Checker session is required.");
      }

      let localPhotoPaths = payload.localPhotoPaths || null;
      const operationId = payload.id || null;

      if (
        Array.isArray(payload.photoUris) &&
        payload.photoUris.length > 0 &&
        !localPhotoPaths
      ) {
        const opId =
          operationId ||
          `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        localPhotoPaths = await persistOfflinePhotos(opId, payload.photoUris);
      }

      const operation = await enqueueOperation(checkerId, {
        ...payload,
        localPhotoPaths,
        checkerId,
      });

      await refreshQueueState();

      if (
        !payload.blindQueue &&
        payload.shipmentId &&
        Array.isArray(payload.packageIds) &&
        payload.packageIds.length > 0
      ) {
        const shipmentsById = await applyOptimisticUpdateToCache(checkerId, {
          shipmentId: payload.shipmentId,
          packageIds: payload.packageIds,
          status: payload.type,
          checkerUid: checkerId,
          shipmentSnapshot: payload.shipmentSnapshot || null,
        });
        setCachedShipmentsById(shipmentsById);
      }

      return operation;
    },
    [checkerId, refreshQueueState],
  );

  const warmShipmentCache = useCallback(
    async (shipmentsById = {}, extras = {}, options = {}) => {
      if (!checkerId) return {};
      const merged = await upsertShipmentsInCache(checkerId, shipmentsById, {
        ...extras,
        replace: options.replace === true,
      });
      if (options.publish !== false) {
        setCachedShipmentsById(merged);
        setCacheSavedAt(Date.now());
      }
      return merged;
    },
    [checkerId],
  );

  const effectiveShipmentsById = useMemo(
    () =>
      applyPendingOperationsToShipments(
        cachedShipmentsById,
        pendingOperations,
        checkerId,
      ),
    [cachedShipmentsById, pendingOperations, checkerId],
  );

  const pendingSummaries = useMemo(
    () => summarizeQueueOperations(pendingOperations),
    [pendingOperations],
  );

  const value = useMemo(
    () => ({
      isOnline,
      syncing,
      pendingCount,
      pendingOperations,
      pendingSummaries,
      lastSyncResult,
      cachedShipmentsById,
      cachedManifests,
      cachedAssignedMunicipalities,
      effectiveShipmentsById,
      cacheSavedAt,
      cacheHydrated,
      syncNow,
      enqueueOfflineOperation,
      warmShipmentCache,
      refreshQueueState,
      refreshCacheState,
      setCachedShipmentsById,
    }),
    [
      isOnline,
      syncing,
      pendingCount,
      pendingOperations,
      pendingSummaries,
      lastSyncResult,
      cachedShipmentsById,
      cachedManifests,
      cachedAssignedMunicipalities,
      effectiveShipmentsById,
      cacheSavedAt,
      cacheHydrated,
      syncNow,
      enqueueOfflineOperation,
      warmShipmentCache,
      refreshQueueState,
      refreshCacheState,
    ],
  );

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error("useOfflineSync must be used within OfflineSyncProvider");
  }
  return ctx;
}

/** Safe hook for screens that may render outside the provider. */
export function useOfflineSyncOptional() {
  return useContext(OfflineSyncContext);
}
