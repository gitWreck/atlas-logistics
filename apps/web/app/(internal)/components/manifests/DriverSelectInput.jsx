import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faIdBadge, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";

export default function DriverSelectInput({ value, onChange, onSelectId, isDark = true }) {
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
        <label className={`text-xs font-bold uppercase ${isDark ? "text-slate-400" : "text-slate-600"}`}>
          Driver Name
        </label>
        {verified && (
          <span className={`text-[10px] px-2 rounded-full flex items-center gap-1 ${isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700"}`}>
            <FontAwesomeIcon icon={faIdBadge} /> Database Verified
          </span>
        )}
      </div>

      <input
        required
        className={`w-full border rounded-lg p-2 outline-none transition-colors ${
          isDark
            ? `bg-slate-950 text-white ${verified ? "border-blue-500/50" : "border-slate-700 focus:border-blue-500"}`
            : `bg-white text-slate-900 ${verified ? "border-blue-500/50" : "border-slate-300 focus:border-blue-500"}`
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
        <div className={`absolute top-full left-0 right-0 mt-1 border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto ${
          isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
        }`}>
          {loading ? (
            <div className={`p-3 text-center text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}>
              <FontAwesomeIcon icon={faSpinner} spin />
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((d) => (
              <div
                key={d.id}
                onMouseDown={() => handleSelect(d)}
                className={`p-2 cursor-pointer border-b last:border-0 ${isDark ? "hover:bg-slate-800 border-slate-800/50" : "hover:bg-slate-100 border-slate-200"}`}
              >
                <div className={`text-sm font-bold ${isDark ? "text-slate-200" : "text-slate-900"}`}>{d.name}</div>
                <div className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-600"}`}>{d.email}</div>
              </div>
            ))
          ) : (
            <div className={`p-3 text-center text-xs italic ${isDark ? "text-slate-500" : "text-slate-600"}`}>
              No matches found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
