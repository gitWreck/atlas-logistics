"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faCircleNotch,
  faCheckCircle,
  faExclamationTriangle,
  faShip,
  faCloudShowersHeavy,
  faBoxOpen,
  faMapMarkerAlt,
  faClock,
  faTruck,
} from "@fortawesome/free-solid-svg-icons";

import StatusBadge from "../components/ui/StatusBadge";

const STATUS_STEPS = [
  "Received",
  "In Transit",
  "Out for Delivery",
  "Delivered",
];

export default function TrackingPage() {
  const params = useParams();
  const router = useRouter();

  // State
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // Auto-track on mount if ID is present
  useEffect(() => {
    if (params.id && params.id !== "search") {
      // executeTrack(decodeURIComponent(params.id));
    }
  }, [params.id]);

  // --- ACTIONS ---

  const handleSearch = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    // Update URL to match search (good for sharing)
    router.push(`/track/${encodeURIComponent(inputVal.trim())}`);
  };

  const executeTrack = async (trackingId) => {
    setLoading(true);
    setError("");
    setData(null);

    try {
      // Direct Firestore Read (Faster than Cloud Function API)
      const docRef = doc(db, "tracking_public", trackingId);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        setError("Shipment not found. Please check your Tracking ID.");
      } else {
        setData({ id: snap.id, ...snap.data() });
      }
    } catch (err) {
      console.error(err);
      setError("Unable to retrieve details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- HELPERS ---

  const getDelayIcon = (reason) => {
    const r = (reason || "").toUpperCase();
    if (r.includes("WEATHER")) return faCloudShowersHeavy;
    if (r.includes("RORO") || r.includes("VESSEL")) return faShip;
    return faExclamationTriangle;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
        {/* Header / Logo */}
        <div className="p-8 text-center bg-slate-950/50 border-b border-slate-800">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3">
            {/* <FontAwesomeIcon icon={faTruck} className="text-white text-2xl" /> */}
            <img
              src="/atlas-logo1.png"
              alt="Atlas Logo"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide uppercase">
            Atlas Tracking
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Fast & Easy Shipping Verification
          </p>
        </div>

        {/* Search Input */}
        <div className="p-6">
          <form onSubmit={handleSearch} className="relative group">
            <input
              type="text"
              placeholder="Enter Tracking Number"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 pl-4 pr-12 text-center font-mono text-lg text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600 uppercase"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-2 bottom-2 aspect-square bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {loading ? (
                <FontAwesomeIcon icon={faCircleNotch} spin />
              ) : (
                <FontAwesomeIcon icon={faSearch} />
              )}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              {error}
            </div>
          )}
        </div>

        {/* --- RESULT AREA --- */}
        {data && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Status Banner */}
            <div className="bg-slate-800/50 px-6 py-4 border-y border-slate-800 flex justify-between items-center">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  Current Status
                </div>
                <div className="text-lg font-bold text-white">
                  <StatusBadge status={data.status} />
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  Last Update
                </div>
                <div className="text-xs text-slate-300">
                  {data.updatedAt
                    ? new Date(data.updatedAt.seconds * 1000).toLocaleString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }
                      )
                    : "Just now"}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="p-8">
              <Timeline
                status={data.status}
                delayReason={data.delayReason}
                delayCleared={data.delayCleared}
              />

              {/* Back on Track Badge */}
              {data.delayCleared && (
                <div className="mt-6 flex justify-center">
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 animate-pulse">
                    <FontAwesomeIcon icon={faCheckCircle} /> Back on Track
                  </span>
                </div>
              )}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 border-t border-slate-800 divide-x divide-slate-800">
              <div className="p-4 text-center">
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
                  Origin
                </div>
                <div className="font-bold text-slate-200">
                  {data.origin || "—"}
                </div>
              </div>
              <div className="p-4 text-center">
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
                  Destination
                </div>
                <div className="font-bold text-slate-200">
                  {data.destination || "—"}
                </div>
              </div>
            </div>

            {/* Totals Section */}
            {(data.totals || data.totalItems) && (
              <div className="grid grid-cols-3 bg-slate-950 p-6 text-center border-t border-slate-800">
                <Counter
                  label="Received"
                  value={data.totals?.received || data.totalItems || 0}
                />
                <Counter label="Loaded" value={data.totals?.loaded || 0} />
                <Counter
                  label="Pending"
                  value={
                    (data.totals?.received || 0) - (data.totals?.loaded || 0)
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function Timeline({ status, delayReason, delayCleared }) {
  // Normalize Status
  const currentStatus =
    status === "Received at Warehouse" ? "Received" : status;
  const currentIndex = STATUS_STEPS.indexOf(currentStatus);
  const isDelayed = delayReason && !delayCleared;

  // Progress bar calculation
  const progressPercent = Math.max(
    0,
    (currentIndex / (STATUS_STEPS.length - 1)) * 100
  );

  return (
    <div className="relative">
      {/* Background Line */}
      <div className="absolute top-3 left-0 w-full h-0.5 bg-slate-800 rounded-full"></div>

      {/* Active Line */}
      <div
        className={`absolute top-3 left-0 h-0.5 rounded-full transition-all duration-1000 ease-out ${
          isDelayed ? "bg-amber-500" : "bg-blue-500"
        }`}
        style={{ width: `${progressPercent}%` }}
      ></div>

      {/* Steps */}
      <div className="relative flex justify-between z-10">
        {STATUS_STEPS.map((step, idx) => {
          const isActive = idx === currentIndex;
          const isPast = idx < currentIndex;

          let dotClass = "bg-slate-800 border-slate-700"; // Default inactive
          if (isPast) dotClass = "bg-blue-600 border-blue-600";
          if (isActive)
            dotClass = isDelayed
              ? "bg-amber-500 border-amber-500"
              : "bg-blue-500 border-blue-500";

          return (
            <div key={step} className="flex flex-col items-center group">
              {/* Dot */}
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${dotClass}`}
              >
                {isPast && (
                  <FontAwesomeIcon
                    icon={faCheckCircle}
                    className="text-white text-[10px]"
                  />
                )}
                {isActive && (
                  <div
                    className={`w-2 h-2 rounded-full bg-white ${
                      isDelayed ? "animate-none" : "animate-ping"
                    }`}
                  ></div>
                )}
              </div>

              {/* Label */}
              <span
                className={`mt-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  isActive || isPast ? "text-slate-200" : "text-slate-600"
                }`}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>

      {/* Delay Alert Popup */}
      {isDelayed && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs px-3 py-2 rounded-lg flex items-center gap-2 animate-bounce">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <span>{delayReason}</span>
        </div>
      )}
    </div>
  );
}

function Counter({ label, value }) {
  // Simple count-up effect
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseInt(value, 10) || 0;
    if (start === end) return;

    let timer = setInterval(() => {
      start += Math.ceil(end / 20);
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 40);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
        {label}
      </div>
      <div className="text-2xl font-mono font-bold text-white">{count}</div>
    </div>
  );
}
