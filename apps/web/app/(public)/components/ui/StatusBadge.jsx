import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCloudBolt,
  faWrench,
  faShip,
  faTrafficLight,
  faExclamationTriangle,
  faCircleCheck,
} from "@fortawesome/free-solid-svg-icons";

// Map reasons to specific icons
const delayIcons = {
  WEATHER: faCloudBolt,
  MECHANICAL: faWrench,
  PORT_CONGESTION: faShip,
  TRAFFIC: faTrafficLight,
  OTHER: faExclamationTriangle,
};

export default function StatusBadge({ status, reason, compact = false }) {
  if (!status) return null;

  // Normalize: "Received at Warehouse" -> "RECEIVED"
  const safeStatus = (status === "Received at Warehouse" ? "RECEIVED" : status)
    .toUpperCase()
    .replace(/ /g, "_");

  // Check Delay
  const isDelayed = reason && reason.length > 0;

  // --- COLOR MAPPING (Grouped by the 4 Stages) ---
  const styles = {
    RECEIVED: "bg-cyan-50 text-cyan-700 border-cyan-200",
    RECEIVED_AT_DIVISORIA: "bg-cyan-50 text-cyan-700 border-cyan-200",
    IN_TRANSIT: "bg-blue-50 text-blue-700 border-blue-200",
    LOADED: "bg-blue-50 text-blue-700 border-blue-200",
    LOADED_TO_TRIP: "bg-blue-50 text-blue-700 border-blue-200",
    ARRIVED: "bg-sky-50 text-sky-700 border-sky-200",
    PARTIALLY_ARRIVED: "bg-sky-50 text-sky-700 border-sky-200",
    ARRIVED_AT_ODIONGAN: "bg-sky-50 text-sky-700 border-sky-200",
    AVAILABLE_AT_WAREHOUSE: "bg-sky-50 text-sky-700 border-sky-200",
    AVAILABLE_AT_ODIONGAN_WAREHOUSE: "bg-sky-50 text-sky-700 border-sky-200",
    PARTIALLY_AVAILABLE_FOR_DELIVERY: "bg-sky-50 text-sky-700 border-sky-200",
    RELEASED_FOR_DELIVERY: "bg-sky-50 text-sky-700 border-sky-200",
    AVAILABLE_FOR_DELIVERY: "bg-sky-50 text-sky-700 border-sky-200",
    READY_FOR_DELIVERY: "bg-sky-50 text-sky-700 border-sky-200",
    OUT_FOR_DELIVERY: "bg-purple-50 text-purple-700 border-purple-200",
    PARTIALLY_OUT_FOR_DELIVERY: "bg-purple-50 text-purple-700 border-purple-200",
    PARTIALLY_DELIVERED: "bg-teal-50 text-teal-700 border-teal-200",
    DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",

    DELAYED: "bg-amber-50 text-amber-700 border-amber-200",
  };

  // Determine active style
  const activeStyle = isDelayed
    ? styles.DELAYED
    : styles[safeStatus] || "bg-slate-100 text-slate-700 border-slate-300";

  // Determine Icon (Only for delay)
  const DelayIcon = isDelayed
    ? delayIcons[reason] || faExclamationTriangle
    : null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border font-bold uppercase tracking-wider ${activeStyle} ${
        compact
          ? "px-2 py-0.5 text-[10px]"
          : "gap-2 px-4 py-1.5 text-sm md:text-base"
      }`}
    >
      {isDelayed ? (
        <>
          <FontAwesomeIcon icon={DelayIcon} className="text-[10px]" />
          <span>{reason.replace(/_/g, " ")}</span>
        </>
      ) : (
        <>
          {/* Optional: Add check icon for delivered */}
          {safeStatus === "DELIVERED" && (
            <FontAwesomeIcon icon={faCircleCheck} />
          )}
          <span>{status}</span>
        </>
      )}
    </span>
  );
}
