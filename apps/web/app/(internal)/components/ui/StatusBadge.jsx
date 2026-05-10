import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCloudBolt,
  faWrench,
  faShip,
  faTrafficLight,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";

// Map reasons to specific icons
const delayIcons = {
  WEATHER: faCloudBolt,
  MECHANICAL: faWrench,
  PORT_CONGESTION: faShip,
  TRAFFIC: faTrafficLight,
  OTHER: faExclamationTriangle,
};

export default function StatusBadge({ status, reason, isDark = true }) {
  if (!status) return null;

  let normalizedStatus = status.toUpperCase();

  // 1. SMART OVERRIDE:
  // If a reason is provided, treat the badge visually as "DELAYED"
  // (Amber color) regardless of whether the status string says "IN_TRANSIT"
  if (reason) {
    normalizedStatus = "DELAYED";
  }

  const stylesDark = {
    CREATED: "bg-stone-200/10 text-slate-300 border-slate-500/20",

    // --- NEW PICKUP STATUSES ---
    PENDING_PICKUP: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    DISPATCHED: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", // For local trips
    PICKED_UP: "bg-teal-500/10 text-teal-400 border-teal-500/20",

    RECEIVED: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    ASSIGNED: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    LOADED: "bg-orange-500/10 text-orange-400 border-orange-500/20",

    IN_TRANSIT: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ARRIVED_PORT: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    READY_FOR_DELIVERY: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    OUT_FOR_DELIVERY: "bg-purple-500/10 text-purple-400 border-purple-500/20",

    // DELAYED is amber
    DELAYED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    DELIVERED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    COMPLETED: "bg-emerald-500/30 text-emerald-400 border-emerald-500/20",

    UNASSIGNED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    CANCELLED: "bg-red-500/10 text-red-400 border-red-500/20",

    // --- NEW TRUCK ASSET STATUSES ---
    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    IDLE: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    MAINTENANCE: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    REPAIR: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    DISABLED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    OUT_OF_SERVICE: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const stylesLight = {
    CREATED: "bg-stone-200/80 text-slate-600 border-slate-300",

    PENDING_PICKUP: "bg-sky-500/15 text-sky-600 border-sky-400/40",
    DISPATCHED: "bg-indigo-500/15 text-indigo-600 border-indigo-400/40",
    PICKED_UP: "bg-teal-500/15 text-teal-600 border-teal-400/40",

    RECEIVED: "bg-cyan-500/15 text-cyan-600 border-cyan-400/40",
    ASSIGNED: "bg-yellow-500/15 text-yellow-700 border-yellow-400/40",
    LOADED: "bg-orange-500/15 text-orange-600 border-orange-400/40",

    IN_TRANSIT: "bg-blue-500/15 text-blue-600 border-blue-400/40",
    ARRIVED_PORT: "bg-indigo-500/15 text-indigo-600 border-indigo-400/40",
    READY_FOR_DELIVERY: "bg-sky-500/15 text-sky-600 border-sky-400/40",
    OUT_FOR_DELIVERY: "bg-purple-500/15 text-purple-600 border-purple-400/40",

    DELAYED: "bg-amber-500/15 text-amber-700 border-amber-400/40",
    DELIVERED: "bg-emerald-500/15 text-emerald-600 border-emerald-400/40",
    COMPLETED: "bg-emerald-500/20 text-emerald-600 border-emerald-400/40",

    UNASSIGNED: "bg-amber-500/15 text-amber-700 border-amber-400/40",
    CANCELLED: "bg-red-500/15 text-red-600 border-red-400/40",

    ACTIVE: "bg-emerald-500/15 text-emerald-600 border-emerald-400/40",
    IDLE: "bg-slate-500/15 text-slate-600 border-slate-400/40",
    MAINTENANCE: "bg-amber-500/15 text-amber-700 border-amber-400/40",
    REPAIR: "bg-orange-500/15 text-orange-600 border-orange-400/40",
    DISABLED: "bg-rose-500/15 text-rose-600 border-rose-400/40",
    OUT_OF_SERVICE: "bg-red-500/15 text-red-600 border-red-400/40",
  };

  const styles = isDark ? stylesDark : stylesLight;
  const defaultStyle = isDark ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-slate-200 text-slate-700 border-slate-300";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
        styles[normalizedStatus] || defaultStyle
      }`}
    >
      {/* 2. CONDITIONAL CONTENT: */}
      {reason ? (
        <>
          <FontAwesomeIcon
            icon={delayIcons[reason] || faExclamationTriangle}
            className="text-[9px] opacity-80"
          />
          {reason.replace(/_/g, " ")}
        </>
      ) : (
        normalizedStatus.replace(/_/g, " ")
      )}
    </span>
  );
}
