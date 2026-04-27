"use client";

import { useState, useCallback } from "react";

// 1. Import your centralized Firebase functions
import {
  bulkAssignShipments,
  updateTripStatus,
  unlockTripManifest,
  generateTripManifest,
} from "@/app/utility/FirebaseFunctions"; // Adjust path if your file is located elsewhere

export default function useScannerLogic({
  trip,
  onResolveScan,
  onConfirmOperation,
  onClose,
  user,
}) {
  const tripId = trip?.tripId || trip?.id || "";

  // Core State
  const [action, setAction] = useState(null);
  const [scanCode, setScanCode] = useState("");
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

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [btnStatus, setBtnStatus] = useState("IDLE");

  const resetFlow = useCallback(() => {
    setAction(null);
    setScanCode("");
    setResolvedItem(null);
    setQuantities({});
    setNeedsAssignmentItem(null);
    setNeedsArrival(false);
    setNeedsUnlock(false);
    setNeedsLoadedStatus(false);
    setNeedsLock(false);
    setNeedsNextTrip(false);
    setBtnStatus("IDLE");
    setLoading(false);
    setError("");
  }, []);

  const handleResolveScan = async (code) => {
    const cleanCode = String(code || "").trim();
    if (!action) return setError("Please choose Load or Unload first.");
    if (!cleanCode) return setError("Please scan or enter a label.");
    if (!tripId) return setError("No trip selected.");

    setLoading(true);
    setError("");
    try {
      const result = await onResolveScan({
        tripId,
        action,
        scanCode: cleanCode,
      });
      if (!result?.found) return setError(result.message || "Label not found.");

      setScanCode(cleanCode);
      if (
        result.requiresAssignment &&
        !recentlyAssigned.has(result.shipmentId)
      ) {
        setNeedsAssignmentItem(result);
      } else {
        setResolvedItem(result);
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
      { tripId, status: "ARRIVED", notify: false },
      () => {
        if (trip) trip.status = "ARRIVED";
      },
    );
    if (success)
      setTimeout(() => {
        setNeedsArrival(false);
        if (trip?.manifestLocked) setNeedsUnlock(true);
        setBtnStatus("IDLE");
      }, 1000);
  };

  const handleUnlockManifest = async () => {
    const success = await executeFirebaseCall(
      unlockTripManifest,
      { tripId },
      () => {
        if (trip) trip.manifestLocked = false;
      },
    );
    if (success)
      setTimeout(() => {
        setNeedsUnlock(false);
        setBtnStatus("IDLE");
      }, 1000);
  };

  const handleSetTripLoaded = async () => {
    const success = await executeFirebaseCall(
      updateTripStatus,
      { tripId, status: "LOADED" },
      () => {
        if (trip) trip.status = "LOADED";
      },
    );
    if (success)
      setTimeout(() => {
        setNeedsLoadedStatus(false);
        setNeedsLock(true);
        setBtnStatus("IDLE");
      }, 1000);
  };

  const handleLockManifest = async () => {
    const success = await executeFirebaseCall(
      generateTripManifest,
      { tripId },
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
        setNeedsLock(false);
        setBtnStatus("IDLE");
      }, 1000);
    }
  };

  const handleAssignNextTrip = async () => {
    const success = await executeFirebaseCall(bulkAssignShipments, {
      tripId: selectedNextTrip,
      shipmentIds: [resolvedItem.shipmentId],
    });
    if (success)
      setTimeout(() => {
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
      });

      // If UNLOAD, check for next trips
      if (action === "UNLOAD") {
        const token = await user?.getIdToken();
        const res = await fetch("/api/trips/delivery", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tripData = await res.json();
        if (tripData.trips?.length > 0) {
          setAvailableTrips(tripData.trips);
          setSelectedNextTrip(tripData.trips[0].id);
          setNeedsNextTrip(true);
          return; // Stop here, show next trip prompt
        }
      }

      onClose?.();
      resetFlow();
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
      scanCode,
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
      loading,
      error,
      btnStatus,
    },
    actions: {
      setAction,
      setQuantities,
      setSelectedNextTrip,
      setError,
      setNeedsLoadedStatus,
      setNeedsLock,
      setNeedsUnlock,
      setNeedsArrival,
      resetFlow,
      handleResolveScan,
      handleAssignShipment,
      handleMarkArrived,
      handleUnlockManifest,
      handleSetTripLoaded,
      handleLockManifest,
      handleAssignNextTrip,
      handleConfirm,
    },
  };
}
