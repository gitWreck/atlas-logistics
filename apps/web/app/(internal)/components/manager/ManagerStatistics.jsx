import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faExclamationTriangle,
  faTruckFast,
} from "@fortawesome/free-solid-svg-icons";

export default function ManagerStatistics({ stats, loading, isDark = false }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Total Shipments - indigo (aligned with admin Active Trips style) */}
      <div
        className={`rounded-2xl border px-4 py-3 ${
          isDark
            ? "bg-indigo-950/40 border-indigo-800 text-indigo-200"
            : "bg-indigo-50 border-indigo-100"
        }`}
      >
        <div
          className={`text-xs font-medium uppercase tracking-wide ${
            isDark ? "text-indigo-300" : "text-indigo-700"
          }`}
        >
          Total Shipments
        </div>
        <div
          className={`mt-2 text-2xl font-semibold ${
            isDark ? "text-indigo-100" : "text-indigo-900"
          }`}
        >
          {loading ? <span className="animate-pulse">...</span> : stats.total}
        </div>
        <div
          className={`mt-1 text-xs flex items-center gap-1.5 ${
            isDark ? "text-indigo-400" : "text-indigo-600"
          }`}
        >
          <FontAwesomeIcon icon={faBoxOpen} className="text-[10px]" />
          All shipments in range
        </div>
      </div>

      {/* Delayed - amber (aligned with admin Delayed Trips) */}
      <div
        className={`rounded-2xl border px-4 py-3 ${
          isDark
            ? "bg-amber-950/40 border-amber-800 text-amber-200"
            : "bg-amber-50 border-amber-100"
        }`}
      >
        <div
          className={`text-xs font-medium uppercase tracking-wide ${
            isDark ? "text-amber-300" : "text-amber-700"
          }`}
        >
          Delayed
        </div>
        <div
          className={`mt-2 text-2xl font-semibold ${
            isDark ? "text-amber-100" : "text-amber-900"
          }`}
        >
          {loading ? <span className="animate-pulse">...</span> : stats.delayed}
        </div>
        <div
          className={`mt-1 text-xs flex items-center gap-1.5 ${
            isDark ? "text-amber-400" : "text-amber-600"
          }`}
        >
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-[10px]" />
          Requiring attention
        </div>
      </div>

      {/* In Transit - sky (aligned with admin Pickup / sky style) */}
      <div
        className={`rounded-2xl border px-4 py-3 ${
          isDark
            ? "bg-sky-950/40 border-sky-800 text-sky-200"
            : "bg-sky-50 border-sky-100"
        }`}
      >
        <div
          className={`text-xs font-medium uppercase tracking-wide ${
            isDark ? "text-sky-300" : "text-sky-700"
          }`}
        >
          In Transit
        </div>
        <div
          className={`mt-2 text-2xl font-semibold ${
            isDark ? "text-sky-100" : "text-sky-900"
          }`}
        >
          {loading ? <span className="animate-pulse">...</span> : stats.inTransit}
        </div>
        <div
          className={`mt-1 text-xs flex items-center gap-1.5 ${
            isDark ? "text-sky-400" : "text-sky-600"
          }`}
        >
          <FontAwesomeIcon icon={faTruckFast} className="text-[10px]" />
          Currently moving
        </div>
      </div>
    </div>
  );
}
