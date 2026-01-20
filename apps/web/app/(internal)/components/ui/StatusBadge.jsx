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

export default function StatusBadge({ status, reason }) {
  if (!status) return null;

  let normalizedStatus = status.toUpperCase();

  // 1. SMART OVERRIDE:
  // If a reason is provided, treat the badge visually as "DELAYED"
  // (Amber color) regardless of whether the status string says "IN_TRANSIT"
  if (reason) {
    normalizedStatus = "DELAYED";
  }

  const styles = {
    CREATED: "bg-stone-400/10 text-slate-300 border-slate-500/20",
    RECEIVED: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    ASSIGNED: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    LOADED: "bg-orange-500/10 text-orange-400 border-orange-500/20",

    IN_TRANSIT: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ARRIVED_PORT: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    OUT_FOR_DELIVERY: "bg-purple-500/10 text-purple-400 border-purple-500/20",

    // DELAYED is amber
    DELAYED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    DELIVERED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",

    UNASSIGNED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    CANCELLED: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const defaultStyle = "bg-slate-800 text-slate-400 border-slate-700";

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
