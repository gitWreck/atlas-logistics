"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBarcode,
  faTruck,
  faCheckCircle,
  faTimesCircle,
  faBoxOpen,
  faPen,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { db } from "@/lib/firebase"; // Ensure client config is imported
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import LoadPackagesModal from "../manifests/modals/LoadPackagesModal";

export default function CheckerBoard() {
  // STATE
  const [activeTrips, setActiveTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Scanner State
  const [scanInput, setScanInput] = useState("");
  const [scanStatus, setScanStatus] = useState("IDLE"); // IDLE, SUCCESS, ERROR, WARNING
  const [lastMessage, setLastMessage] = useState("");

  // Data State
  const [shipments, setShipments] = useState([]);
  const [manualLoadShipment, setManualLoadShipment] = useState(null); // For the Modal

  const inputRef = useRef(null);

  // 1. FETCH ACTIVE TRIPS (API)
  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const res = await fetch("/api/checker/trips");
        const json = await res.json();
        if (json.success) setActiveTrips(json.data);
      } catch (err) {
        console.error("API Error:", err);
      }
    };
    fetchTrips();
  }, []);

  // 2. FETCH MANIFEST (API) - Replaces onSnapshot
  // We wrap this in useCallback so we can call it manually after a scan
  const fetchManifest = useCallback(async () => {
    if (!selectedTrip) return;

    try {
      const res = await fetch(
        `/api/checker/manifest?tripId=${selectedTrip.id}`,
      );
      const json = await res.json();
      if (json.success) setShipments(json.data);
    } catch (err) {
      console.error("Manifest API Error:", err);
    }
  }, [selectedTrip]);

  // Trigger fetch when trip is selected
  useEffect(() => {
    fetchManifest();
  }, [fetchManifest]);

  // 3. HANDLE SCAN
  const handleScan = async (e) => {
    e.preventDefault();
    if (!scanInput || !selectedTrip) return;

    const code = scanInput.trim();
    setScanInput("");
    setScanStatus("LOADING");

    // A. LOCAL PRE-CHECK (We still do this for speed!)
    // We use the 'shipments' state we fetched from API
    const match = shipments.find(
      (s) => s.packageBarcodes?.includes(code) || s.trackingNumber === code,
    );

    if (!match) {
      setScanStatus("ERROR");
      setLastMessage("UNKNOWN: Not in this manifest.");
      return;
    }

    // B. CALL SCAN API
    try {
      const res = await fetch("/api/checker/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: code,
          truckTripId: selectedTrip.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 400) {
          setScanStatus("WARNING");
          setLastMessage(data.message);
        } else {
          throw new Error(data.message);
        }
      } else {
        setScanStatus("SUCCESS");
        setLastMessage(`${code} Verified!`);

        // C. REFRESH DATA
        // Since we aren't using onSnapshot, we must re-fetch to update the progress bar
        fetchManifest();
      }
    } catch (err) {
      setScanStatus("ERROR");
      setLastMessage(err.message);
    } finally {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // --- RENDER: SELECT TRIP SCREEN ---
  if (!selectedTrip) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-start">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="inline-block p-3 rounded-full bg-blue-600/10 text-blue-400 mb-4">
              <FontAwesomeIcon icon={faTruck} size="2x" />
            </div>
            <h1 className="text-2xl font-bold text-white uppercase tracking-widest">
              Select Trip
            </h1>
            <p className="text-slate-500 text-sm">
              Tap a truck to begin loading
            </p>
          </div>

          <div className="grid gap-3">
            {activeTrips.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTrip(t)}
                className="group bg-slate-900 p-5 rounded-xl border border-slate-800 text-left hover:border-blue-500 hover:bg-slate-800 transition-all shadow-lg"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                    {t.tripId}
                  </span>
                  <div className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-500 uppercase font-bold">
                    {t.status}
                  </div>
                </div>
                <div className="text-sm text-slate-400 mb-1">
                  {t.route || "No Route"}
                </div>
                <div className="text-xs text-slate-600">
                  Driver:{" "}
                  <span className="text-slate-500">
                    {t.driverName || "Unassigned"}
                  </span>
                </div>
              </button>
            ))}
            {activeTrips.length === 0 && (
              <div className="text-slate-600 text-center py-10 border border-dashed border-slate-800 rounded-xl">
                No active trips found.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- CALCULATE TOTALS ---
  // Sum up all packages across all shipments
  const totalPackages = shipments.reduce(
    (sum, s) => sum + (s.totals?.totalItems || s.packages?.length || 0),
    0,
  );
  const loadedPackages = shipments.reduce(
    (sum, s) => sum + (s.loadedCount || 0),
    0,
  );
  const progressPercent =
    totalPackages > 0 ? (loadedPackages / totalPackages) * 100 : 0;

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-500 ${
        scanStatus === "SUCCESS"
          ? "bg-emerald-950"
          : scanStatus === "ERROR"
            ? "bg-red-950"
            : "bg-slate-950"
      }`}
    >
      {/* 1. HEADER */}
      <div className="bg-slate-900/50 backdrop-blur-md p-4 border-b border-slate-800 flex justify-between items-center sticky top-0 z-10">
        <div>
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
            Loading Trip
          </div>
          <div className="font-mono font-bold text-white text-lg leading-tight">
            {selectedTrip.tripId}
          </div>
        </div>
        <button
          onClick={() => setSelectedTrip(null)}
          className="text-xs font-bold text-slate-400 hover:text-white border border-slate-700 hover:bg-slate-800 px-4 py-2 rounded-lg transition-all"
        >
          Exit
        </button>
      </div>

      {/* 2. PROGRESS BAR */}
      <div className="bg-slate-900/50 p-6 pb-8">
        <div className="flex justify-between text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">
          <span>Total Load Progress</span>
          <span
            className={
              loadedPackages === totalPackages
                ? "text-emerald-400"
                : "text-blue-400"
            }
          >
            {loadedPackages} / {totalPackages} Pkgs
          </span>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden shadow-inner">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              loadedPackages === totalPackages
                ? "bg-emerald-500"
                : "bg-blue-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* 3. SCANNER INPUT */}
      <div className="px-6 -mt-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl">
          <form onSubmit={handleScan} className="relative mb-4">
            <input
              ref={inputRef}
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              autoFocus
              placeholder="Scan Barcode..."
              className="w-full bg-slate-950 border-2 border-slate-800 focus:border-blue-500 rounded-xl py-4 pl-4 pr-12 text-center text-white text-xl font-mono shadow-inner outline-none transition-colors placeholder:text-slate-700"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600">
              <FontAwesomeIcon icon={faBarcode} size="lg" />
            </div>
          </form>

          {/* STATUS MESSAGE CARD */}
          <div
            className={`p-3 rounded-lg text-center font-bold text-sm border flex items-center justify-center gap-2 transition-all duration-300 ${
              scanStatus === "SUCCESS"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : scanStatus === "ERROR"
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : scanStatus === "WARNING"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-slate-800 border-slate-700 text-slate-500"
            }`}
          >
            {scanStatus === "SUCCESS" && (
              <FontAwesomeIcon icon={faCheckCircle} />
            )}
            {scanStatus === "ERROR" && <FontAwesomeIcon icon={faTimesCircle} />}
            {scanStatus === "WARNING" && (
              <FontAwesomeIcon icon={faExclamationTriangle} />
            )}

            <span>{lastMessage || "Ready to Scan"}</span>
          </div>
        </div>
      </div>

      {/* 4. SHIPMENT LIST */}
      <div className="flex-1 bg-slate-900 border-t border-slate-800 rounded-t-3xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-800 bg-slate-900 sticky top-0">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
            Tap Item for Manual Checklist
          </h3>
        </div>

        <div className="overflow-y-auto p-4 space-y-2 pb-20">
          {shipments
            .sort((a, b) => {
              // Sort: Incomplete on top, Loaded on bottom
              const aComplete = a.loadedCount >= (a.totals?.totalItems || 1);
              const bComplete = b.loadedCount >= (b.totals?.totalItems || 1);
              return aComplete === bComplete ? 0 : aComplete ? 1 : -1;
            })
            .map((s) => {
              const totalItems =
                s.totals?.totalItems || s.packages?.length || 1;
              const loadedCount = s.loadedCount || 0;
              const isFullyLoaded = loadedCount >= totalItems;

              return (
                <button
                  key={s.id}
                  // Open Modal on click
                  onClick={() => setManualLoadShipment(s)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex justify-between items-center group ${
                    isFullyLoaded
                      ? "bg-slate-900/50 border-slate-800 opacity-60"
                      : "bg-slate-800 border-slate-700 hover:border-blue-500 hover:bg-slate-700 active:scale-[0.98] shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Icon Box */}
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                        isFullyLoaded
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                          : "bg-slate-900 border-slate-600 text-slate-500 group-hover:text-blue-400"
                      }`}
                    >
                      <FontAwesomeIcon
                        icon={isFullyLoaded ? faCheckCircle : faBoxOpen}
                      />
                    </div>

                    {/* Text Details */}
                    <div>
                      <div className="font-mono text-sm font-bold text-white">
                        {s.trackingNumber}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {s.route || "No Route"}
                      </div>
                    </div>
                  </div>

                  {/* Right Side Status */}
                  <div className="text-right">
                    <div
                      className={`text-xs font-bold font-mono ${
                        loadedCount > 0 && !isFullyLoaded
                          ? "text-blue-400"
                          : "text-slate-500"
                      }`}
                    >
                      {loadedCount}/{totalItems}
                    </div>
                    {isFullyLoaded ? (
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">
                        Done
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-600 flex items-center justify-end gap-1 group-hover:text-blue-400">
                        Manual <FontAwesomeIcon icon={faPen} size="xs" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

          {shipments.length === 0 && (
            <div className="text-center text-slate-600 text-sm mt-10">
              No shipments assigned to this trip yet.
            </div>
          )}
        </div>
      </div>

      {/* 5. MANUAL LOAD MODAL */}
      {manualLoadShipment && (
        <LoadPackagesModal
          isOpen={!!manualLoadShipment}
          shipment={manualLoadShipment}
          tripId={selectedTrip.id}
          onClose={() => setManualLoadShipment(null)}
          onSuccess={() => {
            // Snapshot will auto-update data
            setManualLoadShipment(null);
            // setScanStatus("SUCCESS"); // Optional visual feedback
            // setLastMessage("Manual Update Saved");
          }}
        />
      )}
    </div>
  );
}
