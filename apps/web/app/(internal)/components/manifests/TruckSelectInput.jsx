"use client";
import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruck,
  faSpinner,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";

export default function TruckSelectInput({ value, onChange, onSelectId }) {
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
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Truck Plate #
        </label>
        {verified && (
          <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/10">
            <FontAwesomeIcon icon={faCheckCircle} /> Ready for Trip
          </span>
        )}
      </div>

      <input
        required
        autoComplete="off"
        // className={`w-full bg-slate-950 border rounded-lg p-2.5 text-sm text-white outline-none transition-all ${
        className={`w-full bg-slate-950 border rounded-lg p-2 text-white outline-none transition-colors ${
          verified
            ? "border-emerald-500/50 ring-1 ring-emerald-500/10"
            : "border-slate-700 focus:border-blue-500"
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
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-[60] max-h-48 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-4 text-center text-slate-500 text-xs">
              <FontAwesomeIcon icon={faSpinner} spin />
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((t) => (
              <div
                key={t.id}
                onMouseDown={() => handleSelect(t)}
                className="p-3 hover:bg-slate-800 cursor-pointer border-b border-slate-800/50 last:border-0 flex items-center justify-between group"
              >
                <div>
                  <div className="text-sm font-mono font-bold text-slate-200 group-hover:text-blue-400 uppercase">
                    {t.plateNumber}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {t.model} • {t.type}
                  </div>
                </div>
                <div className="text-[9px] font-bold bg-slate-950 px-1.5 py-0.5 rounded text-slate-600 border border-slate-800">
                  {t.payloadCapacity || t.payload} KG
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-slate-500 text-xs italic">
              No available trucks found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
