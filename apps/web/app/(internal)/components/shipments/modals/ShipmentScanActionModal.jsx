"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBarcode,
  faCamera,
  faCheck,
  faCircleNotch,
  faKeyboard,
  faTimes,
  faTruckRampBox,
  faUndo,
} from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";
import {
  bulkAssignShipments,
  updateTripStatus,
} from "@/app/utility/FirebaseFunctions";

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
}) {
  const theme = getModalThemeClasses(isDark);
  const actionTheme = getModalActionClasses();

  // Primary States
  const [action, setAction] = useState(null);
  const [manualCode, setManualCode] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [resolvedItem, setResolvedItem] = useState(null);
  const [quantities, setQuantities] = useState({});

  // Assignment Interception States
  const [needsAssignmentItem, setNeedsAssignmentItem] = useState(null);
  const [recentlyAssigned, setRecentlyAssigned] = useState(new Set());
  const [needsArrival, setNeedsArrival] = useState(false);

  // UI States
  const [cameraOpen, setCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tripId = trip?.tripId || trip?.id || "";

  const resetFlow = useCallback(() => {
    setAction(null);
    setManualCode("");
    setScanCode("");
    setResolvedItem(null);
    setQuantities({});
    setNeedsAssignmentItem(null);
    setNeedsArrival(false); // ADD THIS LINE
    setCameraOpen(false);
    setLoading(false);
    setError("");
  }, []);

  useEffect(() => {
    if (isOpen) resetFlow();
  }, [isOpen, resetFlow]);

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

      // Check if it requires assignment AND hasn't been assigned in this session yet
      if (
        result.requiresAssignment &&
        !recentlyAssigned.has(result.shipmentId)
      ) {
        setNeedsAssignmentItem(result); // Trap the user on the Assignment Prompt
      } else {
        setResolvedItem(result); // Safe to proceed directly to quantities
      }

      setQuantities({});
    } catch (err) {
      setError(err.message || "Failed to check scanned label.");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignShipment = async () => {
    setLoading(true);
    setError("");

    try {
      await bulkAssignShipments({
        tripId: tripId,
        shipmentIds: [needsAssignmentItem.shipmentId],
      });

      // 1. Add to local memory so other packages in this shipment skip the prompt
      setRecentlyAssigned((prev) =>
        new Set(prev).add(needsAssignmentItem.shipmentId),
      );

      // 2. Move the item from the "Prompt" view to the "Manifest" view
      setResolvedItem(needsAssignmentItem);
      setNeedsAssignmentItem(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to assign shipment to trip.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkArrived = async () => {
    setLoading(true);
    setError("");

    try {
      await updateTripStatus({
        tripId: tripId,
        status: "ARRIVED",
        notify: false, // Change to true if you want SMS triggered
      });

      // Optimistic update: temporarily mutate the local prop so it bypasses the check next time
      if (trip) trip.status = "ARRIVED";

      // Dismiss the prompt and reveal the scanner!
      setNeedsArrival(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to mark trip as arrived.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!resolvedItem) return;

    // Filter packages that actually have a quantity > 0
    const itemsToProcess = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([pkgId, qty]) => ({ packageId: pkgId, quantity: qty }));

    if (itemsToProcess.length === 0) {
      return setError(
        "Please enter a quantity greater than zero for at least one item.",
      );
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
          {/* <ActionSelector
            action={action}
            onSelect={(a) => {
              resetFlow();
              setAction(a);
            }}
            theme={theme}
          /> */}

          <ActionSelector
            action={action}
            onSelect={(a) => {
              resetFlow();
              const currentTripStatus = trip?.status?.toUpperCase();

              if (a === ACTIONS.UNLOAD) {
                if (currentTripStatus === "IN_TRANSIT") {
                  setNeedsArrival(true);
                  setAction(a);
                  return; // Trap them here
                } else if (currentTripStatus !== "ARRIVED") {
                  setError(
                    `Cannot unload. Trip status is currently ${currentTripStatus || "UNKNOWN"}.`,
                  );
                  return; // Block completely
                }
              }
              setAction(a);
            }}
            theme={theme}
          />

          {needsArrival ? (
            <div
              className={`rounded-xl border p-6 text-center space-y-4 ${theme.panelSurface}`}
            >
              <div className="text-blue-500 mb-2">
                <FontAwesomeIcon icon={faTruckRampBox} size="3x" />
              </div>
              <h3 className="font-bold text-lg">Mark Trip as Arrived</h3>
              <p className="text-sm opacity-80">
                This trip is currently <strong>IN_TRANSIT</strong>. You must
                mark it as arrived at the destination before you can unload
                packages.
              </p>

              <button
                onClick={handleMarkArrived}
                disabled={loading}
                className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${
                  loading ? "bg-gray-500" : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {loading ? "Updating..." : "Mark as Arrived"}
              </button>
            </div>
          ) : (
            action &&
            !resolvedItem &&
            !needsAssignmentItem && (
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
            )
          )}

          {needsAssignmentItem ? (
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

              {/* Only show the Confirm Action button if we are past the Assignment phase */}
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

        // Native Phone Barcode API
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
              /* silent frame fail */
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

function ActionSelector({ action, onSelect, theme }) {
  const options = [
    {
      id: ACTIONS.LOAD,
      label: "Load",
      icon: faTruckRampBox,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/50",
    },
    {
      id: ACTIONS.UNLOAD,
      label: "Unload",
      icon: faUndo,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/50",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onSelect(opt.id)}
          className={`rounded-xl border p-4 text-left transition-all ${
            action === opt.id
              ? `${opt.bg} ${opt.color} ${opt.border}`
              : theme.panelSurface
          }`}
        >
          <FontAwesomeIcon icon={opt.icon} className="mb-2" />
          <div className="font-bold">{opt.label}</div>
        </button>
      ))}
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
          className="px-4 bg-blue-600 text-white rounded-lg text-sm font-bold"
        >
          Check
        </button>
      </form>
    </div>
  );
}

function ResolvedItemPanel({ item, action, quantities, setQuantities, theme }) {
  const isShipment = item.scanType === "SHIPMENT";

  // If it's a Shipment, show all packages. If a Package, isolate just that one.
  const displayPackages = isShipment
    ? item.packages || []
    : item.packages?.filter((p) => p.packageId === item.packageId) || [];

  const getAvailableForPkg = (pkg) => {
    if (action === "LOAD") return (pkg.quantity || 0) - (pkg.loadedQty || 0);
    return pkg.loadedQty || 0;
  };

  const handleQtyChange = (pkgId, value, maxAllowed) => {
    let num = parseInt(value, 10);
    if (isNaN(num) || num < 0) num = 0;
    if (num > maxAllowed) num = maxAllowed;
    setQuantities((prev) => ({ ...prev, [pkgId]: num }));
  };

  const handleAddAll = () => {
    const maxedOut = {};
    displayPackages.forEach((pkg) => {
      maxedOut[pkg.packageId] = getAvailableForPkg(pkg);
    });
    setQuantities(maxedOut);
  };

  return (
    <div className="space-y-4">
      {/* Header Panel */}
      <div
        className={`rounded-xl border p-4 flex justify-between items-start gap-2 ${theme.panelSurface}`}
      >
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
        <button
          onClick={handleAddAll}
          className="shrink-0 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
        >
          Add All Available
        </button>
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
            const currentVal = quantities[pkg.packageId] || "";
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

                <div className="w-20 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max={available}
                    disabled={isFullyProcessed}
                    value={currentVal}
                    onChange={(e) =>
                      handleQtyChange(pkg.packageId, e.target.value, available)
                    }
                    placeholder="0"
                    className={`w-full rounded-lg border px-2 py-2 text-center font-bold text-sm transition-colors ${
                      isFullyProcessed
                        ? "opacity-30 bg-gray-500/10"
                        : theme.input
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
