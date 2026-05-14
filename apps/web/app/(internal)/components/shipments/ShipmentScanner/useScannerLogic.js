"use client";

import { useState, useCallback } from "react";

// 1. Import your centralized Firebase functions
import {
  bulkAssignShipments,
  finalizeTripUnloadHandoff,
  updateTripStatus,
  unlockTripManifest,
  generateTripManifest,
} from "@/app/utility/FirebaseFunctions"; // Adjust path if your file is located elsewhere
import { updatedBy } from "@/app/utility/utilities";

const SCAN_STATUS_OPTIONS = {
  LOAD: [
    {
      label: "Loaded",
      value: "LOADED",
      tone: "blue",
    },
    {
      label: "Missing",
      value: "MISSING",
      tone: "red",
    },
    {
      label: "Damaged",
      value: "DAMAGED",
      tone: "amber",
    },
  ],
  UNLOAD: [
    {
      label: "Received",
      value: "RECEIVED",
      tone: "emerald",
    },
    {
      label: "Missing",
      value: "MISSING",
      tone: "red",
    },
    {
      label: "Damaged",
      value: "DAMAGED",
      tone: "amber",
    },
  ],
};

export default function useScannerLogic({
  trip,
  onResolveScan,
  onConfirmOperation,
  onClose,
  onRefresh,
  user,
  profile,
}) {
  const tripId = trip?.tripId || trip?.id || "";

  // Core State
  const [action, setAction] = useState(null);
  const [scanStatus, setScanStatus] = useState(null);
  const [scanCode, setScanCode] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [resolvedItem, setResolvedItem] = useState(null);
  const [quantities, setQuantities] = useState({});

  // Interceptor States
  const [needsAssignmentItem, setNeedsAssignmentItem] = useState(null);
  const [recentlyAssigned, setRecentlyAssigned] = useState(new Set());
  const [needsArrival, setNeedsArrival] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [needsLoadedStatus, setNeedsLoadedStatus] = useState(false);
  const [needsLock, setNeedsLock] = useState(false);

  // Next Trip States
  const [needsNextTrip, setNeedsNextTrip] = useState(false);
  const [availableTrips, setAvailableTrips] = useState([]);
  const [selectedNextTrip, setSelectedNextTrip] = useState("");
  const [needsHandoff, setNeedsHandoff] = useState(false);
  const [handoffSummary, setHandoffSummary] = useState(null);
  const [missingRemarks, setMissingRemarks] = useState({});

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState(null);
  const [btnStatus, setBtnStatus] = useState("IDLE");

  const resetFlow = useCallback(() => {
    setAction(null);
    setScanStatus(null);
    setScanCode("");
    setManualCode("");
    setResolvedItem(null);
    setQuantities({});
    setNeedsAssignmentItem(null);
    setNeedsArrival(false);
    setNeedsUnlock(false);
    setNeedsLoadedStatus(false);
    setNeedsLock(false);
    setNeedsNextTrip(false);
    setNeedsHandoff(false);
    setHandoffSummary(null);
    setMissingRemarks({});
    setBtnStatus("IDLE");
    setLoading(false);
    setError("");
    setSuccessNotice(null);
  }, []);

  const resetScanResult = useCallback(() => {
    setScanCode("");
    setManualCode("");
    setResolvedItem(null);
    setQuantities({});
    setNeedsAssignmentItem(null);
    setNeedsNextTrip(false);
    setNeedsHandoff(false);
    setHandoffSummary(null);
    setMissingRemarks({});
    setAvailableTrips([]);
    setSelectedNextTrip("");
    setBtnStatus("IDLE");
    setLoading(false);
    setError("");
  }, []);

  const getDefaultScanStatus = useCallback(
    (scanAction) => SCAN_STATUS_OPTIONS[scanAction]?.[0]?.value || null,
    [],
  );

  const setScannerAction = useCallback(
    (nextAction) => {
      setAction(nextAction);
      setScanStatus(getDefaultScanStatus(nextAction));
    },
    [getDefaultScanStatus],
  );

  const getPackageAvailableQty = useCallback((pkg, scanAction, targetStatus) => {
    if (!pkg) return 0;
    const totalQty = Math.max(Number(pkg.quantity) || 1, 1);
    const rawLoadedQty = Number(pkg.loadedQty);
    const hasLoadedQty = Number.isFinite(rawLoadedQty) && rawLoadedQty >= 0;
    const status = String(pkg.status || "").toUpperCase();
    const loadedQty = Math.min(
      hasLoadedQty
        ? rawLoadedQty
        : status === "LOADED" || status === "DELIVERED"
          ? totalQty
          : 0,
      totalQty,
    );

    if (targetStatus === "MISSING" || targetStatus === "DAMAGED") {
      return scanAction === "LOAD"
        ? Math.max(0, totalQty - loadedQty)
        : Math.max(0, loadedQty);
    }

    if (scanAction === "LOAD") {
      return Math.max(0, totalQty - loadedQty);
    }
    return Math.max(0, loadedQty);
  }, []);

  const getPackageIdentity = useCallback(
    (pkg) => pkg?.packageId || pkg?.trackingNumber || "",
    [],
  );

  const findPackageByScan = useCallback(
    (packages = [], code, packageId = null) => {
      const candidates = [packageId, code]
        .map((value) => String(value || "").trim())
        .filter(Boolean);

      return packages.find((pkg) => {
        const ids = [pkg?.packageId, pkg?.trackingNumber]
          .map((value) => String(value || "").trim())
          .filter(Boolean);

        return ids.some((id) => candidates.includes(id));
      });
    },
    [],
  );

  const fetchJsonWithAuth = useCallback(
    async (url) => {
      const token = await user?.getIdToken();
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load scanner data.");
      }

      return data;
    },
    [user],
  );

  const fetchDeliveryTrips = useCallback(async () => {
    const tripData = await fetchJsonWithAuth("/api/trips/delivery");
    const trips = tripData.trips || [];

    setAvailableTrips(trips);
    setSelectedNextTrip((current) => current || trips[0]?.id || "");

    return trips;
  }, [fetchJsonWithAuth]);

  const loadHandoffReview = useCallback(
    async ({ openWhenReadyOnly = false } = {}) => {
      if (!tripId) return null;

      setLoading(true);
      setError("");

      try {
        const [summary, trips] = await Promise.all([
          fetchJsonWithAuth(
            `/api/trips/${encodeURIComponent(tripId)}/handoff-reconciliation`,
          ),
          fetchDeliveryTrips(),
        ]);

        const seededRemarks = {};
        (summary.missingShipments || []).forEach((item) => {
          seededRemarks[item.id] = missingRemarks[item.id] || "";
        });

        setHandoffSummary(summary);
        setMissingRemarks(seededRemarks);

        const shouldOpen =
          !openWhenReadyOnly ||
          (summary.ready && summary.totals?.manifestShipments > 0);

        if (shouldOpen) {
          setNeedsHandoff(true);
          setResolvedItem(null);
          setNeedsAssignmentItem(null);
          setNeedsNextTrip(false);
        }

        if (!trips.length) {
          setError("No available DELIVERY trips found.");
        }

        return summary;
      } catch (err) {
        setError(err.message || "Failed to reconcile manifest.");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [fetchDeliveryTrips, fetchJsonWithAuth, missingRemarks, tripId],
  );

  const processItems = useCallback(
    async ({ item, code, itemsToProcess }) => {
      await onConfirmOperation({
        tripId,
        action,
        scanCode: code,
        scanType: item.scanType,
        shipmentId: item.shipmentId,
        itemsToProcess,
        newStatus: scanStatus,
        updatedBy: updatedBy(profile),
      });

      const totalQuantity = itemsToProcess.reduce(
        (sum, processItem) => sum + Number(processItem.quantity || 0),
        0,
      );

      setSuccessNotice({
        action,
        scanStatus,
        scanStatusLabel:
          SCAN_STATUS_OPTIONS[action]?.find((opt) => opt.value === scanStatus)
            ?.label || scanStatus,
        code,
        shipmentId: item.shipmentId,
        scanType: item.scanType,
        totalQuantity,
      });
      onRefresh?.();

      if (action === "UNLOAD") {
        const summary = await loadHandoffReview({ openWhenReadyOnly: true });

        if (summary?.ready) {
          return;
        }
      }

      resetScanResult();
    },
    [
      action,
      loadHandoffReview,
      onConfirmOperation,
      onRefresh,
      profile,
      resetScanResult,
      scanStatus,
      tripId,
    ],
  );

  const handleResolveScan = async (code) => {
    const cleanCode = String(code || "").trim();
    if (!action) return setError("Please choose Load or Unload first.");
    if (!cleanCode) return setError("Please scan or enter a label.");
    if (!tripId) return setError("No trip selected.");

    setLoading(true);
    setError("");
    setSuccessNotice(null);
    try {
      const result = await onResolveScan({
        tripId,
        action,
        scanCode: cleanCode,
      });
      if (!result?.found) return setError(result.message || "Label not found.");

      setScanCode(cleanCode);
      setManualCode("");
      if (
        result.requiresAssignment &&
        !recentlyAssigned.has(result.shipmentId)
      ) {
        setNeedsAssignmentItem(result);
      } else {
        let nextResolvedItem = result;

        if (result.scanType === "PACKAGE") {
          const targetPackage = findPackageByScan(
            result.packages,
            cleanCode,
            result.packageId,
          );
          const packageIdentity = getPackageIdentity(targetPackage);

          if (!targetPackage || !packageIdentity) {
            return setError("Package data is missing for this label.");
          }

          const totalQty = Math.max(Number(targetPackage.quantity) || 1, 1);
          const availableQty = getPackageAvailableQty(
            targetPackage,
            action,
            scanStatus,
          );
          nextResolvedItem = {
            ...result,
            packageId: packageIdentity,
            trackingNumber: targetPackage.trackingNumber || null,
          };

          if (totalQty === 1 && availableQty === 1) {
            await processItems({
              item: nextResolvedItem,
              code: cleanCode,
              itemsToProcess: [
                {
                  packageId: packageIdentity,
                  quantity: 1,
                },
              ],
            });
            return;
          }

          if (availableQty <= 0) {
            if (action === "LOAD") {
              return setError("Item is loaded.");
            }

            return setError("No quantity is available for this package.");
          }
        }

        setResolvedItem(nextResolvedItem);
      }
      setQuantities({});
    } catch (err) {
      setError(err.message || "Failed to check scanned label.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Updated helper: Now accepts the actual function reference instead of a string
  const executeFirebaseCall = async (
    firebaseFunction,
    payload,
    optimisticCallback,
  ) => {
    setBtnStatus("LOADING");
    setError("");
    try {
      await firebaseFunction(payload);
      if (optimisticCallback) optimisticCallback();
      setBtnStatus("SUCCESS");
      return true;
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to execute database action");
      setBtnStatus("ERROR");
      return false;
    }
  };

  // 3. Updated all handlers to pass the imported functions directly
  const handleAssignShipment = async () => {
    setLoading(true);
    const success = await executeFirebaseCall(bulkAssignShipments, {
      tripId,
      shipmentIds: [needsAssignmentItem.shipmentId],
      updatedBy: updatedBy(profile),
    });
    if (success) {
      setRecentlyAssigned((prev) =>
        new Set(prev).add(needsAssignmentItem.shipmentId),
      );
      setResolvedItem(needsAssignmentItem);
      setNeedsAssignmentItem(null);
    }
    setLoading(false);
  };

  const handleMarkArrived = async () => {
    const success = await executeFirebaseCall(
      updateTripStatus,
      {
        tripId,
        status: "ARRIVED",
        notify: false,
        updatedBy: updatedBy(profile),
      },
      () => {
        if (trip) trip.status = "ARRIVED";
      },
    );
    if (success)
      setTimeout(() => {
        onRefresh?.();
        setNeedsArrival(false);
        if (trip?.manifestLocked) setNeedsUnlock(true);
        setBtnStatus("IDLE");
      }, 1000);
  };

  const handleUnlockManifest = async () => {
    const success = await executeFirebaseCall(
      unlockTripManifest,
      { tripId, reason: "Shipment has arrived", updatedBy: updatedBy(profile) },
      () => {
        if (trip) trip.manifestLocked = false;
      },
    );
    if (success)
      setTimeout(() => {
        onRefresh?.();
        setNeedsUnlock(false);
        setBtnStatus("IDLE");
      }, 1000);
  };

  const handleSetTripLoaded = async () => {
    const success = await executeFirebaseCall(
      updateTripStatus,
      { tripId, status: "LOADED", updatedBy: updatedBy(profile) },
      () => {
        if (trip) trip.status = "LOADED";
      },
    );
    if (success)
      setTimeout(() => {
        onRefresh?.();
        setNeedsLoadedStatus(false);
        setNeedsLock(true);
        setBtnStatus("IDLE");
      }, 1000);
  };

  const handleLockManifest = async () => {
    const success = await executeFirebaseCall(
      generateTripManifest,
      { tripId, updatedBy: updatedBy(profile) },
      () => {
        if (trip) {
          trip.manifestLocked = true;
          trip.status = "IN_TRANSIT";
        }
      },
    );
    if (success) {
      // Safely ensure backend status aligns with local optimistic IN_TRANSIT
      executeFirebaseCall(updateTripStatus, { tripId, status: "IN_TRANSIT" });
      setTimeout(() => {
        onRefresh?.();
        setNeedsLock(false);
        setBtnStatus("IDLE");
      }, 1000);
    }
  };

  const handleAssignNextTrip = async () => {
    if (!selectedNextTrip) return setError("Select a delivery trip first.");

    const missing = handoffSummary?.missingShipments || [];
    const incompleteRemark = missing.find(
      (item) => !String(missingRemarks[item.id] || "").trim(),
    );

    if (incompleteRemark) {
      return setError(`Add remarks for ${incompleteRemark.shipmentId}.`);
    }

    const success = await executeFirebaseCall(finalizeTripUnloadHandoff, {
      sourceTripId: tripId,
      deliveryTripId: selectedNextTrip,
      missingRemarks,
      updatedBy: updatedBy(profile),
    });
    if (success)
      setTimeout(() => {
        onRefresh?.();
        onClose?.();
        resetFlow();
      }, 1000);
  };

  const handleConfirm = async () => {
    const itemsToProcess = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([pkgId, qty]) => ({ packageId: pkgId, quantity: qty }));

    if (itemsToProcess.length === 0)
      return setError("Please enter a quantity greater than zero.");

    setLoading(true);
    setError("");
    try {
      await onConfirmOperation({
        tripId,
        action,
        scanCode,
        scanType: resolvedItem.scanType,
        shipmentId: resolvedItem.shipmentId,
        itemsToProcess,
        newStatus: scanStatus,
        updatedBy: updatedBy(profile),
      });

      const totalQuantity = itemsToProcess.reduce(
        (sum, processItem) => sum + Number(processItem.quantity || 0),
        0,
      );

      setSuccessNotice({
        action,
        scanStatus,
        scanStatusLabel:
          SCAN_STATUS_OPTIONS[action]?.find((opt) => opt.value === scanStatus)
            ?.label || scanStatus,
        code: scanCode,
        shipmentId: resolvedItem.shipmentId,
        scanType: resolvedItem.scanType,
        totalQuantity,
      });
      onRefresh?.();

      if (action === "UNLOAD") {
        const summary = await loadHandoffReview({ openWhenReadyOnly: true });
        if (summary?.ready) {
          return;
        }
      }

      resetScanResult();
    } catch (err) {
      setError(err.message || "Failed to process scan action.");
    } finally {
      setLoading(false);
    }
  };

  return {
    state: {
      tripId,
      action,
      scanStatus,
      scanStatusOptions: SCAN_STATUS_OPTIONS[action] || [],
      scanCode,
      manualCode,
      resolvedItem,
      quantities,
      needsAssignmentItem,
      needsArrival,
      needsUnlock,
      needsLoadedStatus,
      needsLock,
      needsNextTrip,
      availableTrips,
      selectedNextTrip,
      needsHandoff,
      handoffSummary,
      missingRemarks,
      loading,
      error,
      successNotice,
      btnStatus,
    },
    actions: {
      setAction: setScannerAction,
      setScanStatus,
      setQuantities,
      setManualCode,
      setSelectedNextTrip,
      setMissingRemarks,
      setError,
      setSuccessNotice,
      setNeedsLoadedStatus,
      setNeedsLock,
      setNeedsUnlock,
      setNeedsArrival,
      resetFlow,
      resetScanResult,
      handleResolveScan,
      handleAssignShipment,
      handleMarkArrived,
      handleUnlockManifest,
      handleSetTripLoaded,
      handleLockManifest,
      handleAssignNextTrip,
      handleReviewHandoff: () => loadHandoffReview(),
      handleConfirm,
    },
  };
}
