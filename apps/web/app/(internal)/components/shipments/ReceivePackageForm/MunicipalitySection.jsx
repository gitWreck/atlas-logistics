import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons";
import { DELIVERY_MUNICIPALITIES } from "@/app/utility/deliveryMunicipalities";

export default function MunicipalitySection({
  municipality,
  onChange,
  isDark = false,
  required = true,
}) {
  const baseSelect =
    isDark
      ? "w-full bg-slate-900 border rounded-lg pl-8 pr-3 py-2 text-sm text-white outline-none appearance-none cursor-pointer border-slate-700 focus:border-emerald-500"
      : "w-full bg-white border rounded-lg pl-8 pr-3 py-2 text-sm text-slate-900 outline-none appearance-none cursor-pointer border-slate-300 focus:border-emerald-500";

  return (
    <div
      className={`p-4 rounded-xl border ${
        isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"
      }`}
    >
      <h3
        className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${
          isDark ? "text-slate-400" : "text-slate-600"
        }`}
      >
        <FontAwesomeIcon icon={faMapMarkerAlt} />
        Destination Municipality
      </h3>

      <div className="relative">
        <FontAwesomeIcon
          icon={faMapMarkerAlt}
          className={`absolute left-3 top-2.5 text-xs ${
            isDark ? "text-slate-500" : "text-slate-400"
          }`}
        />
        <select
          className={baseSelect}
          value={municipality || ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        >
          <option value="">Select municipality...</option>
          {DELIVERY_MUNICIPALITIES.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </div>

      <p className={`text-[11px] mt-2 ${isDark ? "text-slate-500" : "text-slate-500"}`}>
        Last-mile delivery area. Checkers only see and load shipments for
        municipalities assigned to them.
      </p>
    </div>
  );
}
