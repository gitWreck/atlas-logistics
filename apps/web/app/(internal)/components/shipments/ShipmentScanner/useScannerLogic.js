"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { isManifestReconciled } from "@/app/utility/manifestStatus";

// 1. Import your centralized Firebase functions
import {
  bulkAssignShipments,
  releaseForDeliveryOperations,
  updateTripStatus,
  unlockTripManifest,
  generateTripManifest,
  startReceiving,
} from "@/app/utility/FirebaseFunctions"; // Adjust path if your file is located elsewhere
import { isEligibleForCheckerRelease } from "@/app/utility/checkerRelease";
import { isTripReleaseEligible } from "@/app/utility/tripLifecycle";
import { updatedBy } from "@/app/utility/utilities";
import {
  buildAlreadyLoadedInfo,
  isPackageFullyLoadedOnTrip,
} from "@/lib/scannerLoadDuplicate";

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

const ON_TRUCK_PIECE_STATUSES = new Set([
  "LOADED",
  "IN_TRANSIT",
  "PARTIALLY_LOADED",
  "OUT_FOR_DELIVERY",
]);

const ALREADY_AT_HUB_PIECE_STATUSES = new Set([
  "RECEIVED",
  "AVAILABLE_AT_WAREHOUSE",
  "READY_FOR_DELIVERY",
  "RETURNED_RECEIVED_AT_HUB",
  "DELIVERED",
  "COMPLETED",
]);

function explainUnloadBlockReason(pkg, { tripId, shipmentOnTrip, packageAssignmentState } = {}) {
  if (!pkg) return "Package data is missing for this label.";

  const status = String(pkg.status || "").toUpperCase();
  const packageTripId = pkg.currentTripId || pkg.loadedOnTrip || null;

  if (packageAssignmentState === "ON_OTHER_TRIP" || (packageTripId && packageTripId !== tripId)) {
    return `This piece is still on trip ${packageTripId}. Open that trip to unload it, or scan a piece on ${tripId}.`;
  }

  if (ALREADY_AT_HUB_PIECE_STATUSES.has(status)) {
    return `This piece is already ${status.replace(/_/g, " ").toLowerCase()} at the hub. Skip unload — use Reconcile & release shipments in this scanner.`;
  }

  if (!shipmentOnTrip && packageAssignmentState !== "ON_THIS_TRIP") {
    return "This shipment is not on the active trip manifest. Assign it to this trip first, then scan again.";
  }

  return "No loaded quantity remains on this trip for this label. Confirm it was loaded on this trip, or release from Manifest if already received.";
}

