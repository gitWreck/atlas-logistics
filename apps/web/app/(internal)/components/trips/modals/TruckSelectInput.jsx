"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruck,
  faSpinner,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";
import { getModalThemeClasses } from "@/app/utility/constant/theme";

export default function TruckSelectInput({
  value,
  onChange,
  onSelectId,
  isDark = true,
}) {
  const modalTheme = getModalThemeClasses(isDark);

  const [trucks, setTrucks] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const loadTrucks = async () => {
      setLoading(true);
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch("/api/trucks?status=IDLE", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (data?.trucks) {
          setTrucks(data.trucks);
        }
      } catch (err) {
        console.error("Failed to load trucks:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTrucks();
  }, []);

  useEffect(() => {
    if (!value) {
      setVerified(false);
      return;
    }

    const exactMatch = trucks.find(
      (truck) =>
        truck.plateNumber?.trim().toLowerCase() === value.trim().toLowerCase(),
    );

    setVerified(Boolean(exactMatch));
  }, [value, trucks]);

  const filteredTrucks = useMemo(() => {
    const keyword = value?.trim().toLowerCase();

    if (!keyword) return trucks;

    return trucks.filter((truck) => {
      const plate = truck.plateNumber?.toLowerCase() || "";
      const model = truck.model?.toLowerCase() || "";
      const type = truck.type?.toLowerCase() || "";

      return (
        plate.includes(keyword) ||
        model.includes(keyword) ||
        type.includes(keyword)
      );
    });
  }, [trucks, value]);

  const handleType = (text) => {
    onChange(text);
    onSelectId(null);
    setVerified(false);

    const keyword = text.trim().toLowerCase();

    const matches = trucks.filter((truck) => {
      const plate = truck.plateNumber?.toLowerCase() || "";
      const model = truck.model?.toLowerCase() || "";
      const type = truck.type?.toLowerCase() || "";

      return (
        plate.includes(keyword) ||
        model.includes(keyword) ||
        type.includes(keyword)
      );
    });

    setSuggestions(matches);
    setShowSuggestions(true);
  };

  const handleSelect = (truck) => {
    onChange(truck.plateNumber || "");
    onSelectId(truck.id || null);
    setVerified(true);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleFocus = () => {
    setSuggestions(filteredTrucks);
    setShowSuggestions(true);
  };

  return (
    <div className="space-y-1.5 relative">
      <div className="flex items-center justify-between gap-2">
        <label
          className={`text-xs font-bold uppercase tracking-wide flex items-center gap-2 ${modalTheme.label}`}
        >
          <FontAwesomeIcon icon={faTruck} />
          Truck Plate #
        </label>

        {verified && (
          <span
            className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1 border ${
              isDark
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            <FontAwesomeIcon icon={faCheckCircle} />
            Ready for Trip
          </span>
        )}
      </div>

      <div className="relative">
        <input
          // required
          type="text"
          value={value}
          autoComplete="off"
          placeholder="Search plate, model, or type..."
          onChange={(e) => handleType(e.target.value)}
          onFocus={handleFocus}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className={`w-full rounded-xl border px-3 py-2.5 outline-none transition-colors ${modalTheme.input} ${
            verified
              ? isDark
                ? "border-emerald-500/50 focus:border-emerald-400"
                : "border-emerald-400/60 focus:border-emerald-500"
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
              Loading trucks...
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((truck) => (
              <button
                key={truck.id}
                type="button"
                onMouseDown={() => handleSelect(truck)}
                className={`w-full text-left px-3 py-3 border-b last:border-b-0 transition-colors ${modalTheme.divider} ${
                  isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-semibold uppercase tracking-wide ${modalTheme.title}`}
                    >
                      {truck.plateNumber || "No Plate"}
                    </div>

                    <div
                      className={`text-[11px] mt-0.5 ${modalTheme.helperText}`}
                    >
                      {[truck.model, truck.type].filter(Boolean).join(" • ") ||
                        "No truck details"}
                    </div>
                  </div>

                  <div
                    className={`text-[10px] px-2 py-1 rounded-md border whitespace-nowrap ${
                      isDark
                        ? "bg-slate-950 text-slate-400 border-slate-800"
                        : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}
                  >
                    {truck.payloadCapacity || truck.payload
                      ? `${truck.payloadCapacity || truck.payload} KG`
                      : "No payload"}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div
              className={`p-3 text-center text-xs italic ${modalTheme.helperText}`}
            >
              No available trucks found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
