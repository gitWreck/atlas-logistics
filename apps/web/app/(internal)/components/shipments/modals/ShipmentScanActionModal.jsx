"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBarcode,
  faCamera,
  faCheck,
  faCircleNotch,
  faLock,
  faUnlock,
  faTimes,
  faTruckRampBox,
  faUndo,
} from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";
import { getFunctions, httpsCallable } from "firebase/functions";
import StatusButton from "../../ui/StatusButton"; // Adjust path if necessary
import {
  bulkAssignShipments,
  generateTripManifest,
  unlockTripManifest,
  updateTripStatus,
} from "@/app/utility/FirebaseFunctions";
import { updatedBy } from "@/app/utility/utilities";

const ACTIONS = {
  LOAD: "LOAD",
  UNLOAD: "UNLOAD",
};

export default function ShipmentScanActionModal({
  isOpen = false,
  onClose,
  trip = null,
  isDark = false,
  onResolveScan,
  onConfirmOperation,
  onRefresh,
  profile,
}) {
  const theme = getModalThemeClasses(isDark);
  const actionTheme = getModalActionClasses();

  // --- 1. CORE STATES ---
  const [action, setAction] = useState(null);
  const [manualCode, setManualCode] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [resolvedItem, setResolvedItem] = useState(null);
  const [quantities, setQuantities] = useState({});

  // --- 2. INTERCEPTOR STATES ---
  const [needsAssignmentItem, setNeedsAssignmentItem] = useState(null);
  const [recentlyAssigned, setRecentlyAssigned] = useState(new Set());
  const [needsArrival, setNeedsArrival] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [needsLoadedStatus, setNeedsLoadedStatus] = useState(false);
  const [needsLock, setNeedsLock] = useState(false);

  // --- 3. UI STATES ---
  const [cameraOpen, setCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [btnStatus, setBtnStatus] = useState("IDLE");

  const tripId = trip?.tripId || trip?.id || "";

  // --- 4. FLOW MANAGEMENT ---
  const resetFlow = useCallback(() => {
    setAction(null);
    setManualCode("");
    setScanCode("");
    setResolvedItem(null);
    setQuantities({});
    setNeedsAssignmentItem(null);
    setNeedsArrival(false);
    setNeedsUnlock(false);
    setNeedsLoadedStatus(false);
    setNeedsLock(false);
    setBtnStatus("IDLE");
    setCameraOpen(false);
    setLoading(false);
    setError("");
  }, []);

  useEffect(() => {
    if (isOpen) resetFlow();
  }, [isOpen, resetFlow]);

  // --- 5. RESOLVE SCAN LOGIC ---
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

      if (!result?.found) {
        setError(result.message || "No shipment or package found.");
        return;
      }

      setScanCode(cleanCode);
      setCameraOpen(false);

      // ASSIGNMENT INTERCEPTOR
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

      onRefresh();
    }
  };

  // --- 6. FIREBASE ACTION HANDLERS ---
  const handleAssignShipment = async () => {
    setLoading(true);
    setError("");
    try {
      await bulkAssignShipments({
        tripId: tripId,
        shipmentIds: [needsAssignmentItem.shipmentId],
        updatedBy: updatedBy(profile),
      });

      setRecentlyAssigned((prev) =>
        new Set(prev).add(needsAssignmentItem.shipmentId),
      );
      setResolvedItem(needsAssignmentItem);
      setNeedsAssignmentItem(null);
    } catch (err) {
      setError(err.message || "Failed to assign shipment to trip.");
    } finally {
      setLoading(false);
      onRefresh();
    }
  };

  const handleMarkArrived = async () => {
    setBtnStatus("LOADING");
    setError("");
    try {
      await updateTripStatus({
        tripId: tripId,
        status: "ARRIVED",
        notify: false,
        updatedBy: updatedBy(profile),
      });

      if (trip) trip.status = "ARRIVED";
      setBtnStatus("SUCCESS");

      setTimeout(() => {
        setNeedsArrival(false);
        if (trip?.manifestLocked) setNeedsUnlock(true);
        setBtnStatus("IDLE");
      }, 1000);

      onRefresh();
    } catch (err) {
      setError(err.message || "Failed to mark arrived.");
      setBtnStatus("ERROR");
    }
  };

  const handleUnlockManifest = async () => {
    setBtnStatus("LOADING");
    setError("");
    try {
      await unlockTripManifest({
        tripId: tripId,
        reason: "trip needs to be unloaded",
        updatedBy: updatedBy(profile),
      });

      if (trip) trip.manifestLocked = false;
      setBtnStatus("SUCCESS");

      setTimeout(() => {
        setNeedsUnlock(false);
        setBtnStatus("IDLE");
      }, 1000);

      onRefresh();
    } catch (err) {
      setError(err.message || "Failed to unlock manifest.");
      setBtnStatus("ERROR");
    }
  };

  const handleSetTripLoaded = async () => {
    setBtnStatus("LOADING");
    setError("");
    try {
      await updateTripStatus({ tripId: tripId, status: "LOADED" });

      if (trip) trip.status = "LOADED";
      setBtnStatus("SUCCESS");

      setTimeout(() => {
        setNeedsLoadedStatus(false);
        setNeedsLock(true);
        setBtnStatus("IDLE");
      }, 1000);

      onRefresh();
    } catch (err) {
      setError("Failed to mark as loaded.");
      setBtnStatus("ERROR");
    }
  };

  const handleLockManifest = async () => {
    setBtnStatus("LOADING");
    setError("");
    try {
      // 1. Generate the Manifest
      await generateTripManifest({
        tripId: tripId,
        updatedBy: updatedBy(profile),
      });

      // 2. Automatically set to IN_TRANSIT
      await updateTripStatus({
        tripId: tripId,
        status: "IN_TRANSIT",
        updatedBy: updatedBy(profile),
      }); // NEW

      // Optimistic local update
      if (trip) {
        trip.manifestLocked = true;
        trip.status = "IN_TRANSIT"; // NEW
      }

      setBtnStatus("SUCCESS");

      setTimeout(() => {
        setNeedsLock(false);
        setBtnStatus("IDLE");
      }, 1000);
    } catch (err) {
      setError(err.message || "Failed to lock manifest.");
      setBtnStatus("ERROR");
    }
  };

  const handleConfirm = async () => {
    if (!resolvedItem) return;

    const itemsToProcess = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([pkgId, qty]) => ({ packageId: pkgId, quantity: qty }));

    if (itemsToProcess.length === 0) {
      return setError("No quantity is available to process for this scan.");
    }

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

      onClose?.();
      resetFlow();
    } catch (err) {
      setError(err.message || "Failed to process scan action.");
    } finally {
      setLoading(false);
      onRefresh();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center sm:p-4">
      <div className={`absolute inset-0 ${theme.overlay}`} onClick={onClose} />

      <div
        className={`relative w-full max-w-lg h-full sm:h-auto sm:max-h-[92vh] flex flex-col sm:rounded-2xl border overflow-hidden ${theme.modal}`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b flex items-center justify-between ${theme.header}`}
        >
          <div className="min-w-0">
            <h2 className={`font-bold text-lg ${theme.title}`}>Scan Package</h2>
            <p className={`text-xs truncate ${theme.helperText}`}>{tripId}</p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${theme.closeButton}`}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <ActionSelector
            action={action}
            trip={trip}
            theme={theme}
            resetFlow={resetFlow}
            setAction={setAction}
            setNeedsArrival={setNeedsArrival}
            setNeedsUnlock={setNeedsUnlock}
            setNeedsLoadedStatus={setNeedsLoadedStatus}
            setNeedsLock={setNeedsLock}
            setError={setError}
          />

          {needsArrival ? (
            <div
              className={`rounded-xl border p-6 text-center space-y-4 ${theme.panelSurface}`}
            >
              <div className="text-blue-500 mb-2">
                <FontAwesomeIcon icon={faTruckRampBox} size="3x" />
              </div>
              <h3 className="font-bold text-lg">Mark Trip as Arrived</h3>
              <p className="text-sm opacity-80 mb-4">
                You must mark this trip as arrived before unloading.
              </p>
              <StatusButton
                status={btnStatus}
                label="Mark as Arrived"
                icon={faCheck}
                variant="blue"
                onClick={handleMarkArrived}
              />
            </div>
          ) : needsUnlock ? (
            <div
              className={`rounded-xl border p-6 text-center space-y-4 ${theme.panelSurface}`}
            >
              <div className="text-amber-500 mb-2">
                <FontAwesomeIcon icon={faLock} size="3x" />
              </div>
              <h3 className="font-bold text-lg">Manifest Locked</h3>
              <p className="text-sm opacity-80 mb-4">
                You must unlock the manifest before you can scan items out.
              </p>
              <StatusButton
                status={btnStatus}
                label="Unlock Manifest"
                loadingLabel="Unlocking..."
                successLabel="Unlocked!"
                icon={faUnlock}
                variant="amber"
                onClick={handleUnlockManifest}
              />
            </div>
          ) : needsLoadedStatus ? (
            <div
              className={`rounded-xl border p-6 text-center space-y-4 ${theme.panelSurface}`}
            >
              <div className="text-emerald-500 mb-2">
                <FontAwesomeIcon icon={faCheck} size="3x" />
              </div>
              <h3 className="font-bold text-lg">Trip is Fully Loaded</h3>
              <p className="text-sm opacity-80 mb-4">
                All pending items are loaded. Change status to LOADED?
              </p>
              <div className="space-y-2">
                <StatusButton
                  status={btnStatus}
                  label="Lock Manifest"
                  loadingLabel="Locking..."
                  successLabel="Locked!"
                  icon={faLock}
                  variant="emerald"
                  onClick={handleLockManifest}
                />
                {/* ONLY show skip if the trip is NOT actually loaded yet */}
                {trip?.status?.toUpperCase() !== "LOADED" ||
                  (trip?.status?.toUpperCase() !== "IN_TRANSIT" && (
                    <button
                      onClick={() => setNeedsLock(false)}
                      className="text-xs opacity-60 underline mt-2"
                    >
                      Skip & load extra items
                    </button>
                  ))}
              </div>
            </div>
          ) : needsLock ? (
            <div
              className={`rounded-xl border p-6 text-center space-y-4 ${theme.panelSurface}`}
            >
              <div className="text-emerald-500 mb-2">
                <FontAwesomeIcon icon={faLock} size="3x" />
              </div>
              <h3 className="font-bold text-lg">Ready for Dispatch</h3>
              <p className="text-sm opacity-80 mb-4">
                The trip is loaded. Lock the manifest to prevent further
                changes.
              </p>
              <div className="space-y-2">
                <StatusButton
                  status={btnStatus}
                  label="Lock Manifest"
                  loadingLabel="Locking..."
                  successLabel="Locked!"
                  icon={faLock}
                  variant="emerald"
                  onClick={handleLockManifest}
                />
                <button
                  onClick={() => setNeedsLock(false)}
                  className="text-xs opacity-60 underline mt-2"
                >
                  Skip & load extra items
                </button>
              </div>
            </div>
          ) : needsAssignmentItem ? (
            <div
              className={`rounded-xl border p-6 text-center space-y-4 ${theme.panelSurface}`}
            >
              <div className="text-amber-500 mb-2">
                <FontAwesomeIcon icon={faTruckRampBox} size="3x" />
              </div>
              <h3 className="font-bold text-lg">Assignment Required</h3>
              <p className="text-sm opacity-80">
                Shipment <strong>{needsAssignmentItem.shipmentId}</strong> is
                not assigned to this trip. You must assign it before you can{" "}
                {action?.toLowerCase()} its packages.
              </p>
              <button
                onClick={handleAssignShipment}
                disabled={loading}
                className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${
                  loading ? "bg-gray-500" : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {loading ? "Assigning..." : "Assign Shipment Now"}
              </button>
            </div>
          ) : resolvedItem ? (
            <ResolvedItemPanel
              item={resolvedItem}
              action={action}
              quantities={quantities}
              setQuantities={setQuantities}
              theme={theme}
            />
          ) : action ? (
            <div className="space-y-4">
              {!cameraOpen ? (
                <button
                  onClick={() => {
                    setError("");
                    setCameraOpen(true);
                  }}
                  className={`w-full rounded-xl border p-6 flex flex-col items-center gap-2 font-bold ${theme.panelSurface}`}
                >
                  <FontAwesomeIcon icon={faCamera} size="lg" />
                  <span>Open Phone Camera</span>
                </button>
              ) : (
                <CameraScanner
                  onDetected={handleResolveScan}
                  onClose={() => setCameraOpen(false)}
                  setError={setError}
                />
              )}

              <ManualInput
                value={manualCode}
                onChange={setManualCode}
                onSubmit={() => handleResolveScan(manualCode)}
                loading={loading}
                theme={theme}
              />
            </div>
          ) : null}

          {error && (
            <div className={`${theme.errorBox} p-3 rounded-lg text-sm`}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex gap-3 ${theme.header}`}>
          {resolvedItem || needsAssignmentItem ? (
            <>
              <button
                onClick={resetFlow}
                className={`flex-1 ${theme.secondaryButton}`}
              >
                <FontAwesomeIcon icon={faUndo} className="mr-2" /> Reset
              </button>

              {resolvedItem && !needsAssignmentItem && (
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className={`flex-[2] ${actionTheme.primary}`}
                >
                  {loading ? (
                    <FontAwesomeIcon
                      icon={faCircleNotch}
                      spin
                      className="mr-2"
                    />
                  ) : (
                    <FontAwesomeIcon icon={faCheck} className="mr-2" />
                  )}
                  {action === ACTIONS.LOAD ? "Confirm Load" : "Confirm Unload"}
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onClose}
              className={`w-full ${theme.secondaryButton}`}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

function ActionSelector({
  action,
  trip,
  theme,
  resetFlow,
  setAction,
  setNeedsArrival,
  setNeedsUnlock,
  setNeedsLoadedStatus,
  setNeedsLock,
  setError,
}) {
  const currentTripStatus = String(trip?.status || "").trim().toUpperCase();
  const isManifestLocked = !!trip?.manifestLocked;
  const canUnloadFromStatus = ["ARRIVED", "LOADED", "IN_TRANSIT", "COMPLETED"].includes(
    currentTripStatus,
  );

  // LOGIC: Disable LOAD if trip is moving or already locked down
  const isLoadDisabled = currentTripStatus === "IN_TRANSIT" || isManifestLocked;

  const options = [
    {
      id: ACTIONS.LOAD,
      label: "Load",
      icon: faTruckRampBox,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/50",
      disabled: isLoadDisabled, // <-- Add this property
    },
    {
      id: ACTIONS.UNLOAD,
      label: "Unload",
      icon: faUndo,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/50",
      disabled: false, // Unload is never strictly disabled here (intercepted instead)
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={opt.disabled} // <-- Apply the HTML disabled attribute
          onClick={() => {
            resetFlow();
            const currentTripStatus = String(trip?.status || "")
              .trim()
              .toUpperCase();

            // UNLOAD INTERCEPTOR
            if (opt.id === ACTIONS.UNLOAD) {
              if (
                currentTripStatus === "ARRIVED" &&
                trip?.manifestLocked
              ) {
                setNeedsUnlock(true);
                setAction(opt.id);
                return;
              } else if (!canUnloadFromStatus) {
                setError(
                  `Cannot unload. Trip status is currently ${currentTripStatus || "UNKNOWN"}.`,
                );
                return;
              }
            }

            // LOAD INTERCEPTOR
            if (opt.id === ACTIONS.LOAD) {
              const isFull = trip?.itemPending === 0 && trip?.totalItems > 0;

              if (currentTripStatus === "LOADED" && !trip?.manifestLocked) {
                setNeedsLock(true);
                setAction(opt.id);
                return;
              } else if (
                isFull &&
                currentTripStatus !== "LOADED" &&
                currentTripStatus !== "ARRIVED"
              ) {
                setNeedsLoadedStatus(true);
                setAction(opt.id);
                return;
              }
            }

            setAction(opt.id);
          }}
          className={`rounded-xl border p-4 text-left transition-all relative overflow-hidden ${
            opt.disabled
              ? "opacity-50 cursor-not-allowed bg-gray-500/5 border-gray-500/20 grayscale" // <-- Disabled styles
              : action === opt.id
                ? `${opt.bg} ${opt.color} ${opt.border}`
                : theme.panelSurface
          }`}
        >
          <FontAwesomeIcon icon={opt.icon} className="mb-2" />
          <div className="font-bold">{opt.label}</div>

          {/* Add a tiny reason text if it's disabled */}
          {opt.disabled && opt.id === ACTIONS.LOAD && (
            <div className="text-[9px] mt-1 text-red-500 font-bold uppercase">
              {isManifestLocked ? "Manifest Locked" : "In Transit"}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function CameraScanner({ onDetected, onClose, setError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let stopScanning = false;

    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", focusMode: "continuous" },
        });

        if (stopScanning) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        if ("BarcodeDetector" in window) {
          const detector = new window.BarcodeDetector({
            formats: ["qr_code", "code_128"],
          });

          const renderFrame = async () => {
            if (stopScanning || !videoRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                onDetected(barcodes[0].rawValue);
                return;
              }
            } catch (e) {
              // silent frame fail
            }
            requestAnimationFrame(renderFrame);
          };
          renderFrame();
        } else {
          setError(
            "Native scanner not supported on this device. Please use manual input.",
          );
          onClose();
        }
      } catch (err) {
        setError("Camera access denied.");
        onClose();
      }
    }

    setupCamera();

    return () => {
      stopScanning = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [onDetected, onClose, setError]);

  return (
    <div className="rounded-xl overflow-hidden bg-black relative aspect-square">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 border-2 border-blue-500 m-12 rounded-lg opacity-50 shadow-[0_0_0_999px_rgba(0,0,0,0.5)] pointer-events-none" />
      <button
        onClick={onClose}
        className="absolute bottom-4 right-4 bg-black/50 text-white px-4 py-2 rounded-lg text-sm font-bold"
      >
        Close
      </button>
    </div>
  );
}

function ManualInput({ value, onChange, onSubmit, loading, theme }) {
  return (
    <div className={`rounded-xl border p-4 ${theme.panelSurface}`}>
      <label className="text-[10px] font-bold uppercase opacity-60">
        Manual Entry
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter ID or Label..."
          className={`flex-1 rounded-lg border px-3 py-2 text-sm ${theme.input}`}
        />
        <button
          disabled={loading}
          className="inline-flex min-w-20 items-center justify-center gap-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-70"
        >
          {loading && <FontAwesomeIcon icon={faCircleNotch} spin />}
          {loading ? "Checking" : "Check"}
        </button>
      </form>
    </div>
  );
}

function ResolvedItemPanel({ item, action, quantities, setQuantities, theme }) {
  const isShipment = item.scanType === "SHIPMENT";

  const displayPackages = isShipment
    ? item.packages || []
    : item.packages?.filter((p) => p.packageId === item.packageId) || [];

  const getAvailableForPkg = (pkg) => {
    if (action === "LOAD") return (pkg.quantity || 0) - (pkg.loadedQty || 0);
    return pkg.loadedQty || 0;
  };

  useEffect(() => {
    const autoQuantities = {};
    displayPackages.forEach((pkg) => {
      const available = getAvailableForPkg(pkg);
      if (pkg.packageId && available > 0) {
        autoQuantities[pkg.packageId] = available;
      }
    });
    setQuantities(autoQuantities);
  }, [item, action, displayPackages, setQuantities]);

  return (
    <div className="space-y-4">
      {/* Header Panel */}
      <div className={`rounded-xl border p-4 ${theme.panelSurface}`}>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2">
            <FontAwesomeIcon icon={faBarcode} />
            {item.scanType}
          </div>
          <h3 className={`font-bold text-lg truncate ${theme.title}`}>
            {item.label}
          </h3>
          <div className="text-xs opacity-60 mt-1 truncate">
            Dest: {item.destination}
          </div>
        </div>
      </div>

      {/* Package Manifest Checklist */}
      <div
        className={`rounded-xl border overflow-hidden ${theme.panelSurface}`}
      >
        <div className="bg-black/10 p-3 border-b border-white/5 text-[10px] font-bold uppercase opacity-60">
          Manifest ({displayPackages.length} Items)
        </div>

        <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
          {displayPackages.map((pkg) => {
            const available = getAvailableForPkg(pkg);
            const qtyToProcess = quantities[pkg.packageId] ?? available;
            const isFullyProcessed = available <= 0;

            return (
              <div
                key={pkg.packageId}
                className="p-3 flex justify-between items-center gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-mono font-bold truncate">
                    {pkg.packageId}
                  </div>
                  <div className="flex gap-2 text-[10px] opacity-60 mt-0.5">
                    <span>Tot: {pkg.quantity}</span> •
                    <span
                      className={
                        isFullyProcessed ? "text-amber-500" : "text-green-500"
                      }
                    >
                      {available} avail
                    </span>
                  </div>
                </div>

                <div
                  className={`w-14 shrink-0 text-center text-lg font-bold tabular-nums ${isFullyProcessed ? "opacity-30" : ""}`}
                >
                  {isFullyProcessed ? "—" : qtyToProcess}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
