import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faIdBadge,
  faSpinner,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";
import { getModalThemeClasses } from "@/app/utility/constant/theme";

export default function DriverSelectInput({
  value,
  onChange,
  onSelectId,
  isDark = true,
}) {
  const modalTheme = getModalThemeClasses(isDark);

  const [drivers, setDrivers] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const loadDrivers = async () => {
      setLoading(true);
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch("/api/drivers/active", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (data?.drivers) {
          setDrivers(data.drivers);
        }
      } catch (err) {
        console.error("Failed to load drivers:", err);
      } finally {
        setLoading(false);
      }
    };

    loadDrivers();
  }, []);

  useEffect(() => {
    if (!value) {
      setVerified(false);
      return;
    }

    const exactMatch = drivers.find(
      (d) => d.name?.trim().toLowerCase() === value.trim().toLowerCase(),
    );

    setVerified(Boolean(exactMatch));
  }, [value, drivers]);

  const filteredDrivers = useMemo(() => {
    if (!value?.trim()) return drivers;

    return drivers.filter((driver) =>
      driver.name?.toLowerCase().includes(value.toLowerCase()),
    );
  }, [drivers, value]);

  const handleType = (text) => {
    onChange(text);
    onSelectId(null);
    setVerified(false);

    const matches = drivers.filter((driver) =>
      driver.name?.toLowerCase().includes(text.toLowerCase()),
    );

    setSuggestions(matches);
    setShowSuggestions(true);
  };

  const handleSelect = (driver) => {
    onChange(driver.name || "");
    onSelectId(driver.id || null);
    setVerified(true);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleFocus = () => {
    setSuggestions(filteredDrivers);
    setShowSuggestions(true);
  };

  return (
    <div className="space-y-1.5 relative">
      <div className="flex items-center justify-between gap-2">
        <label
          className={`text-xs font-bold uppercase tracking-wide flex items-center gap-2 ${modalTheme.label}`}
        >
          <FontAwesomeIcon icon={faUser} />
          Driver Name
        </label>

        {verified && (
          <span
            className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1 border ${
              isDark
                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}
          >
            <FontAwesomeIcon icon={faIdBadge} />
            Verified
          </span>
        )}
      </div>

      <div className="relative">
        <input
          // required
          type="text"
          value={value}
          autoComplete="off"
          placeholder="Type to search driver..."
          onChange={(e) => handleType(e.target.value)}
          onFocus={handleFocus}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className={`w-full rounded-xl border px-3 py-2.5 outline-none transition-colors ${modalTheme.input} ${
            verified
              ? isDark
                ? "border-blue-500/50 focus:border-blue-400"
                : "border-blue-400/60 focus:border-blue-500"
              : "focus:border-blue-500"
          }`}
        />

        {loading && (
          <div
            className={`absolute right-3 top-1/2 -translate-y-1/2 ${modalTheme.helperText}`}
          >
            <FontAwesomeIcon icon={faSpinner} spin />
          </div>
        )}
      </div>

      {showSuggestions && (
        <div
          className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 max-h-56 overflow-y-auto ${modalTheme.modal}`}
        >
          {loading ? (
            <div className={`p-3 text-center text-xs ${modalTheme.helperText}`}>
              <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
              Loading drivers...
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((driver) => (
              <button
                key={driver.id}
                type="button"
                onMouseDown={() => handleSelect(driver)}
                className={`w-full text-left px-3 py-2 border-b last:border-b-0 transition-colors ${modalTheme.divider} ${
                  isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
                }`}
              >
                <div className={`text-sm font-semibold ${modalTheme.title}`}>
                  {driver.name}
                </div>
                <div className={`text-[11px] ${modalTheme.helperText}`}>
                  {driver.email || "No email"}
                </div>
              </button>
            ))
          ) : (
            <div
              className={`p-3 text-center text-xs italic ${modalTheme.helperText}`}
            >
              No matching drivers found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
