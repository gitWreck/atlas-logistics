import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisV,
  faTruck,
  faTruckPickup,
} from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";

// Helper: Determine Dot Color
function StatusDot({ status, isDelayed }) {
  let color = "bg-blue-500";
  let animate = false;

  if (status === "COMPLETED") color = "bg-emerald-500";
  if (status === "CREATED") color = "bg-slate-600";
  if (status === "IN_TRANSIT") {
    color = "bg-blue-500";
    animate = true;
  }
  if (isDelayed) {
    color = "bg-amber-500"; // Red for active delay
    animate = true;
  }

  return (
    <div className="relative flex items-center justify-center w-3 h-3 flex-shrink-0">
      {animate && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </div>
  );
}

export default function TripRow({ trip, onClick, isDark = false }) {
  const isDelayed = !!trip.delayReason && !trip.delayCleared;
  const loadedCount = trip.totalLoaded || 0;
  const totalCount = trip.totalItems || 0;
  const driverName = trip.driverName || "Unassigned";

  // NEW: Determine trip type
  const isLocal = trip.tripType === "LOCAL_PICKUP";

  return (
    <div
      onClick={() => onClick(trip.id)}
      className={`
        relative flex flex-col gap-3 p-4 border-b cursor-pointer transition-colors group
        md:grid md:grid-cols-12 md:gap-4 md:px-6 md:items-center
        ${isDark ? "border-slate-800/50" : "border-slate-200"}
        ${isDelayed ? (isDark ? "bg-amber-500/5 hover:bg-amber-500/10" : "bg-amber-50 hover:bg-amber-50/80") : isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-50"}
      `}
    >
      {/* --- MOBILE ONLY HEADER (Top Row) --- */}
      <div className="flex md:hidden justify-between items-start mb-2">
        <div className="flex items-start gap-3">
          {/* Added mt-1 to the dot so it aligns nicely with the taller text stack */}
          <div className="mt-1">
            <StatusDot status={trip.status} isDelayed={isDelayed} />
          </div>

          {/* Desktop ID (Hidden on mobile) */}
          <div className="hidden md:flex flex-col items-start gap-0.5 mt-1">
            {/* Trip Type Badge (Mobile Header) */}
            <span
              className={`text-[8px] tracking-wider font-bold px-1.5 py-[1px] rounded border w-max ${
                isLocal
                  ? isDark
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                  : isDark
                    ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                    : "bg-blue-100 text-blue-800 border-blue-300"
              }`}
            >
              {isLocal ? "LOCAL PICKUP" : "HUB TRANSFER"}
            </span>

            <span
              className={`font-mono text-sm font-bold transition-colors flex items-center gap-2 ${
                isDelayed
                  ? isDark
                    ? "text-amber-400"
                    : "text-amber-700"
                  : isDark
                    ? "text-blue-400"
                    : "text-blue-600"
              }`}
            >
              <FontAwesomeIcon
                icon={isLocal ? faTruckPickup : faTruck}
                className="text-[10px]"
              />
              {trip.tripId}
            </span>
            <div
              className={`text-[10px] ${
                isDark ? "text-slate-500" : "text-slate-600"
              }`}
            >
              {formatFirestoreDate(trip.updatedAt)}
            </div>
          </div>
        </div>
        {/* Mobile Action Button */}
        <button
          className={`p-2 -mr-2 ${isDark ? "text-slate-500" : "text-slate-600"}`}
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>

      {/* --- DESKTOP COL 1 (ID & Driver) / MOBILE CONTENT --- */}
      <div className="md:col-span-3 flex items-center gap-4">
        {/* Hide StatusDot on mobile since we moved it to header */}
        <div className="hidden md:block">
          <StatusDot status={trip.status} isDelayed={isDelayed} />
        </div>

        <div className="w-full">
          {/* Desktop ID (Hidden on mobile) */}
          <div className="hidden md:flex flex-col items-start gap-2 mt-1">
            <div className="flex items-center gap-2">
              <span
                className={`font-mono text-sm font-bold transition-colors flex items-center gap-2 ${
                  isDelayed
                    ? isDark
                      ? "text-amber-400"
                      : "text-amber-700"
                    : isDark
                      ? "text-blue-400"
                      : "text-blue-600"
                }`}
              >
                <FontAwesomeIcon
                  icon={isLocal ? faTruckPickup : faTruck}
                  className="text-[10px]"
                />
                {trip.tripId}
              </span>
            </div>
          </div>

          {/* Driver Info (Visible on both) */}
          <div
            className={`text-xs md:mt-1 flex items-center justify-between md:justify-start gap-2 w-full ${isDark ? "text-slate-400" : "text-slate-600"}`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                {driverName}
              </span>
              <span className={isDark ? "text-slate-600" : "text-slate-400"}>
                •
              </span>
              <span
                className={`font-mono ${isDark ? "text-slate-500" : "text-slate-600"}`}
              >
                {trip.truckPlateNumber || "No Plate"}
              </span>
            </div>
            {/* Mobile Loaded Count (Moved here for space) */}
            <span
              className={`md:hidden font-mono text-[10px] ${isDark ? "text-slate-500" : "text-slate-600"}`}
            >
              {loadedCount}/{totalCount} Items
            </span>
          </div>
        </div>
      </div>

      {/* --- COL 2: Route (origin warehouse / destination) --- */}
      <div
        className={`md:col-span-2 flex justify-between md:block items-center border-t md:border-0 pt-2 md:pt-0 ${
          isDark ? "border-slate-800/50" : "border-slate-200"
        }`}
      >
        <div
          className={`text-sm font-medium flex items-center gap-2 ${
            isDark ? "text-slate-300" : "text-slate-800"
          }`}
        >
          {trip.originCode}
          <span className={isDark ? "text-slate-600" : "text-slate-500"}>
            {isLocal ? "↻" : "→"}
          </span>
          {isLocal && trip.originCode === trip.destinationCode
            ? "HUB TRANSFER"
            : trip.destinationCode}
        </div>
        <div
          className={`text-[10px] font-mono md:mt-0.5 truncate max-w-[150px] md:max-w-[120px] ${
            isDark ? "text-slate-500" : "text-slate-600"
          }`}
          title={trip.route}
        >
          {isLocal ? "LOCAL PICKUP" : `${trip.origin} → ${trip.destination}`}
        </div>
<<<<<<< HEAD
        {/* NEW: Desktop Trip Type Badge */}
        <span
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${isLocal ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"}`}
=======

        <span
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
            isLocal
              ? isDark
                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                : "bg-amber-100 text-amber-800 border-amber-300"
              : isDark
                ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                : "bg-blue-100 text-blue-800 border-blue-300"
          }`}
>>>>>>> 67f55e5810f6b5ad601143ca2669dc577d39c2ef
        >
          {isLocal ? "LOCAL PICKUP" : "HUB TRANSFER"}
        </span>
      </div>

      {/* --- COL 3: Stats (Desktop Only - Mobile Moved to Driver Row) --- */}
      <div className="hidden md:block col-span-1 pr-4">
        <span
          className={`text-[14px] font-mono border-l pl-2 ${
            isDark
              ? "text-slate-500 border-slate-700"
              : "text-slate-600 border-slate-300"
          }`}
        >
          {loadedCount}/{totalCount} Loaded
        </span>
      </div>

      {/* --- COL 4: Progress Bar --- */}
      <div className="md:col-span-3 md:pr-4 w-full">
        {/* Load Stats (Desktop Only) */}
        <div
          className={`hidden md:flex justify-between text-[10px] mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
        >
          <span>{trip.progress}%</span>
        </div>

        {/* Bar */}
        <div
          className={`h-1.5 w-full rounded-full overflow-hidden mt-1 md:mt-0 ${isDark ? "bg-slate-800" : "bg-slate-200"}`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              trip.status === "COMPLETED"
                ? "bg-emerald-500"
                : isDelayed
                  ? "bg-amber-500"
                  : "bg-blue-500"
            }`}
            style={{ width: `${trip.progress}%` }}
          />
        </div>

        {/* Status Text (Desktop Only) */}
        <div className="mt-1.5 gap-2 hidden md:flex">
          {isDelayed && (
            <span
              className={`text-[14px] px-1.5 rounded animate-pulse font-bold ${isDark ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-800"}`}
            >
              DELAYED
            </span>
          )}
          <span
            className={`text-[12px] font-bold uppercase tracking-wide ${
              isDelayed
                ? isDark
                  ? "text-amber-400"
                  : "text-amber-700"
                : trip.status === "COMPLETED"
                  ? isDark
                    ? "text-emerald-400"
                    : "text-emerald-600"
                  : isDark
                    ? "text-blue-400"
                    : "text-blue-600"
            }`}
          >
            {isDelayed
              ? trip.delayReason?.replace("_", " ") || "DELAYED"
              : trip.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* --- COL 5: Time (Desktop Only) --- */}
      <div className="hidden md:flex col-span-2 flex-col gap-1">
        <div
          className={`text-[14px] flex items-center gap-1.5 ${isDark ? "text-slate-500" : "text-slate-600"}`}
        >
          {formatFirestoreDate(trip.updatedAt)}
        </div>
        {trip.status !== "COMPLETED" && trip.estimatedArrival && (
          <div
            className={`text-xs ${isDark ? "text-slate-600" : "text-slate-500"}`}
          >
            ETA: {new Date(trip.estimatedArrival).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* --- COL 6: Action (Desktop Only) --- */}
      <div className="hidden md:block col-span-1 text-right">
        <button
          className={`p-2 rounded-full transition-colors ${isDark ? "text-slate-500 hover:text-white hover:bg-slate-800" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
          onClick={(e) => {
            e.stopPropagation();
            onClick(trip.id);
          }}
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>
    </div>
  );
}
