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
import LoadPackagesModal from "../manifests/modals/LoadPackagesModal";
import { auth } from "@/lib/firebase";

export default function CheckerBoard({ isDark = true }) {
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
      (s) => s.packageBarcodes?.includes(code) || s.shipmentId === code,
    );

    if (!match) {
      setScanStatus("ERROR");
      setLastMessage("UNKNOWN: Not in this manifest.");
      return;
    }

    // B. CALL SCAN API
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("You must be signed in to scan packages.");
      }

      const res = await fetch("/api/checker/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
    const selectTripRoot = isDark
      ? "min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-start"
      : "min-h-screen bg-transparent text-slate-900 p-6 flex flex-col items-center justify-start";
    const selectTripTitle = isDark ? "text-white" : "text-slate-900";
    const selectTripSubtitle = isDark ? "text-slate-500" : "text-slate-600";
    const tripCardClass = isDark
      ? "group bg-slate-900 p-5 rounded-xl border border-slate-800 text-left hover:border-blue-500 hover:bg-slate-800 transition-all shadow-lg"
      : "group bg-white p-5 rounded-xl border border-slate-200 text-left hover:border-blue-500 hover:bg-slate-50 transition-all shadow-md";
    const tripCardTitle = isDark
      ? "font-mono text-xl font-bold text-white group-hover:text-blue-400 transition-colors"
      : "font-mono text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors";
    const tripCardBadge = isDark
      ? "px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-500 uppercase font-bold"
      : "px-2 py-1 rounded bg-slate-100 border border-slate-200 text-[10px] text-slate-600 uppercase font-bold";
    const tripCardRoute = isDark
      ? "text-sm text-slate-400 mb-1"
      : "text-sm text-slate-600 mb-1";
    const tripCardDriver = isDark
      ? "text-xs text-slate-600"
      : "text-xs text-slate-500";
    const emptyTripsClass = isDark
      ? "text-slate-600 text-center py-10 border border-dashed border-slate-800 rounded-xl"
      : "text-slate-500 text-center py-10 border border-dashed border-slate-300 rounded-xl bg-slate-50/50";

    return (
      <div className={selectTripRoot}>
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="inline-block p-3 rounded-full bg-blue-600/10 text-blue-500 mb-4">
              <FontAwesomeIcon icon={faTruck} size="2x" />
            </div>
            <h1
              className={`text-2xl font-bold uppercase tracking-widest ${selectTripTitle}`}
            >
              Select Trip
            </h1>
            <p className={`${selectTripSubtitle} text-sm`}>
              Tap a truck to begin loading
            </p>
          </div>

          <div className="grid gap-3">
            {activeTrips.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTrip(t)}
                className={tripCardClass}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={tripCardTitle}>{t.tripId}</span>
                  <div className={tripCardBadge}>{t.status}</div>
                </div>
                <div className={tripCardRoute}>{t.route || "No Route"}</div>
                <div className={tripCardDriver}>
                  Driver:{" "}
                  <span
                    className={isDark ? "text-slate-500" : "text-slate-600"}
                  >
                    {t.driverName || "Unassigned"}
                  </span>
                </div>
              </button>
            ))}
            {activeTrips.length === 0 && (
              <div className={emptyTripsClass}>No active trips found.</div>
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

  // Theme-aware classes for loading view
  const loadingRootBg = isDark
    ? scanStatus === "SUCCESS"
      ? "bg-emerald-950"
      : scanStatus === "ERROR"
        ? "bg-red-950"
        : "bg-slate-950"
    : scanStatus === "SUCCESS"
      ? "bg-emerald-50"
      : scanStatus === "ERROR"
        ? "bg-red-50"
        : "bg-transparent";
  const loadingHeader = isDark
    ? "bg-slate-900/50 backdrop-blur-md p-4 border-b border-slate-800 flex justify-between items-center sticky top-0 z-10"
    : "bg-white/80 backdrop-blur-md p-4 border-b border-slate-200 flex justify-between items-center sticky top-0 z-10";
  const loadingHeaderLabel = isDark
    ? "text-[10px] text-slate-500 uppercase font-bold tracking-wider"
    : "text-[10px] text-slate-500 uppercase font-bold tracking-wider";
  const loadingHeaderTitle = isDark
    ? "font-mono font-bold text-white text-lg leading-tight"
    : "font-mono font-bold text-slate-900 text-lg leading-tight";
  const exitBtn = isDark
    ? "text-xs font-bold text-slate-400 hover:text-white border border-slate-700 hover:bg-slate-800 px-4 py-2 rounded-lg transition-all"
    : "text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100 px-4 py-2 rounded-lg transition-all";
  const progressSection = isDark
    ? "bg-slate-900/50 p-6 pb-8"
    : "bg-slate-50/80 p-6 pb-8 border-b border-slate-200";
  const progressLabel = isDark
    ? "flex justify-between text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide"
    : "flex justify-between text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide";
  const progressTrack = isDark
    ? "h-3 bg-slate-800 rounded-full overflow-hidden shadow-inner"
    : "h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner";
  const scannerBox = isDark
    ? "bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl"
    : "bg-white border border-slate-200 rounded-2xl p-4 shadow-lg";
  const scannerInput = isDark
    ? "w-full bg-slate-950 border-2 border-slate-800 focus:border-blue-500 rounded-xl py-4 pl-4 pr-12 text-center text-white text-xl font-mono shadow-inner outline-none transition-colors placeholder:text-slate-700"
    : "w-full bg-white border-2 border-slate-200 focus:border-blue-500 rounded-xl py-4 pl-4 pr-12 text-center text-slate-900 text-xl font-mono shadow-inner outline-none transition-colors placeholder:text-slate-400";
  const statusIdleClass = isDark
    ? "bg-slate-800 border-slate-700 text-slate-500"
    : "bg-slate-100 border-slate-200 text-slate-600";
  const listContainer = isDark
    ? "flex-1 bg-slate-900 border-t border-slate-800 rounded-t-3xl overflow-hidden flex flex-col"
    : "flex-1 bg-white border-t border-slate-200 rounded-t-3xl overflow-hidden flex flex-col shadow-sm";
  const listHeader = isDark
    ? "p-4 border-b border-slate-800 bg-slate-900 sticky top-0"
    : "p-4 border-b border-slate-200 bg-slate-50 sticky top-0";
  const listHeaderText = isDark
    ? "text-xs font-bold text-slate-500 uppercase tracking-wider text-center"
    : "text-xs font-bold text-slate-600 uppercase tracking-wider text-center";
  const itemLoadedClass = isDark
    ? "bg-slate-900/50 border-slate-800 opacity-60"
    : "bg-slate-50 border-slate-200 opacity-70";
  const itemActiveClass = isDark
    ? "bg-slate-800 border-slate-700 hover:border-blue-500 hover:bg-slate-700 active:scale-[0.98] shadow-md"
    : "bg-white border-slate-200 hover:border-blue-400 hover:bg-slate-50 active:scale-[0.98] shadow-sm";
  const itemIconLoaded = isDark
    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600";
  const itemIconActive = isDark
    ? "bg-slate-900 border-slate-600 text-slate-500 group-hover:text-blue-400"
    : "bg-slate-100 border-slate-300 text-slate-600 group-hover:text-blue-600";
  const itemTitle = isDark
    ? "font-mono text-sm font-bold text-white"
    : "font-mono text-sm font-bold text-slate-900";
  const emptyListClass = isDark
    ? "text-center text-slate-600 text-sm mt-10"
    : "text-center text-slate-500 text-sm mt-10";

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-500 ${loadingRootBg}`}
    >
      {/* 1. HEADER */}
      <div className={loadingHeader}>
        <div>
          <div className={loadingHeaderLabel}>Loading Trip</div>
          <div className={loadingHeaderTitle}>{selectedTrip.tripId}</div>
        </div>
        <button onClick={() => setSelectedTrip(null)} className={exitBtn}>
          Exit
        </button>
      </div>

      {/* 2. PROGRESS BAR */}
      <div className={progressSection}>
        <div className={progressLabel}>
          <span>Total Load Progress</span>
          <span
            className={
              loadedPackages === totalPackages
                ? "text-emerald-600"
                : "text-blue-600"
            }
          >
            {loadedPackages} / {totalPackages} Pkgs
          </span>
        </div>
        <div className={progressTrack}>
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
        <div className={scannerBox}>
          <form onSubmit={handleScan} className="relative mb-4">
            <input
              ref={inputRef}
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              autoFocus
              placeholder="Scan Barcode..."
              className={scannerInput}
            />
            <div
              className={`absolute right-4 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-600" : "text-slate-400"}`}
            >
              <FontAwesomeIcon icon={faBarcode} size="lg" />
            </div>
          </form>

          {/* STATUS MESSAGE CARD */}
          <div
            className={`p-3 rounded-lg text-center font-bold text-sm border flex items-center justify-center gap-2 transition-all duration-300 ${
              scanStatus === "SUCCESS"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                : scanStatus === "ERROR"
                  ? "bg-red-500/10 border-red-500/30 text-red-600"
                  : scanStatus === "WARNING"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                    : statusIdleClass
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
      <div className={listContainer}>
        <div className={listHeader}>
          <h3 className={listHeaderText}>Tap Item for Manual Checklist</h3>
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
                  onClick={() => setManualLoadShipment(s)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex justify-between items-center group ${
                    isFullyLoaded ? itemLoadedClass : itemActiveClass
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                        isFullyLoaded ? itemIconLoaded : itemIconActive
                      }`}
                    >
                      <FontAwesomeIcon
                        icon={isFullyLoaded ? faCheckCircle : faBoxOpen}
                      />
                    </div>

                    <div>
                      <div className={itemTitle}>{s.shipmentId}</div>
                      <div
                        className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-600"} mt-0.5`}
                      >
                        {s.route || "No Route"}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-xs font-bold font-mono ${
                        loadedCount > 0 && !isFullyLoaded
                          ? "text-blue-600"
                          : isDark
                            ? "text-slate-500"
                            : "text-slate-600"
                      }`}
                    >
                      {loadedCount}/{totalItems}
                    </div>
                    {isFullyLoaded ? (
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">
                        Done
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] flex items-center justify-end gap-1 group-hover:text-blue-600 ${isDark ? "text-slate-600" : "text-slate-500"}`}
                      >
                        Manual <FontAwesomeIcon icon={faPen} size="xs" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

          {shipments.length === 0 && (
            <div className={emptyListClass}>
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
          isDark={isDark}
          onSuccess={() => {
            setManualLoadShipment(null);
            fetchManifest();
          }}
        />
      )}
    </div>
  );
}
