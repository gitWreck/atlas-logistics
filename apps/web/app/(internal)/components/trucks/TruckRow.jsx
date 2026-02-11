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

export default function TruckRow({ truck: t, onEdit }) {
  // PMS Logic: Calculate percentage of health remaining
  // Assuming 5000km is the service interval
  const serviceInterval = 5000;
  const currentOdo = Number(t.lastPmsOdometer) || 0;
  // This is a simplified mock; ideally, you compare current actual ODO vs last service ODO
  const pmsProgress = Math.min(
    Math.max(((serviceInterval - (t.nextPMS || 0)) / serviceInterval) * 100, 0),
    100,
  );
  const isCritical = (t.nextPMS || 0) <= 500;

  return (
    <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-800/30 transition-colors cursor-pointer group border-b border-slate-800/50 last:border-0">
      {/* Col 1: Plate & Status Pulse */}
      <div className="col-span-4 flex items-center gap-4">
        <StatusDot status={t.status} />

        <div>
          <div className="font-mono text-sm font-medium text-slate-200 group-hover:text-blue-400 transition-colors uppercase">
            {t.plateNumber}
          </div>

          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
              {t.model}
            </span>
            <span className="text-xs text-slate-600 font-mono border-l border-slate-700 pl-2">
              {t.type}
            </span>
          </div>
        </div>
      </div>

      {/* Col 2: Status Badge */}
      <div className="col-span-2">
        <StatusBadge status={t.status} size="xs" />
        {/* {t.currentTrip && (
          <div className="text-[10px] text-blue-500 font-mono mt-1 flex items-center gap-1">
            <FontAwesomeIcon icon={faTruck} className="text-[8px]" />
            {t.currentTrip}
          </div>
        )} */}
        {/* Show context only if it's not IDLE or DISABLED */}
        {(t.status === "IN_TRANSIT" || t.status === "ASSIGNED") && (
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center gap-1 text-[9px] font-mono text-blue-400 bg-blue-500/5 w-fit px-1.5 py-0.5 rounded border border-blue-500/10">
              <FontAwesomeIcon icon={faRoute} className="text-[8px]" />
              {t.currentTripId || "TRP-XXXX"}
            </div>
            <p className="text-[9px] text-slate-500 italic pl-1">
              ETA: {t.eta || "Pending"}
            </p>
          </div>
        )}
      </div>

      {/* Col 3: PMS Health Bar */}
      <div className="col-span-3 pr-4">
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isCritical ? "bg-red-500" : "bg-blue-500"
            }`}
            style={{ width: `${pmsProgress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span
            className={`text-[10px] font-bold uppercase ${isCritical ? "text-red-500" : "text-slate-500"}`}
          >
            {isCritical ? "Service Required" : "PMS Health"}
          </span>
          <span className="text-[10px] text-slate-600 font-mono">
            {t.lastPmsOdometer} KM
          </span>
        </div>
      </div>

      {/* Col 4: Payload & Expiry */}
      <div className="col-span-2 flex flex-col gap-1">
        <div className="text-xs text-slate-300 flex items-center gap-2">
          <FontAwesomeIcon
            icon={faWeightHanging}
            className="text-[10px] text-slate-500"
          />
          {t.payloadCapacity || t.payload} KG
        </div>
        <div className="text-[10px] text-slate-600 uppercase font-bold">
          Reg: {t.registrationExpiry || "—"}
        </div>
      </div>

      {/* Col 5: Actions */}
      <div className="col-span-1 text-right">
        <button
          className="text-slate-500 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-colors"
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
