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

export default function StatusBadge({ status, reason }) {
  if (!status) return null;

  // Normalize: "Received at Warehouse" -> "RECEIVED"
  const safeStatus = (status === "Received at Warehouse" ? "RECEIVED" : status)
    .toUpperCase()
    .replace(/ /g, "_");

  // Check Delay
  const isDelayed = reason && reason.length > 0;

  // --- COLOR MAPPING (Grouped by the 4 Stages) ---
  const styles = {
    RECEIVED: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    IN_TRANSIT: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    OUT_FOR_DELIVERY: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    DELIVERED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",

    DELAYED: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  };

  // Determine active style
  const activeStyle = isDelayed
    ? styles.DELAYED
    : styles[safeStatus] || "bg-slate-800 text-slate-400 border-slate-700";

  // Determine Icon (Only for delay)
  const DelayIcon = isDelayed
    ? delayIcons[reason] || faExclamationTriangle
    : null;

  return (
    <span
      // increased padding (px-4 py-1.5) and font size (text-sm md:text-base)
      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm md:text-base font-bold uppercase tracking-wider border ${activeStyle}`}
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
