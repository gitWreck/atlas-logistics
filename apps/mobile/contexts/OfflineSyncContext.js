import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  getPendingCount,
  getPendingOperations,
  pruneSyncedOperations,
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
  const syncInFlightRef = useRef(false);
  const prevOnlineRef = useRef(true);
  const initialSyncDoneRef = useRef(false);

  const refreshQueueState = useCallback(async () => {
    if (!checkerId) {
      setPendingOperations([]);
      setPendingCount(0);
      return;
    }
    const [pending, count] = await Promise.all([
      getPendingOperations(checkerId),
      getPendingCount(checkerId),
    ]);
    setPendingOperations(pending);
    setPendingCount(count);
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
    void refreshCacheState();
    void refreshQueueState();
  }, [refreshCacheState, refreshQueueState]);

  const syncNow = useCallback(async () => {
    if (!checkerId || !profile || syncInFlightRef.current || !isOnline) {
      return lastSyncResult;
    }

    syncInFlightRef.current = true;
    setSyncing(true);

    try {
      await pruneSyncedOperations(checkerId);
      const pending = await getPendingOperations(checkerId);
      if (!pending.length) {
        const empty = { synced: 0, failed: 0, errors: [] };
        setLastSyncResult(empty);
        await refreshQueueState();
        return empty;
      }

      const result = await syncPendingOperations({
        checkerId,
        profile,
        operations: pending,
        onProgress: () => {
          void refreshQueueState();
        },
      });

      await pruneSyncedOperations(checkerId);
      await refreshQueueState();
      setLastSyncResult(result);
      return result;
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
    }
  }, [checkerId, profile, refreshQueueState, isOnline]);

  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;
    if (isOnline && wasOffline && checkerId && pendingCount > 0 && !syncing) {
      void syncNow();
    }
  }, [isOnline, checkerId, pendingCount, syncing, syncNow]);

  useEffect(() => {
    if (!checkerId || !isOnline || initialSyncDoneRef.current) return undefined;
    initialSyncDoneRef.current = true;
    let cancelled = false;
    (async () => {
      const count = await getPendingCount(checkerId);
      if (!cancelled && count > 0) {
        void syncNow();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkerId, isOnline, syncNow]);

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

      const shipmentsById = await applyOptimisticUpdateToCache(checkerId, {
        shipmentId: payload.shipmentId,
        packageIds: payload.packageIds,
        status: payload.type,
        checkerUid: checkerId,
        shipmentSnapshot: payload.shipmentSnapshot || null,
      });

      setCachedShipmentsById(shipmentsById);
      return operation;
    },
    [checkerId, refreshQueueState],
  );

  const warmShipmentCache = useCallback(
    async (shipmentsById = {}, extras = {}) => {
      if (!checkerId) return {};
      const merged = await upsertShipmentsInCache(checkerId, shipmentsById, extras);
      setCachedShipmentsById(merged);
      setCacheSavedAt(Date.now());
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

  const value = useMemo(
    () => ({
      isOnline,
      syncing,
      pendingCount,
      pendingOperations,
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
