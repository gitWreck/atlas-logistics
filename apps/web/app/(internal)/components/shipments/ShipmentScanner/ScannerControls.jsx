"use client";

import React, { useId, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faCheckCircle,
  faExclamationTriangle,
  faTools,
  faTruckRampBox,
  faUndo,
  faWarehouse,
  faCircleNotch,
} from "@fortawesome/free-solid-svg-icons";

export function ActionSelector({ action, trip, theme, actions }) {
  const currentTripStatus = trip?.status?.toUpperCase();
  const isManifestLocked = !!trip?.manifestLocked;
  const isLoadDisabled = currentTripStatus === "IN_TRANSIT" || isManifestLocked;

  const options = [
    {
      id: "LOAD",
      label: "Load",
      icon: faTruckRampBox,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/50",
      disabled: isLoadDisabled,
    },
    {
      id: "UNLOAD",
      label: "Unload",
      icon: faUndo,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/50",
      disabled: false,
    },
  ];

  const handleSelect = (id) => {
    actions.resetFlow();
    if (id === "UNLOAD") {
      if (currentTripStatus === "IN_TRANSIT")
        return actions.setNeedsArrival(true) || actions.setAction(id);
      if (currentTripStatus === "ARRIVED" && isManifestLocked)
        return actions.setNeedsUnlock(true) || actions.setAction(id);
      if (currentTripStatus !== "ARRIVED" && currentTripStatus !== "COMPLETED")
        return actions.setError(
          `Cannot unload. Trip status is currently ${currentTripStatus || "UNKNOWN"}.`,
        );
    }
    if (id === "LOAD") {
      const isFull = trip?.itemPending === 0 && trip?.totalItems > 0;
      if (currentTripStatus === "LOADED" && !isManifestLocked)
        return actions.setNeedsLock(true) || actions.setAction(id);
      if (
        isFull &&
        currentTripStatus !== "LOADED" &&
        currentTripStatus !== "ARRIVED"
      )
        return actions.setNeedsLoadedStatus(true) || actions.setAction(id);
    }
    actions.setAction(id);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={opt.disabled}
          onClick={() => handleSelect(opt.id)}
          className={`rounded-xl border p-4 text-left transition-all relative overflow-hidden ${
            opt.disabled
              ? "opacity-50 cursor-not-allowed bg-gray-500/5 border-gray-500/20 grayscale"
              : action === opt.id
                ? `${opt.bg} ${opt.color} ${opt.border}`
                : theme.panelSurface
          }`}
        >
          <FontAwesomeIcon icon={opt.icon} className="mb-2" />
          <div className="font-bold">{opt.label}</div>
          {opt.disabled && opt.id === "LOAD" && (
            <div className="text-[9px] mt-1 text-red-500 font-bold uppercase">
              {isManifestLocked ? "Manifest Locked" : "In Transit"}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

export function ScanStatusSelector({
  action,
  value,
  options = [],
  onChange,
  theme,
}) {
  if (!action || !options.length) return null;

  const iconByStatus = {
    LOADED: faTruckRampBox,
    RECEIVED: faWarehouse,
    MISSING: faExclamationTriangle,
    DAMAGED: faTools,
    DELIVERED: faCheckCircle,
  };

  const toneClasses = {
    blue: "border-blue-500/60 bg-blue-500/10 text-blue-500",
    emerald: "border-emerald-500/60 bg-emerald-500/10 text-emerald-500",
    red: "border-red-500/60 bg-red-500/10 text-red-500",
    amber: "border-amber-500/60 bg-amber-500/10 text-amber-500",
  };

  return (
    <div className={`rounded-xl border p-4 ${theme.panelSurface}`}>
      <div className="text-[10px] font-bold uppercase opacity-60">
        Scan will mark as
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {options.map((option) => {
          const active = value === option.value;
          const activeClass = toneClasses[option.tone] || toneClasses.blue;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                active ? activeClass : theme.panelSurface
              }`}
            >
              <FontAwesomeIcon
                icon={iconByStatus[option.value] || faCheckCircle}
                className="mr-2"
              />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ScannerEngineSelect({ value, onChange, theme }) {
  return (
    <div className={`rounded-xl border p-4 ${theme.panelSurface}`}>
      <label
        htmlFor="shipment-scanner-engine"
        className="text-[10px] font-bold uppercase opacity-60"
      >
        Scanner
      </label>
      <div className="relative mt-2">
        <select
          id="shipment-scanner-engine"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border px-3 py-2 pr-9 text-sm font-bold outline-none focus:border-blue-500 appearance-none cursor-pointer ${theme.input}`}
        >
          <option value="barcode-detector">BarcodeDetector</option>
          <option value="html5-qrcode">HTML5 QR Code</option>
        </select>
        <FontAwesomeIcon
          icon={faChevronDown}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-50"
        />
      </div>
    </div>
  );
}

export function CameraScanner({
  scannerEngine = "barcode-detector",
  onDetected,
  onClose,
  setError,
}) {
  const [isResolvingScan, setIsResolvingScan] = React.useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  const setErrorRef = useRef(setError);
  const scannerId = `shipment-html5-scanner-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    onDetectedRef.current = onDetected;
    onCloseRef.current = onClose;
    setErrorRef.current = setError;
  }, [onDetected, onClose, setError]);

  useEffect(() => {
    let stopScanning = false;
    let animationFrameId = null;
    let html5Scanner = null;

    const handleDetected = async (decodedText) => {
      if (stopScanning) return;
      stopScanning = true;
      setIsResolvingScan(true);

      try {
        await onDetectedRef.current(decodedText);
      } catch {
        setErrorRef.current("Failed to process scanned code.");
      }
    };

    const cleanupNativeScanner = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    const cleanupHtml5Scanner = () => {
      if (!html5Scanner) return;
      const scanner = html5Scanner;
      Promise.resolve()
        .then(() => (scanner.isScanning ? scanner.stop() : null))
        .catch(() => {})
        .finally(() => {
          try {
            scanner.clear();
          } catch {
            /* ignore cleanup failures */
          }
        });
    };

    async function setupHtml5Scanner() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          "html5-qrcode"
        );

        if (stopScanning) return;

        html5Scanner = new Html5Qrcode(scannerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          useBarCodeDetectorIfSupported: false,
          verbose: false,
        });

        await html5Scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.floor(
                Math.min(viewfinderWidth, viewfinderHeight) * 0.7,
              );
              return { width: edge, height: edge };
            },
          },
          (decodedText) => {
            handleDetected(decodedText);
          },
          () => {},
        );
      } catch {
        if (stopScanning) return;
        setErrorRef.current(
          "HTML5 scanner could not start. Try BarcodeDetector or manual input.",
        );
        onCloseRef.current();
      }
    }

    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", focusMode: "continuous" },
        });
        if (stopScanning) return stream.getTracks().forEach((t) => t.stop());

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
                return handleDetected(barcodes[0].rawValue);
              }
            } catch {
              /* ignore */
            }
            animationFrameId = requestAnimationFrame(renderFrame);
          };
          renderFrame();
        } else {
          setErrorRef.current(
            "BarcodeDetector is not supported. Try HTML5 QR Code or manual input.",
          );
          onCloseRef.current();
        }
      } catch {
        setErrorRef.current("Camera access denied.");
        onCloseRef.current();
      }
    }

    if (scannerEngine === "html5-qrcode") {
      setupHtml5Scanner();
    } else {
      setupCamera();
    }

    return () => {
      stopScanning = true;
      cleanupNativeScanner();
      cleanupHtml5Scanner();
    };
  }, [scannerEngine, scannerId]);

  return (
    <div className="rounded-xl overflow-hidden bg-black relative aspect-square">
      {scannerEngine === "html5-qrcode" ? (
        <div
          id={scannerId}
          className="h-full w-full [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"
        />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 border-2 border-blue-500 m-12 rounded-lg opacity-50 shadow-[0_0_0_999px_rgba(0,0,0,0.5)] pointer-events-none" />
      {isResolvingScan && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
          <FontAwesomeIcon icon={faCircleNotch} spin size="2x" />
          <div className="text-sm font-bold">Processing scan...</div>
        </div>
      )}
      <button
        onClick={onClose}
        disabled={isResolvingScan}
        className="absolute bottom-4 right-4 z-20 bg-black/50 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-60"
      >
        Close
      </button>
    </div>
  );
}

export function ManualInput({ value, onChange, onSubmit, loading, theme }) {
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
