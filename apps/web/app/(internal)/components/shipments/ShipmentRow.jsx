import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExclamationTriangle,
  faShip,
  faEllipsisV,
  faTruck,
} from "@fortawesome/free-solid-svg-icons";
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

export default function ShipmentRow({ s, onClick }) {
  // 1. Data Safety Checks
  const isDelayed =
    !!s.truckDetails?.delayReason && !s.truckDetails?.delayCleared;
  const loadedCount = s.totals?.loaded || 0;
  const totalCount = s.totals?.totalItems || 0;

  // 2. Extract "Latest Trip" Data
  const tripId = s.truckDetails?.tripId || "—";
  const driverName = s.truckDetails?.driverName || "Unassigned";
  console.log("s: ", s.truckDetails);

  return (
    <div
      // onClick={() => onClick(s.id)}
      className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-800/30 transition-colors cursor-pointer group border-b border-slate-800/50 last:border-0"
    >
      {/* Col 1: ID & Status Pulse */}
      <div className="col-span-4 flex items-center gap-4">
        <StatusDot status={s.status} isDelayed={isDelayed} />
        {/* <StatusBadge status={s.status} reason={s.truckDetails?.delayReason} /> */}

        <div>
          {/* TRIP INFO (The Latest One) */}
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`font-mono text-sm font-medium transition-colors ${
                tripId !== "—" ? "text-blue-400" : "text-slate-600"
              }`}
            >
              {tripId !== "—" && (
                <FontAwesomeIcon icon={faTruck} className="mr-1 text-[10px]" />
              )}
              {tripId}
            </span>
            <span className="text-xs text-slate-500">
              {s.startedAt ? s.startedAt : ""}
            </span>
          </div>

          {/* TRACKING NUMBER */}
          <div className="font-mono text-sm font-medium text-slate-200 group-hover:text-blue-400 transition-colors">
            {s.trackingNumber}
          </div>

          {/* DRIVER & LOAD COUNTS */}
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge
              status={s.status}
              // reason={s.truckDetails?.delayReason}
              size="xs"
            />
            <span className="text-xs text-slate-500 font-mono border-l border-slate-700 pl-2">
              {loadedCount}/{totalCount} Loaded
            </span>
            <span
              className="text-xs text-slate-500 border-l border-slate-700 pl-2 truncate max-w-[120px]"
              title={driverName}
            >
              Driver: {driverName}
            </span>
          </div>
        </div>
      </div>

      {/* Col 2: Route */}
      <div className="col-span-2">
        <div className="text-sm font-medium text-slate-300">
          {s.originCode + "->" + s.destinationCode || "STD-ROUTE"}
        </div>
        <div className="text-xs text-slate-600 font-mono mt-0.5">
          {s.origin + "->" + s.destination || "—"}
        </div>
      </div>

      {/* Col 3: Progress Bar */}
      <div className="col-span-3 pr-4">
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              s.status === "DELIVERED"
                ? "bg-emerald-500"
                : s.truckDetails?.delayReason // <--- CHECK FOR DELAY HERE
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
                ? "text-amber-500" // <--- MATCH TEXT COLOR
                : s.status === "DELIVERED"
                ? "text-emerald-400"
                : "text-blue-400"
            }`}
          >
            {/* If delayed, show specific reason, otherwise standard status */}
            {/* {isDelayed
              ? s.truckDetails?.delayReason
              : s.status?.replace("_", " ")} */}
            {s.status?.replace("_", " ")}
          </span>
          <span className="text-[10px] text-slate-600">{s.progress || 0}%</span>
        </div>
      </div>

      {/* Col 4: Delay/Time */}
      <div className="col-span-2 flex flex-col gap-2">
        <div className="text-xs text-slate-500">
          {/* <span className="block text-slate-600 text-[10px] uppercase font-bold mb-0.5">
            Last Update
          </span> */}
          {s.updatedAt || "Just now"}
        </div>

        {/* Conditional Delay UI */}
        {isDelayed && (
          <div className="w-fit">
            <StatusBadge
              status={s.truckDetails?.status}
              reason={s.truckDetails?.delayReason}
            />
            {/* // Renders: [ AMBER BADGE: ⛈ WEATHER ] */}
          </div>
        )}
      </div>

      {/* Col 5: Actions */}
      <div className="col-span-1 text-right">
        <button
          className="text-slate-500 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-colors"
          // onClick={(e) => {
          //   e.stopPropagation();
          //   // Add custom menu logic here if needed
          // }}
          onClick={() => onClick(s.id)}
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>
    </div>
  );
}