export default function useScannerLogic({
  isOpen = false,
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
  const [needsStartReceiving, setNeedsStartReceiving] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [needsLoadedStatus, setNeedsLoadedStatus] = useState(false);
  const [needsLock, setNeedsLock] = useState(false);

  const [needsNextTrip, setNeedsNextTrip] = useState(false);
  const [needsHandoff, setNeedsHandoff] = useState(false);
  const [handoffSummary, setHandoffSummary] = useState(null);
  const [missingRemarks, setMissingRemarks] = useState({});

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState(null);
  const [alreadyLoadedNotice, setAlreadyLoadedNotice] = useState(null);
  const [btnStatus, setBtnStatus] = useState("IDLE");
  const handoffBootstrappedRef = useRef(false);
  const successNoticeTimerRef = useRef(null);

  const showSuccessNotice = useCallback((payload) => {
    if (successNoticeTimerRef.current) {
      clearTimeout(successNoticeTimerRef.current);
    }
    setSuccessNotice(payload);
    successNoticeTimerRef.current = setTimeout(() => {
      setSuccessNotice(null);
      successNoticeTimerRef.current = null;
    }, 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (successNoticeTimerRef.current) {
        clearTimeout(successNoticeTimerRef.current);
      }
    };
  }, []);

  const resetFlow = useCallback(() => {
    setAction(null);
    setScanStatus(null);
    setScanCode("");
    setManualCode("");
    setResolvedItem(null);
    setQuantities({});
    setNeedsAssignmentItem(null);
    setNeedsArrival(false);
    setNeedsStartReceiving(false);
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
    if (successNoticeTimerRef.current) {
      clearTimeout(successNoticeTimerRef.current);
      successNoticeTimerRef.current = null;
    }
    setSuccessNotice(null);
    setAlreadyLoadedNotice(null);
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
    setBtnStatus("IDLE");
    setLoading(false);
    setError("");
    setAlreadyLoadedNotice(null);
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

  const getPackageAvailableQty = useCallback(
    (pkg, scanAction, targetStatus, context = {}) => {
      if (!pkg) return 0;

      const { shipmentOnTrip = false, packageAssignmentState = null } = context;
      const packageTripId = pkg.currentTripId || pkg.loadedOnTrip || null;
      const status = String(pkg.status || "").toUpperCase();
      const onThisTrip =
        packageTripId === tripId ||
        packageAssignmentState === "ON_THIS_TRIP" ||
        (shipmentOnTrip &&
          !packageTripId &&
          ON_TRUCK_PIECE_STATUSES.has(status));

      if (scanAction === "LOAD" && packageTripId && packageTripId !== tripId) {
        return 0;
      }
      if (scanAction === "UNLOAD" && !onThisTrip) {
        return 0;
      }
      if (scanAction === "UNLOAD" && ALREADY_AT_HUB_PIECE_STATUSES.has(status)) {
        return 0;
      }

      const totalQty = Math.max(Number(pkg.quantity) || 1, 1);
      const rawLoadedQty = Number(pkg.loadedQty);
      const hasLoadedQty = Number.isFinite(rawLoadedQty) && rawLoadedQty > 0;
      const loadedQty = Math.min(
        hasLoadedQty
          ? rawLoadedQty
          : ON_TRUCK_PIECE_STATUSES.has(status)
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
    },
    [tripId],
  );

  const getPackageIdentity = useCallback(
    (pkg) => pkg?.packageId || pkg?.trackingNumber || "",
    [],
  );

  const shouldPromptLoadedStatusAfterLoad = useCallback(
    (processedQuantity) => {
      if (action !== "LOAD" || scanStatus !== "LOADED") return false;

      const currentTripStatus = String(trip?.status || "").toUpperCase();
      if (
        currentTripStatus === "LOADED" ||
        currentTripStatus === "ARRIVED" ||
        trip?.manifestLocked
      ) {
        return false;
      }

      const itemPending = Number(trip?.itemPending);
      const totalItems = Number(trip?.totalItems) || 0;
      const totalLoaded = Number(trip?.totalLoaded) || 0;
      const currentPending = Number.isFinite(itemPending)
        ? itemPending
        : Math.max(totalItems - totalLoaded, 0);

      return totalItems > 0 && currentPending - processedQuantity <= 0;
    },
    [action, scanStatus, trip],
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

  const getProcessableItems = useCallback(
    (item, code) => {
      const packages = Array.isArray(item?.packages) ? item.packages : [];
      const shipmentOnTrip =
        item?.shipmentAssignedToTrip === true ||
        item?.requiresAssignment === false;
      const scanContext = {
        shipmentOnTrip,
        packageAssignmentState: item?.packageAssignmentState || null,
      };

      const targetPackages =
        item?.scanType === "PACKAGE"
          ? [findPackageByScan(packages, code, item.packageId)].filter(Boolean)
          : packages;

      return targetPackages
        .map((pkg) => {
          const packageId = getPackageIdentity(pkg);
          const quantity = getPackageAvailableQty(
            pkg,
            action,
            scanStatus,
            scanContext,
          );

          return packageId && quantity > 0 ? { packageId, quantity } : null;
        })
        .filter(Boolean);
    },
    [
      action,
      findPackageByScan,
      getPackageAvailableQty,
      getPackageIdentity,
      scanStatus,
    ],
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

  const finalizeTripReconciliation = useCallback(
    async ({ notify = true } = {}) => {
      if (!tripId) return null;

      const token = await user?.getIdToken();
      const res = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/handoff-reconciliation`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notify, autoPromote: true }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to finalize reconciliation.");
      }

      if (trip && data.tripStatus) {
        trip.status = data.tripStatus;
      }

      return data;
    },
    [tripId, user, trip],
  );

  const loadHandoffReview = useCallback(
    async ({
      openWhenReadyOnly = false,
      autoPromoteOnReady = true,
      silent = false,
    } = {}) => {
      if (!tripId) return null;

      if (!silent) setLoading(true);
      setError("");

      try {
        let summary = await fetchJsonWithAuth(
          `/api/trips/${encodeURIComponent(tripId)}/handoff-reconciliation`,
        );

        const tripStatusForFinalize = String(
          summary.tripStatus || trip?.status || "",
        ).toUpperCase();
        const tripAlreadyArrived = tripStatusForFinalize === "ARRIVED";
        const tripAlreadyReconciled = isManifestReconciled(trip);
        const shouldFinalizeReconcile =
          autoPromoteOnReady &&
          summary.ready &&
          !summary.promoted &&
          !tripAlreadyReconciled &&
          (summary.lifecycle?.canPromoteToArrived || tripAlreadyArrived);

        if (shouldFinalizeReconcile) {
          summary = await finalizeTripReconciliation({ notify: true });
          onRefresh?.();
          if (trip && summary.tripStatus) {
            trip.status = summary.tripStatus;
          }
          if (trip) {
            trip.manifestStatus = "RECONCILED";
          }
          setSuccessNotice({
            action: "UNLOAD",
            scanStatus: "RECONCILED",
            scanStatusLabel: "Manifest reconciled",
            code: tripId,
            shipmentId: null,
            scanType: "TRIP",
            totalQuantity:
              summary.totals?.unloadedPieces ||
              summary.totals?.unloadedShipments ||
              0,
            needsLoadedStatusPrompt: false,
            message:
              "Manifest reconciled. Release shipments to delivery operations when ready.",
          });
        }

        const tripStatusAfter = String(
          summary.tripStatus || trip?.status || "",
        ).toUpperCase();
        const tripArrived =
          tripStatusAfter === "ARRIVED" || summary.promoted === true;

        if (summary.ready && !tripArrived && summary.lifecycle?.canPromoteToArrived) {
          setNeedsArrival(true);
        } else {
          setNeedsArrival(false);
        }

        setHandoffSummary(summary);
        setMissingRemarks((prev) => {
          const seededRemarks = {};
          (summary.missingShipments || []).forEach((item) => {
            seededRemarks[item.id] = prev[item.id] || "";
          });
          return seededRemarks;
        });

        const shouldOpen =
          !openWhenReadyOnly ||
          (summary.ready &&
            (summary.totals?.manifestPieces > 0 ||
              summary.totals?.manifestShipments > 0));

        if (shouldOpen) {
          setNeedsHandoff(true);
          setResolvedItem(null);
          setNeedsAssignmentItem(null);
          setNeedsNextTrip(false);
        }

        return summary;
      } catch (err) {
        setError(err.message || "Failed to reconcile manifest.");
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [fetchJsonWithAuth, finalizeTripReconciliation, onRefresh, tripId, trip],
  );

  const handleReviewHandoff = useCallback(
    () =>
      loadHandoffReview({
        autoPromoteOnReady: !isManifestReconciled(trip),
        silent: true,
      }),
    [loadHandoffReview, trip],
  );

  const openReleaseHandoff = useCallback(async () => {
    setError("");
    setSuccessNotice(null);
    setAction("UNLOAD");
    await loadHandoffReview({
      openWhenReadyOnly: false,
      autoPromoteOnReady: !isManifestReconciled(trip),
    });
  }, [loadHandoffReview, trip]);

  useEffect(() => {
    if (!isOpen) {
      handoffBootstrappedRef.current = false;
      return;
    }
    if (!tripId || !isManifestReconciled(trip)) return;
    if (handoffBootstrappedRef.current) return;
    handoffBootstrappedRef.current = true;
    setError("");
    setSuccessNotice(null);
    setAction("UNLOAD");
    loadHandoffReview({
      openWhenReadyOnly: false,
      autoPromoteOnReady: false,
    });
    // Intentionally once per modal open — avoid refresh loop from trip prop updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tripId, trip?.manifestStatus, trip?.reconciledAt]);

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
      const shouldOfferLoadedStatus =
        shouldPromptLoadedStatusAfterLoad(totalQuantity);

      showSuccessNotice({
        action,
        scanStatus,
        scanStatusLabel:
          SCAN_STATUS_OPTIONS[action]?.find((opt) => opt.value === scanStatus)
            ?.label || scanStatus,
        code,
        tripId,
        shipmentId: item.shipmentId,
        scanType: item.scanType,
        totalQuantity,
        needsLoadedStatusPrompt: shouldOfferLoadedStatus,
      });
      onRefresh?.();

      if (shouldOfferLoadedStatus) {
        if (trip) {
          trip.itemPending = 0;
          trip.totalLoaded = trip.totalItems || trip.totalLoaded || 0;
        }
      }

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
      shouldPromptLoadedStatusAfterLoad,
      showSuccessNotice,
      trip,
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
    if (successNoticeTimerRef.current) {
      clearTimeout(successNoticeTimerRef.current);
      successNoticeTimerRef.current = null;
    }
    setSuccessNotice(null);
    setAlreadyLoadedNotice(null);
    try {
      const result = await onResolveScan({
        tripId,
        action,
        scanCode: cleanCode,
      });
      if (!result?.found) {
        if (action === "UNLOAD" && isManifestReconciled(trip)) {
          await openReleaseHandoff();
          return;
        }
        return setError(result.message || "Label not found.");
      }

      if (result.packageAssignmentState === "ON_OTHER_TRIP") {
        return setError(
          `Package ${result.packageId || cleanCode} is already assigned to trip ${result.packageCurrentTripId}. Transfer it before scanning on this trip.`,
        );
      }

      if (action === "LOAD" && result.alreadyLoaded && result.loadInfo) {
        setAlreadyLoadedNotice(result.loadInfo);
        setScanCode(cleanCode);
        setManualCode("");
        return;
      }

      setScanCode(cleanCode);
      setManualCode("");

      if (
        result.scanType !== "PACKAGE" &&
        result.requiresAssignment &&
        !recentlyAssigned.has(result.shipmentId)
      ) {
        const assignmentResult = await bulkAssignShipments({
          tripId,
          shipmentIds: [result.shipmentId],
          updatedBy: updatedBy(profile),
        });
        const assignmentData = assignmentResult?.data || assignmentResult || {};
        const assignmentErrors = Array.isArray(assignmentData.errors)
          ? assignmentData.errors
          : [];

        if (assignmentErrors.length) {
          throw new Error(assignmentErrors.join(" "));
        }

        if (!assignmentData.assigned) {
          throw new Error("Shipment could not be assigned to this trip.");
        }

        setRecentlyAssigned((prev) => new Set(prev).add(result.shipmentId));
      }

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

        nextResolvedItem = {
          ...result,
          packageId: packageIdentity,
          trackingNumber: targetPackage.trackingNumber || null,
        };
      }

      const itemsToProcess = getProcessableItems(nextResolvedItem, cleanCode);

      if (!itemsToProcess.length) {
        if (action === "LOAD") {
          const targetPkg =
            result.scanType === "PACKAGE"
              ? findPackageByScan(
                  result.packages,
                  cleanCode,
                  result.packageId,
                )
              : null;

          if (
            targetPkg &&
            isPackageFullyLoadedOnTrip(targetPkg, tripId)
          ) {
            setAlreadyLoadedNotice(
              buildAlreadyLoadedInfo({
                packageId: getPackageIdentity(targetPkg) || cleanCode,
                tripId,
                shipment: {
                  origin: trip?.origin,
                  originCode: trip?.originCode,
                },
                trip,
                targetPackage: targetPkg,
              }),
            );
            return;
          }

          return setError("No quantity is available to load for this scan.");
        }

        const shipmentOnTrip =
          result.shipmentAssignedToTrip === true ||
          result.requiresAssignment === false;
        const targetPkg =
          result.scanType === "PACKAGE"
            ? findPackageByScan(
                result.packages,
                cleanCode,
                result.packageId,
              )
            : null;

        return setError(
          explainUnloadBlockReason(targetPkg || result.packages?.[0], {
            tripId,
            shipmentOnTrip,
            packageAssignmentState: result.packageAssignmentState,
          }),
        );
      }

      await processItems({
        item: nextResolvedItem,
        code: cleanCode,
        itemsToProcess,
      });

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
    const assignmentItem = needsAssignmentItem;
    const success = await executeFirebaseCall(bulkAssignShipments, {
      tripId,
      shipmentIds: [assignmentItem.shipmentId],
      updatedBy: updatedBy(profile),
    });
    if (success) {
      setRecentlyAssigned((prev) =>
        new Set(prev).add(assignmentItem.shipmentId),
      );
      setNeedsAssignmentItem(null);

      if (action === "LOAD" && scanCode) {
        const itemsToProcess = getProcessableItems(assignmentItem, scanCode);
        if (itemsToProcess.length > 0) {
          await processItems({
            item: assignmentItem,
            code: scanCode,
            itemsToProcess,
          });
          setLoading(false);
          return;
        }
      }

      setResolvedItem(assignmentItem);
      if (scanCode) {
        setQuantities(
          Object.fromEntries(
            getProcessableItems(assignmentItem, scanCode).map(
              ({ packageId, quantity }) => [packageId, quantity],
            ),
          ),
        );
      }
    }
    setLoading(false);
  };

  const handleStartReceiving = async () => {
    setLoading(true);
    setError("");

    try {
      const success = await executeFirebaseCall(
        startReceiving,
        { tripId, updatedBy: updatedBy(profile) },
        () => {
          if (trip) {
            trip.status = "ARRIVED";
            trip.manifestStatus = "RECEIVING_IN_PROGRESS";
            trip.manifestLocked = true;
            trip.receivingStartedAt = new Date().toISOString();
          }
        },
      );
      if (!success) return;

      onRefresh?.();
      setNeedsStartReceiving(false);
      setBtnStatus("IDLE");
    } catch (err) {
      setError(err.message || "Could not start receiving.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkArrived = async () => {
    setLoading(true);
    setError("");

    try {
      if (handoffSummary?.ready && handoffSummary?.lifecycle?.canPromoteToArrived) {
        const summary = await finalizeTripReconciliation({ notify: true });
        setHandoffSummary(summary);
        if (trip && summary?.tripStatus) {
          trip.status = summary.tripStatus;
        }
        if (trip) {
          trip.manifestStatus = "RECONCILED";
        }
        setSuccessNotice({
          action: "UNLOAD",
          scanStatus: "RECONCILED",
          scanStatusLabel: "Manifest reconciled",
          code: tripId,
          shipmentId: null,
          scanType: "TRIP",
          totalQuantity: summary?.totals?.unloadedShipments || 0,
          needsLoadedStatusPrompt: false,
          message: "Manifest reconciled after handoff review.",
        });
      } else {
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
        if (!success) return;
      }

      onRefresh?.();
      setNeedsArrival(false);
      setBtnStatus("IDLE");
    } catch (err) {
      setError(err.message || "Could not mark trip as ARRIVED.");
    } finally {
      setLoading(false);
    }
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
          trip.manifestStatus = "LOCKED";
        }
      },
    );
    if (success) {
      setSuccessNotice({
        action: "LOAD",
        scanStatus: "LOCKED",
        scanStatusLabel: "Manifest locked",
        code: tripId,
        shipmentId: null,
        scanType: "TRIP",
        totalQuantity: 0,
        needsLoadedStatusPrompt: false,
        message:
          "Manifest locked. Trip stays LOADED — use Dispatch Trip in the trip drawer.",
      });
      setTimeout(() => {
        onRefresh?.();
        setNeedsLock(false);
        setBtnStatus("IDLE");
      }, 1000);
    }
  };

  const handleReleaseShipmentsFromTrip = async () => {
    const missing = handoffSummary?.missingShipments || [];
    const incompleteRemark = missing.find(
      (item) => !String(missingRemarks[item.id] || "").trim(),
    );

    if (incompleteRemark) {
      return setError(`Add remarks for ${incompleteRemark.shipmentId}.`);
    }

    let summaryForRelease = handoffSummary;

    if (!summaryForRelease?.lifecycle?.canReleaseForDelivery) {
      try {
        summaryForRelease = await finalizeTripReconciliation({ notify: false });
        setHandoffSummary(summaryForRelease);
        onRefresh?.();
        if (!summaryForRelease.lifecycle?.canReleaseForDelivery) {
          return setError(
            summaryForRelease.lifecycle?.releaseBlockReason ||
              "Trip must be ARRIVED before releasing shipments.",
          );
        }
      } catch (err) {
        return setError(err.message || "Could not mark trip as ARRIVED.");
      }
    }

    const unloaded = summaryForRelease?.unloadedShipments || [];
    const shipmentIds = unloaded
      .filter((row) => {
        if (!row?.id) return false;
        const status = row.status;
        return status == null || isEligibleForCheckerRelease(status);
      })
      .map((row) => row.id);

    if (!shipmentIds.length) {
      return setError(
        "No reconciled shipments on this trip are eligible to release.",
      );
    }

    const success = await executeFirebaseCall(releaseForDeliveryOperations, {
      tripId,
      shipmentIds,
      remarks:
        "Released for delivery operations from trip manifest reconciliation.",
    });
    if (success) {
      setTimeout(() => {
        onRefresh?.();
        onClose?.();
        resetFlow();
      }, 1000);
    }
  };

  const handleReleaseSingleShipment = async () => {
    const item = resolvedItem;
    if (!item?.shipmentId && !item?.id) {
      return setError("No shipment selected to release.");
    }

    if (tripId) {
      let canRelease = handoffSummary?.lifecycle?.canReleaseForDelivery;
      if (!canRelease) {
        const gate = isTripReleaseEligible({
          status: trip?.status,
          reconciledAt: trip?.reconciledAt,
        });
        canRelease = gate.eligible;
        if (!canRelease) {
          return setError(
            gate.reason ||
              handoffSummary?.lifecycle?.releaseBlockReason ||
              "Trip must be ARRIVED before releasing shipments.",
          );
        }
      }
    }

    const docId = item.id || item.shipmentId;
    const success = await executeFirebaseCall(releaseForDeliveryOperations, {
      tripId,
      shipmentIds: [docId],
      remarks: "Released for delivery operations after warehouse receive.",
    });
    if (success) {
      setTimeout(() => {
        onRefresh?.();
        setNeedsNextTrip(false);
        resetFlow();
      }, 1000);
    }
  };

  const handleConfirm = async () => {
    const itemsToProcess = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([pkgId, qty]) => ({ packageId: pkgId, quantity: qty }));

    if (itemsToProcess.length === 0)
      return setError("No quantity is available to process for this scan.");

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
      const shouldOfferLoadedStatus =
        shouldPromptLoadedStatusAfterLoad(totalQuantity);

      showSuccessNotice({
        action,
        scanStatus,
        scanStatusLabel:
          SCAN_STATUS_OPTIONS[action]?.find((opt) => opt.value === scanStatus)
            ?.label || scanStatus,
        code: scanCode,
        tripId,
        shipmentId: resolvedItem.shipmentId,
        scanType: resolvedItem.scanType,
        totalQuantity,
        needsLoadedStatusPrompt: shouldOfferLoadedStatus,
      });
      onRefresh?.();

      if (shouldOfferLoadedStatus) {
        if (trip) {
          trip.itemPending = 0;
          trip.totalLoaded = trip.totalItems || trip.totalLoaded || 0;
        }
      }

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
      needsStartReceiving,
      needsUnlock,
      needsLoadedStatus,
      needsLock,
      needsNextTrip,
      needsHandoff,
      handoffSummary,
      missingRemarks,
      loading,
      error,
      successNotice,
      alreadyLoadedNotice,
      btnStatus,
    },
    actions: {
      setAction: setScannerAction,
      setScanStatus,
      setQuantities,
      setManualCode,
      setMissingRemarks,
      setError,
      setSuccessNotice,
      setNeedsLoadedStatus,
      setNeedsLock,
      setNeedsUnlock,
      setNeedsArrival,
      setNeedsStartReceiving,
      resetFlow,
      resetScanResult,
      handleResolveScan,
      handleAssignShipment,
      handleMarkArrived,
      handleStartReceiving,
      handleUnlockManifest,
      handleSetTripLoaded,
      handleLockManifest,
      handleReleaseShipmentsFromTrip,
      handleReleaseSingleShipment,
      handleReviewHandoff,
      openReleaseHandoff,
      handleConfirm,
    },
  };
}
