import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCloudBolt,
  faWrench,
  faShip,
  faTrafficLight,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { getPackageStatusLabel } from "@/app/utility/packageStatus";

// Map reasons to specific icons
const delayIcons = {
  WEATHER: faCloudBolt,
  MECHANICAL: faWrench,
  PORT_CONGESTION: faShip,
  TRAFFIC: faTrafficLight,
  OTHER: faExclamationTriangle,
};

export default function StatusBadge({
  status,
  reason,
  label,
  isDark = true,
  className = "",
  compact = false,
}) {
  if (!status) return null;

  let normalizedStatus = status.toUpperCase().replace(/\s+/g, "_");

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
    PARTIALLY_LOADED:
      "bg-lime-500/10 text-lime-400 border-lime-500/20",
    LOADED: "bg-orange-500/10 text-orange-400 border-orange-500/20",

    IN_TRANSIT: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ARRIVED_PORT: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    READY_FOR_DELIVERY: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    OUT_FOR_DELIVERY: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    PARTIALLY_DELIVERED:
      "bg-teal-500/10 text-teal-400 border-teal-500/20",
    PARTIALLY_IN_TRANSIT:
      "bg-blue-500/10 text-blue-300 border-blue-500/20",
    PARTIALLY_ARRIVED:
      "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
    PARTIALLY_AVAILABLE_FOR_DELIVERY:
      "bg-sky-500/10 text-sky-300 border-sky-500/20",
    AVAILABLE_FOR_DELIVERY:
      "bg-sky-500/10 text-sky-300 border-sky-500/20",
    AVAILABLE_AT_ODIONGAN_WAREHOUSE:
      "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    RELEASED_FOR_DELIVERY:
      "bg-sky-500/10 text-sky-400 border-sky-500/20",
    RECEIVED_AT_DIVISORIA:
      "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    LOADED_TO_TRIP:
      "bg-orange-500/10 text-orange-300 border-orange-500/20",
    ARRIVED_AT_ODIONGAN:
      "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    LOADED_TO_DELIVERY_VEHICLE:
      "bg-purple-500/10 text-purple-300 border-purple-500/20",

    // DELAYED is amber
    DELAYED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    DELIVERED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    COMPLETED: "bg-emerald-500/30 text-emerald-400 border-emerald-500/20",

    UNASSIGNED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    CANCELLED: "bg-red-500/10 text-red-400 border-red-500/20",
    RECEIVING_IN_PROGRESS:
      "bg-teal-500/10 text-teal-400 border-teal-500/20",
    RECONCILED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    OPEN: "bg-slate-500/10 text-slate-300 border-slate-500/20",
    LOCKED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    UNLOADING: "bg-teal-500/10 text-teal-400 border-teal-500/20",

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
    PARTIALLY_LOADED:
      "bg-lime-500/15 text-lime-700 border-lime-400/40",
    LOADED: "bg-orange-500/15 text-orange-600 border-orange-400/40",

    IN_TRANSIT: "bg-blue-500/15 text-blue-600 border-blue-400/40",
    ARRIVED_PORT: "bg-indigo-500/15 text-indigo-600 border-indigo-400/40",
    READY_FOR_DELIVERY: "bg-sky-500/15 text-sky-600 border-sky-400/40",
    OUT_FOR_DELIVERY: "bg-purple-500/15 text-purple-600 border-purple-400/40",
    PARTIALLY_DELIVERED:
      "bg-teal-500/15 text-teal-600 border-teal-400/40",
    PARTIALLY_IN_TRANSIT:
      "bg-blue-500/15 text-blue-600 border-blue-400/40",
    PARTIALLY_ARRIVED:
      "bg-indigo-500/15 text-indigo-600 border-indigo-400/40",
    PARTIALLY_AVAILABLE_FOR_DELIVERY:
      "bg-sky-500/15 text-sky-600 border-sky-400/40",
    AVAILABLE_FOR_DELIVERY:
      "bg-sky-500/15 text-sky-600 border-sky-400/40",
    AVAILABLE_AT_ODIONGAN_WAREHOUSE:
      "bg-cyan-500/15 text-cyan-600 border-cyan-400/40",
    RELEASED_FOR_DELIVERY:
      "bg-sky-500/15 text-sky-700 border-sky-400/40",
    RECEIVED_AT_DIVISORIA:
      "bg-cyan-500/15 text-cyan-600 border-cyan-400/40",
    LOADED_TO_TRIP:
      "bg-orange-500/15 text-orange-600 border-orange-400/40",
    ARRIVED_AT_ODIONGAN:
      "bg-indigo-500/15 text-indigo-600 border-indigo-400/40",
    LOADED_TO_DELIVERY_VEHICLE:
      "bg-purple-500/15 text-purple-600 border-purple-400/40",

    DELAYED: "bg-amber-500/15 text-amber-700 border-amber-400/40",
    DELIVERED: "bg-emerald-500/15 text-emerald-600 border-emerald-400/40",
    COMPLETED: "bg-emerald-500/20 text-emerald-600 border-emerald-400/40",

    UNASSIGNED: "bg-amber-500/15 text-amber-700 border-amber-400/40",
    CANCELLED: "bg-red-500/15 text-red-600 border-red-400/40",
    RECEIVING_IN_PROGRESS:
      "bg-teal-500/15 text-teal-600 border-teal-400/40",
    RECONCILED: "bg-emerald-500/15 text-emerald-600 border-emerald-400/40",
    OPEN: "bg-slate-500/15 text-slate-600 border-slate-300",
    LOCKED: "bg-amber-500/15 text-amber-700 border-amber-400/40",
    UNLOADING: "bg-teal-500/15 text-teal-600 border-teal-400/40",

    ACTIVE: "bg-emerald-500/15 text-emerald-600 border-emerald-400/40",
    IDLE: "bg-slate-500/15 text-slate-600 border-slate-400/40",
    MAINTENANCE: "bg-amber-500/15 text-amber-700 border-amber-400/40",
    REPAIR: "bg-orange-500/15 text-orange-600 border-orange-400/40",
    DISABLED: "bg-rose-500/15 text-rose-600 border-rose-400/40",
    OUT_OF_SERVICE: "bg-red-500/15 text-red-600 border-red-400/40",
  };

  const styles = isDark ? stylesDark : stylesLight;
  const defaultStyle = isDark ? "bg-slate-800 text-slate-400 border-slate-700" : "bg-slate-200 text-slate-700 border-slate-300";
  const sizeClass = compact
    ? "px-1.5 py-0.5 text-[10px] md:text-[9px] tracking-normal"
    : "px-2 py-0.5 text-[10px] tracking-wide";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded font-bold uppercase border leading-none ${sizeClass} ${
        styles[normalizedStatus] || defaultStyle
      } ${className}`}
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
        label || getPackageStatusLabel(normalizedStatus)
      )}
    </span>
  );
}
