import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faIdBadge, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";

export default function DriverSelectInput({ value, onChange, onSelectId }) {
  const [drivers, setDrivers] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  // Load Drivers once on mount
  useEffect(() => {
    const loadDrivers = async () => {
      setLoading(true);
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch("/api/drivers/active", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.drivers) setDrivers(data.drivers);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadDrivers();
  }, []);

  // Filter Logic
  const handleType = (text) => {
    onChange(text); // Update parent text
    setVerified(false);
    onSelectId(null); // Clear ID in parent because user is typing new text

    const matches = drivers.filter((d) =>
      d.name.toLowerCase().includes(text.toLowerCase()),
    );
    setSuggestions(matches);
    setShowSuggestions(true);
  };

  const handleSelect = (driver) => {
    onChange(driver.name);
    onSelectId(driver.id);
    setVerified(true);
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-1 relative">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-slate-400 uppercase">
          Driver Name
        </label>
        {verified && (
          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 rounded-full flex items-center gap-1">
            <FontAwesomeIcon icon={faIdBadge} /> Database Verified
          </span>
        )}
      </div>

      <input
        required
        className={`w-full bg-slate-950 border rounded-lg p-2 text-white outline-none transition-colors ${
          verified
            ? "border-blue-500/50"
            : "border-slate-700 focus:border-blue-500"
        }`}
        placeholder="Type to search..."
        value={value}
        onChange={(e) => handleType(e.target.value)}
        onFocus={() => {
          if (drivers.length > 0) {
            setSuggestions(
              value
                ? drivers.filter((d) =>
                    d.name.toLowerCase().includes(value.toLowerCase()),
                  )
                : drivers,
            );
            setShowSuggestions(true);
          }
        }}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        autoComplete="off"
      />

      {/* DROPDOWN */}
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-center text-slate-500 text-xs">
              <FontAwesomeIcon icon={faSpinner} spin />
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((d) => (
              <div
                key={d.id}
                onMouseDown={() => handleSelect(d)}
                className="p-2 hover:bg-slate-800 cursor-pointer border-b border-slate-800/50 last:border-0"
              >
                <div className="text-sm font-bold text-slate-200">{d.name}</div>
                <div className="text-[10px] text-slate-500">{d.email}</div>
              </div>
            ))
          ) : (
            <div className="p-3 text-center text-slate-500 text-xs italic">
              No matches found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
