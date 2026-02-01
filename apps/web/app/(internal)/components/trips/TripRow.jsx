import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExclamationTriangle,
  faEllipsisV,
  faTruck,
  faCalendarAlt,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../ui/StatusBadge";
import { formatFirestoreDate } from "@/app/utility/utilities"; // Ensure you have this

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

// Helper: Calculate Trip Progress %
function getTripProgress(status) {
  if (status === "COMPLETED") return 100;
  if (status === "IN_TRANSIT") return 60;
  if (status === "LOADED") return 30;
  return 10; // Planned/Created
}

export default function TripRow({ trip, onClick }) {
  // 1. Logic: Active Issue if delayCleared is explicitly false
  const isDelayed = !!trip.delayReason && !trip.delayCleared;

  // 2. Data
  const loadedCount = trip.totalLoaded || 0; // Or trip.totalLoaded if you have it
  const totalCount = trip.totalItems || 0;

  const driverName = trip.driverName || "Unassigned";
  //   const progress = getTripProgress(trip.status);

  return (
    <div
      onClick={() => onClick(trip.id)}
      className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors cursor-pointer group border-b border-slate-800/50 last:border-0
        ${isDelayed ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-slate-800/30"}
      `}
    >
      {/* Col 1: ID & Status Pulse */}
      <div className="col-span-3 flex items-center gap-4">
        <StatusDot status={trip.status} isDelayed={isDelayed} />

        <div>
          {/* TRIP ID */}
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`font-mono text-sm font-bold transition-colors flex items-center gap-2 ${isDelayed ? "text-amber-400" : "text-blue-400"}`}
            >
              <FontAwesomeIcon icon={faTruck} className="text-[10px]" />
              {trip.tripId}
            </span>
            {isDelayed && (
              <span className="text-[10px] bg-amber-600 text-white px-1.5 rounded animate-pulse font-bold">
                DELAYED
              </span>
            )}
          </div>

          {/* DRIVER INFO */}
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <StatusBadge
              status={trip.status}
              // reason={s.truckDetails?.delayReason}
              size="xs"
            />
            <span className="font-medium text-slate-300">{driverName}</span>
            <span className="text-slate-600">•</span>
            <span className="font-mono text-slate-500">
              {trip.truckPlateNumber || "No Plate"}
            </span>
          </div>
        </div>
      </div>

      {/* Col 2: Route */}
      <div className="col-span-2">
        <div className="text-sm font-medium text-slate-300">
          {trip.originCode} <span className="text-slate-600 px-1">→</span>{" "}
          {trip.destinationCode}
        </div>
        <div
          className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[120px]"
          title={trip.route}
        >
          {trip.origin} → {trip.destination}
        </div>
      </div>

      <div className="col-span-1 pr-4">
        <span className="text text-slate-500 font-mono border-l border-slate-700 pl-2">
          {loadedCount}/{totalCount} Loaded
        </span>
      </div>

      {/* Col 3: Progress Bar (Load & Status) */}
      <div className="col-span-3 pr-4">
        {/* Load Stats */}
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>{trip.progress}%</span>
        </div>

        {/* Bar */}
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              trip.status === "COMPLETED"
                ? "bg-emerald-500"
                : isDelayed
                  ? "bg-amber-500" // Red bar for delay
                  : "bg-blue-500"
            }`}
            style={{ width: `${trip.progress}%` }}
          />
        </div>

        {/* Status Text */}
        <div className="mt-1.5">
          <span
            className={`text-[10px] font-bold uppercase tracking-wide
              ${
                isDelayed
                  ? "text-amber-400"
                  : trip.status === "COMPLETED"
                    ? "text-emerald-400"
                    : "text-blue-400"
              }`}
          >
            {isDelayed
              ? trip.delayReason?.replace("_", " ") || "DELAYED"
              : trip.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Col 4: Time / Last Update */}
      <div className="col-span-2 flex flex-col gap-1">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          {/* <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-700" /> */}
          {formatFirestoreDate(trip.updatedAt)}
        </div>

        {/* Show Scheduled Time if not completed */}
        {trip.status !== "COMPLETED" && trip.estimatedArrival && (
          <div className="text-xs text-slate-600">
            ETA: {new Date(trip.estimatedArrival).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Col 5: Actions */}
      <div className="col-span-1 text-right">
        <button
          className="text-slate-500 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-colors"
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
