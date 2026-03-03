import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisV,
  faRoute,
  faTruck,
  faWeightHanging,
  faWrench,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../ui/StatusBadge"; // Assuming you have this

function StatusDot({ status }) {
  let color = "bg-emerald-500"; // ACTIVE
  if (status === "MAINTENANCE") color = "bg-amber-500";
  if (status === "DISABLED" || status === "OUT_OF_SERVICE")
    color = "bg-red-500";
  if (status === "IDLE") color = "bg-slate-500";

  return (
    <div className="relative flex items-center justify-center w-3 h-3 flex-shrink-0">
      {status === "ACTIVE" && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </div>
  );
}

export default function TruckRow({ truck: t, onEdit, isDark = false }) {
  // PMS Logic
  const serviceInterval = 5000;
  const currentOdo = Number(t.lastPmsOdometer) || 0;
  const pmsProgress = Math.min(
    Math.max(((serviceInterval - (t.nextPMS || 0)) / serviceInterval) * 100, 0),
    100,
  );
  const isCritical = (t.nextPMS || 0) <= 500;
  // --- NEW: COMPLIANCE & MAINTENANCE LOGIC ---
  const ltoExpiry = t.registrationExpiry
    ? new Date(t.registrationExpiry)
    : null;
  // Due if expiry is within 30 days
  const isLtoDue = ltoExpiry
    ? (ltoExpiry.getTime() - Date.now()) / (1000 * 3600 * 24) <= 30
    : false;

  // Oil due if driven 10,000 KM since last change
  const isOilDue =
    t.lastOilChange && currentOdo - Number(t.lastOilChange) >= 10000;
  // Tires due if driven 50,000 KM since last change
  const isTireDue =
    t.lastTireChange && currentOdo - Number(t.lastTireChange) >= 50000;

  return (
    <div
      className={`
      relative flex flex-col gap-3 p-4 transition-colors cursor-pointer group last:border-0
      md:grid md:grid-cols-12 md:gap-4 md:px-6 md:items-center
      ${
        isDark
          ? "hover:bg-slate-800/30 border-b border-slate-800/50"
          : "hover:bg-slate-50 border-b border-slate-200 bg-white"
      }
    `}
    >
      {/* --- MOBILE HEADER: Plate, Status & Action --- */}
      <div className="flex md:hidden justify-between items-start mb-1">
        <div className="flex items-center gap-3">
          <StatusDot status={t.status} />
          <div>
            <div
              className={`font-mono text-sm font-medium uppercase ${
                isDark ? "text-slate-200" : "text-slate-900"
              }`}
            >
              {t.plateNumber}
            </div>
            <div
              className={`text-[10px] font-bold uppercase tracking-tight ${
                isDark ? "text-slate-500" : "text-slate-600"
              }`}
            >
              {t.model}
            </div>
          </div>
        </div>
        <button
          className={`p-2 -mr-2 ${
            isDark ? "text-slate-500" : "text-slate-400 hover:text-slate-700"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>

      {/* --- COL 1: Plate & Model (Desktop) --- */}
      <div className="md:col-span-4 flex items-center gap-4">
        {/* Hide StatusDot on Mobile (Moved to header) */}
        <div className="hidden md:block">
          <StatusDot status={t.status} />
        </div>

        <div className="w-full">
          {/* Hide Plate/Model on Mobile (Moved to header) */}
          <div className="hidden md:block">
            <div
              className={`font-mono text-sm font-medium uppercase transition-colors ${
                isDark
                  ? "text-slate-200 group-hover:text-blue-400"
                  : "text-slate-900 group-hover:text-blue-600"
              }`}
            >
              {t.plateNumber}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span
                className={`text-[10px] font-bold uppercase tracking-tight ${
                  isDark ? "text-slate-500" : "text-slate-600"
                }`}
              >
                {t.model}
              </span>
              <span
                className={`text-xs font-mono border-l pl-2 ${
                  isDark
                    ? "text-slate-600 border-slate-700"
                    : "text-slate-500 border-slate-200"
                }`}
              >
                {t.type}
              </span>
            </div>
          </div>

          {/* Mobile Only: Extra Type Info under header */}
          <div
            className={`md:hidden text-xs font-mono mt-1 ${
              isDark ? "text-slate-500" : "text-slate-600"
            }`}
          >
            Type: {t.type}
          </div>
        </div>
      </div>

      {/* --- COL 2: Status Badge --- */}
      <div className="md:col-span-2 flex flex-row md:flex-col items-center md:items-start justify-between md:justify-start gap-2">
        <StatusBadge status={t.status} size="xs" />

        {/* Show context only if it's not IDLE or DISABLED */}
        {(t.status === "IN_TRANSIT" || t.status === "ASSIGNED") && (
          <div className="md:mt-1.5 flex items-center gap-2 md:block">
            {/* <div className="flex items-center gap-1 text-[9px] font-mono text-blue-400 bg-blue-500/5 w-fit px-1.5 py-0.5 rounded border border-blue-500/10">
              <FontAwesomeIcon icon={faRoute} className="text-[8px]" />
              {t.currentTripId || "TRP-XXXX"}
            </div> */}
            {/* Mobile ETA inline */}
            <span
              className={`md:hidden text-[9px] italic ${
                isDark ? "text-slate-500" : "text-slate-600"
              }`}
            >
              ETA: {t.eta || "Pending"}
            </span>
            {/* Desktop ETA block */}
            <p
              className={`hidden md:block text-[9px] italic pl-1 mt-1 ${
                isDark ? "text-slate-500" : "text-slate-600"
              }`}
            >
              ETA: {t.eta || "Pending"}
            </p>
          </div>
        )}
      </div>

      {/* --- COL 3: PMS Health Bar --- */}
      <div className="md:col-span-3 md:pr-4 w-full mt-2 md:mt-0">
        <div
          className={`h-1.5 w-full rounded-full overflow-hidden ${
            isDark ? "bg-slate-800" : "bg-slate-200"
          }`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isCritical ? "bg-red-500" : "bg-blue-500"
            }`}
            style={{ width: `${pmsProgress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span
            className={`text-[10px] font-bold uppercase ${
              isCritical
                ? "text-red-500"
                : isDark
                  ? "text-slate-500"
                  : "text-slate-700"
            }`}
          >
            {isCritical ? "Service Required" : "PMS Health"}
          </span>
          <span
            className={`text-[10px] font-mono ${
              isDark ? "text-slate-600" : "text-slate-700"
            }`}
          >
            {t.lastPmsOdometer} KM
          </span>
        </div>
      </div>

      {/* --- COL 4: Payload, Compliance & Alerts --- */}
      <div
        className={`md:col-span-2 flex flex-col justify-center gap-1.5 mt-2 md:mt-0 border-t md:border-0 pt-2 md:pt-0 ${
          isDark ? "border-slate-800/50" : "border-slate-200"
        }`}
      >
        {/* Payload */}
        <div
          className={`text-xs flex items-center gap-2 ${
            isDark ? "text-slate-300" : "text-slate-800"
          }`}
        >
          <FontAwesomeIcon
            icon={faWeightHanging}
            className={`text-[10px] ${
              isDark ? "text-slate-500" : "text-slate-600"
            }`}
          />
          {t.payloadCapacity || t.payload} KG
        </div>

        {/* Dynamic Alert Badges */}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {isLtoDue && (
            <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">
              LTO RENEWAL
            </span>
          )}
          {isOilDue && (
            <span className="text-[9px] font-bold bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/30">
              OIL CHANGE
            </span>
          )}
          {isTireDue && (
            <span className="text-[9px] font-bold bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/30">
              TIRES DUE
            </span>
          )}
          {!isLtoDue && !isOilDue && !isTireDue && (
            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
              Fully Compliant
            </span>
          )}
        </div>

        {/* Registration info */}
        <div
          className={`text-[10px] flex items-center gap-2 ${
            isDark ? "text-slate-600" : "text-slate-700"
          }`}
        >
          <span>
            LTO:{" "}
            <span
              className={`font-mono ${
                isDark ? "text-slate-300" : "text-slate-800"
              }`}
            >
              {t.registrationExpiry
                ? new Date(t.registrationExpiry).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "—"}
            </span>
          </span>
        </div>
      </div>

      {/* --- COL 5: Actions (Desktop Only) --- */}
      <div className="hidden md:block col-span-1 text-right">
        <button
          className={`p-2 rounded-full transition-colors ${
            isDark
              ? "text-slate-500 hover:text-white hover:bg-slate-800"
              : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>
    </div>
  );
}
