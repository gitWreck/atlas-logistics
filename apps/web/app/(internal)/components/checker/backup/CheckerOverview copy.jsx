"use client";
import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBarcode,
  faTruck,
  faCheckCircle,
  faTimesCircle,
  faBoxOpen,
} from "@fortawesome/free-solid-svg-icons";
import { httpsCallable } from "firebase/functions";
import { functions, db } from "@/apps/web/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore";

export default function CheckerOverview() {
  // STATE
  const [activeTrips, setActiveTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [scanInput, setScanInput] = useState("");
  const [scanStatus, setScanStatus] = useState("IDLE"); // IDLE, SUCCESS, ERROR
  const [lastMessage, setLastMessage] = useState("");
  const [shipments, setShipments] = useState([]); // The manifest list

  const inputRef = useRef(null);

  // 1. FETCH ACTIVE TRIPS (On Mount)
  useEffect(() => {
    const fetchTrips = async () => {
      const q = query(
        collection(db, "truck_trips"),
        where("active", "==", true),
        where("status", "in", ["CREATED", "ASSIGNED", "LOADING"]), // Only open trips
      );
      const snap = await getDocs(q);
      const trips = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setActiveTrips(trips);
    };
    fetchTrips();
  }, []);

  // 2. LISTEN TO TRIP SHIPMENTS (Real-time Progress)
  useEffect(() => {
    if (!selectedTrip) return;

    // Subscribe to the subcollection of the selected trip
    const q = collection(db, "truck_trips", selectedTrip.id, "trip_shipments");
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setShipments(list);
    });
    return () => unsub();
  }, [selectedTrip]);

  // 3. HANDLE SCAN
  const handleScan = async (e) => {
    e.preventDefault();
    if (!scanInput || !selectedTrip) return;

    const code = scanInput.trim();
    setScanInput(""); // Clear immediately for next scan
    setScanStatus("LOADING");

    // LOCAL CHECK FIRST (Fast Feedback)
    const match = shipments.find(
      (s) => s.id === code || s.trackingNumber === code,
    );

    if (!match) {
      setScanStatus("ERROR");
      setLastMessage("WRONG SHIPMENT: Not assigned to this truck.");
      playAudio("error");
      return;
    }

    if (match.status === "LOADED") {
      setScanStatus("WARNING");
      setLastMessage("ALREADY LOADED.");
      playAudio("warning");
      return;
    }

    // SERVER ACTION
    try {
      const fn = httpsCallable(functions, "markShipmentAsLoaded");
      await fn({
        trackingDocId: match.id, // Ensure we send the Doc ID
        tripDocId: selectedTrip.id,
      });

      setScanStatus("SUCCESS");
      setLastMessage(`${match.trackingNumber} Verified!`);
      playAudio("success");
    } catch (err) {
      setScanStatus("ERROR");
      setLastMessage(err.message);
      playAudio("error");
    } finally {
      // Refocus for rapid scanning
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Helper for Sound Effects (Optional but highly recommended for checkers)
  const playAudio = (type) => {
    // You can add simple beep sounds here
    // const audio = new Audio(`/sounds/${type}.mp3`);
    // audio.play().catch(() => {});
  };

  // --- RENDER: SELECT TRIP SCREEN ---
  if (!selectedTrip) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4">
        <h1 className="text-xl font-bold mb-6 text-slate-400 uppercase tracking-widest">
          Select Trip to Load
        </h1>
        <div className="grid gap-4">
          {activeTrips.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTrip(t)}
              className="bg-slate-800 p-6 rounded-xl border border-slate-700 text-left hover:bg-slate-700 hover:border-blue-500 transition-all"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-2xl font-bold text-blue-400">
                  {t.tripId}
                </span>
                <FontAwesomeIcon icon={faTruck} className="text-slate-600" />
              </div>
              <div className="text-sm text-slate-400">{t.route}</div>
              <div className="text-xs text-slate-500 mt-2">
                Driver: {t.driverName || "Unassigned"}
              </div>
            </button>
          ))}
          {activeTrips.length === 0 && (
            <div className="text-slate-500 text-center mt-10">
              No active trips found.
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- RENDER: SCANNER SCREEN ---
  const total = shipments.length;
  const loaded = shipments.filter((s) => s.status === "LOADED").length;
  const progress = total > 0 ? (loaded / total) * 100 : 0;

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${
        scanStatus === "SUCCESS"
          ? "bg-emerald-900/30"
          : scanStatus === "ERROR"
            ? "bg-red-900/30"
            : "bg-slate-900"
      }`}
    >
      {/* HEADER */}
      <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
        <div>
          <div className="text-[10px] text-slate-500 uppercase font-bold">
            Loading Trip
          </div>
          <div className="font-mono font-bold text-white text-lg">
            {selectedTrip.tripId}
          </div>
        </div>
        <button
          onClick={() => setSelectedTrip(null)}
          className="text-xs text-slate-400 border border-slate-700 px-3 py-1 rounded"
        >
          Exit
        </button>
      </div>

      {/* PROGRESS BAR */}
      <div className="bg-slate-900 p-4 pb-6">
        <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
          <span>Progress</span>
          <span>
            {loaded} / {total} Items
          </span>
        </div>
        <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* SCANNER INPUT (The main interaction) */}
      <div className="p-4">
        <form onSubmit={handleScan} className="relative">
          <input
            ref={inputRef}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            autoFocus
            placeholder="Scan Barcode Here..."
            className="w-full bg-slate-950 border-2 border-blue-500/50 rounded-xl p-4 text-center text-white text-xl font-mono shadow-lg shadow-blue-900/20 focus:border-blue-400 outline-none"
          />
          <div className="absolute right-4 top-4 text-slate-500">
            <FontAwesomeIcon icon={faBarcode} size="lg" />
          </div>
        </form>

        {/* FEEDBACK MESSAGE */}
        <div
          className={`mt-4 p-4 rounded-xl text-center font-bold border ${
            scanStatus === "SUCCESS"
              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
              : scanStatus === "ERROR"
                ? "bg-red-500/20 border-red-500/50 text-red-400"
                : scanStatus === "WARNING"
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                  : "bg-slate-800 border-slate-700 text-slate-500"
          }`}
        >
          {scanStatus === "SUCCESS" && (
            <FontAwesomeIcon icon={faCheckCircle} className="mr-2" />
          )}
          {scanStatus === "ERROR" && (
            <FontAwesomeIcon icon={faTimesCircle} className="mr-2" />
          )}
          {lastMessage || "Ready to Scan"}
        </div>
      </div>

      {/* LIST (Remaining Items) */}
      <div className="flex-1 overflow-y-auto bg-slate-950 p-4 rounded-t-2xl border-t border-slate-800">
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">
          Pending Items
        </h3>
        <div className="space-y-2">
          {shipments
            .sort((a, b) => (a.status === "LOADED" ? 1 : -1)) // Move loaded to bottom
            .map((s) => {
              const isLoaded = s.status === "LOADED";
              return (
                <div
                  key={s.id}
                  className={`p-3 rounded-lg border flex justify-between items-center ${
                    isLoaded
                      ? "bg-slate-900 border-slate-800 opacity-50"
                      : "bg-slate-800 border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center ${
                        isLoaded
                          ? "bg-emerald-500/20 text-emerald-500"
                          : "bg-slate-700 text-slate-500"
                      }`}
                    >
                      <FontAwesomeIcon
                        icon={isLoaded ? faCheckCircle : faBoxOpen}
                      />
                    </div>
                    <div>
                      <div className="font-mono text-sm font-bold text-white">
                        {s.trackingNumber}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {s.route || "No Route"}
                      </div>
                    </div>
                  </div>
                  {isLoaded && (
                    <span className="text-[10px] font-bold text-emerald-500 uppercase">
                      Loaded
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
