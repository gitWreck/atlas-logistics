import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsisV, faTruck } from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../ui/StatusBadge";

// Keeping your visual component
function StatusDot({ status, isDelayed }) {
  let color = "bg-blue-500";
  if (status === "DELIVERED") color = "bg-emerald-500";
  if (status === "CREATED") color = "bg-slate-600";
  if (isDelayed) color = "bg-amber-500";

  return (
    <div className="relative flex items-center justify-center w-3 h-3 flex-shrink-0">
      {status !== "DELIVERED" && status !== "CREATED" && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </div>
  );
}

export default function ShipmentRow({ s, onClick, isDark = false }) {
  // 1. Data Safety Checks
  const isDelayed =
    !!s.truckDetails?.delayReason && !s.truckDetails?.delayCleared;
  // const loadedCount = s.totals?.loaded || 0;
  // const totalCount = s.totals?.totalItems || 0;
  const loadedCount = s.metrics?.totalLoaded || 0;
  const totalCount = s.metrics?.totalContent || 0;

  // 2. Extract "Latest Trip" Data
  const driverName = s.truckDetails?.driverName || "Unassigned";

  return (
    <div
      className={`
        relative flex flex-col gap-3 p-4 border-b cursor-pointer transition-colors group
        md:grid md:grid-cols-12 md:gap-4 md:px-6 md:items-center
        ${isDark ? "border-slate-800/50 hover:bg-slate-800/30" : "border-slate-200 hover:bg-slate-50"}
      `}
    >
      {/* --- MOBILE HEADER (Top Row) --- */}
      <div className="flex md:hidden justify-between items-start mb-1">
        <div className="flex items-center gap-3">
          {/* Status Dot */}
          <StatusDot status={s.status} isDelayed={isDelayed} />
          <div>
            {/* Tracking Number */}
            <div
              className={`font-mono text-sm font-bold ${isDark ? "text-blue-400" : "text-blue-600"}`}
            >
              {s.trackingNumber}
            </div>
            <div
              className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-600"}`}
            >
              {s.updatedAt || "Just now"}
            </div>
          </div>
        </div>
        {/* Mobile Action Button */}
        <button
          className={`p-2 -mr-2 ${isDark ? "text-slate-500" : "text-slate-400"}`}
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>

      {/* --- COL 1: Tracking/Driver --- */}
      <div className="md:col-span-4 flex items-center gap-4">
        {/* Desktop Status (Hidden on Mobile) */}
        <div className="hidden md:block">
          <StatusDot status={s.status} isDelayed={isDelayed} />
        </div>

        <div className="w-full">
          {/* Desktop Tracking (Hidden on Mobile) */}
          <div
            className={`hidden md:block font-mono text-sm font-medium transition-colors ${
              isDark
                ? "text-slate-200 group-hover:text-blue-400"
                : "text-slate-700 group-hover:text-blue-600"
            }`}
          >
            {s.trackingNumber}
          </div>

          {/* DRIVER & LOAD COUNTS (Visible on both) */}
          <div className="flex flex-wrap md:flex-nowrap items-center gap-3 mt-1">
            <StatusBadge status={s.status} size="xs" isDark={isDark} />
            {/* Mobile Loaded Info */}
            <span
              className={`text-xs font-mono border-l pl-2 ${isDark ? "text-slate-500 border-slate-700" : "text-slate-600 border-slate-300"}`}
            >
              {loadedCount}/{totalCount} Loaded
            </span>
            {/* Desktop Driver Info */}
            <span
              className={`hidden md:block text-xs border-l pl-2 truncate max-w-[120px] ${isDark ? "text-slate-500 border-slate-700" : "text-slate-600 border-slate-300"}`}
              title={driverName}
            >
              Driver: {driverName}
            </span>
          </div>
          {/* Mobile Driver Info (New Row) */}
          <div
            className={`md:hidden text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
          >
            Driver: {driverName}
          </div>
        </div>
      </div>

      {/* --- COL 2: Route --- */}
      <div
        className={`md:col-span-2 flex justify-between md:block items-center md:border-0 pt-2 md:pt-0 ${isDark ? "border-t border-slate-800/50" : "border-t border-slate-200"}`}
      >
        <div
          className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}
        >
          {s.originCode + " -> " + s.destinationCode || "STD-ROUTE"}
        </div>
        <div
          className={`text-xs font-mono mt-0.5 ${isDark ? "text-slate-600" : "text-slate-500"}`}
        >
          {s.origin + " -> " + s.destination || "—"}
        </div>
      </div>

      {/* --- COL 3: Progress Bar --- */}
      <div className="md:col-span-3 md:pr-4 w-full mt-2 md:mt-0">
        <div
          className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              s.status === "DELIVERED"
                ? "bg-emerald-500"
                : s.truckDetails?.delayReason
                  ? "bg-amber-500"
                  : "bg-blue-500"
            }`}
            style={{ width: `${s.progress || 0}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span
            className={`text-[10px] font-medium uppercase ${
              isDelayed
                ? "text-amber-500"
                : s.status === "DELIVERED"
                  ? "text-emerald-600"
                  : isDark
                    ? "text-blue-400"
                    : "text-blue-600"
            }`}
          >
            {s.status?.replace("_", " ")}
          </span>
          <span
            className={`text-[10px] ${isDark ? "text-slate-600" : "text-slate-500"}`}
          >
            {s.progress || 0}%
          </span>
        </div>
      </div>

      {/* --- COL 4: Delay/Time (Desktop Only) --- */}
      <div className="hidden md:flex col-span-2 flex-col gap-2">
        <div
          className={`text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}
        >
          {s.updatedAt || "Just now"}
        </div>
        {isDelayed && (
          <div className="w-fit">
            <StatusBadge
              status={s.truckDetails?.status}
              reason={s.truckDetails?.delayReason}
              isDark={isDark}
            />
          </div>
        )}
      </div>

      {/* --- COL 5: Actions (Desktop Only) --- */}
      <div className="hidden md:block col-span-1 text-right">
        <button
          className={`p-2 rounded-full transition-colors ${isDark ? "text-slate-500 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"}`}
          onClick={(e) => {
            e.stopPropagation();
            onClick(s.id);
          }}
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>
    </div>
  );
}
