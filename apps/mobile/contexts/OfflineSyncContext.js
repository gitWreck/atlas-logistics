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
  const [cacheSavedAt, setCacheSavedAt] = useState(null);
  const [pendingOperations, setPendingOperations] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [queueHydrated, setQueueHydrated] = useState(false);
  const syncInFlightRef = useRef(false);
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
    if (!checkerId) {
      setCachedShipmentsById({});
      setCacheSavedAt(null);
      return;
    }
    const cached = await loadShipmentCache(checkerId);
    setCachedShipmentsById(cached.shipmentsById || {});
    setCacheSavedAt(cached.savedAt || null);
  }, [checkerId]);

  useEffect(() => {
    // Keep online startup responsive: the durable shipment cache can be very
    // large and is only needed when the device is actually offline.
    setCachedShipmentsById({});
    setCacheSavedAt(null);
    setPendingOperations([]);
    setPendingCount(0);
    setQueueHydrated(false);
    initialSyncDoneRef.current = false;

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
  }, [checkerId, refreshQueueState]);

  useEffect(() => {
    if (!isOnline) {
      // Background cache persistence intentionally avoids publishing large
      // maps while online. Reload the latest durable snapshot only when it is
      // needed for offline operation.
      void refreshCacheState();
    }
  }, [isOnline, refreshCacheState]);

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
      effectiveShipmentsById,
      cacheSavedAt,
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
      effectiveShipmentsById,
      cacheSavedAt,
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
