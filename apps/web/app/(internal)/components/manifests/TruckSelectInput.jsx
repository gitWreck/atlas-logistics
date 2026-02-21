"use client";
import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruck,
  faSpinner,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";

export default function TruckSelectInput({ value, onChange, onSelectId, isDark = true }) {
  const [trucks, setTrucks] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  // Load ONLY Idle Trucks (Available for assignment)
  useEffect(() => {
    const loadTrucks = async () => {
      setLoading(true);
      try {
        const token = await auth.currentUser?.getIdToken();
        // Point this to your new /api/trucks endpoint
        const res = await fetch("/api/trucks?status=IDLE", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.trucks) setTrucks(data.trucks);
      } catch (err) {
        console.error("Error loading trucks:", err);
      } finally {
        setLoading(false);
      }
    };
    loadTrucks();
  }, []);

  const handleType = (text) => {
    onChange(text); // Update parent (Plate Number text)
    setVerified(false);
    onSelectId(null); // Clear ID in parent

    const matches = trucks.filter(
      (t) =>
        t.plateNumber.toLowerCase().includes(text.toLowerCase()) ||
        t.model.toLowerCase().includes(text.toLowerCase()),
    );
    setSuggestions(matches);
    setShowSuggestions(true);
  };

  const handleSelect = (truck) => {
    onChange(truck.plateNumber); // Parent stores the Plate
    onSelectId(truck.id); // Parent stores the Doc ID
    setVerified(true);
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-1 relative">
      <div className="flex justify-between items-center">
        <label className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-600"}`}>
          Truck Plate #
        </label>
        {verified && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
            isDark ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/10" : "bg-emerald-100 text-emerald-700 border border-emerald-200"
          }`}>
            <FontAwesomeIcon icon={faCheckCircle} /> Ready for Trip
          </span>
        )}
      </div>

      <input
        required
        autoComplete="off"
        className={`w-full border rounded-lg p-2 outline-none transition-colors ${
          isDark
            ? `bg-slate-950 text-white ${verified ? "border-emerald-500/50 ring-1 ring-emerald-500/10" : "border-slate-700 focus:border-blue-500"}`
            : `bg-white text-slate-900 ${verified ? "border-emerald-500/50 ring-1 ring-emerald-500/10" : "border-slate-300 focus:border-blue-500"}`
        }`}
        placeholder="Search plate or model..."
        value={value}
        onChange={(e) => handleType(e.target.value)}
        onFocus={() => {
          if (trucks.length > 0) {
            setSuggestions(
              value
                ? trucks.filter((t) =>
                    t.plateNumber.toLowerCase().includes(value.toLowerCase()),
                  )
                : trucks,
            );
            setShowSuggestions(true);
          }
        }}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
      />

      {/* DROPDOWN */}
      {showSuggestions && (
        <div className={`absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-2xl z-[60] max-h-48 overflow-y-auto custom-scrollbar ${
          isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
        }`}>
          {loading ? (
            <div className={`p-4 text-center text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}>
              <FontAwesomeIcon icon={faSpinner} spin />
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((t) => (
              <div
                key={t.id}
                onMouseDown={() => handleSelect(t)}
                className={`p-3 cursor-pointer border-b last:border-0 flex items-center justify-between group ${
                  isDark ? "hover:bg-slate-800 border-slate-800/50" : "hover:bg-slate-100 border-slate-200"
                }`}
              >
                <div>
                  <div className={`text-sm font-mono font-bold uppercase group-hover:text-blue-500 ${
                    isDark ? "text-slate-200" : "text-slate-900"
                  }`}>
                    {t.plateNumber}
                  </div>
                  <div className={`text-[10px] font-medium ${isDark ? "text-slate-500" : "text-slate-600"}`}>
                    {t.model} • {t.type}
                  </div>
                </div>
                <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  isDark ? "bg-slate-950 text-slate-600 border border-slate-800" : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}>
                  {t.payloadCapacity || t.payload} KG
                </div>
              </div>
            ))
          ) : (
            <div className={`p-4 text-center text-xs italic ${isDark ? "text-slate-500" : "text-slate-600"}`}>
              No available trucks found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
