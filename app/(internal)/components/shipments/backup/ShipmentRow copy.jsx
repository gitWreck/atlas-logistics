import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExclamationTriangle,
  faShip,
  faEllipsisV,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../ui/StatusBadge";
import formatFirestoreDate from "../../../utility/FormatFirestoreDate";

export default function ShipmentRow({ s, onClick }) {
  const isDelayed = !!s.delayReason && !s.delayCleared;
  console.log("Rendering shipment row for:", s);
  const GRID_COLS = "grid-cols-[320px_160px_260px_200px_160px_80px]";

  return (
    <div className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-800/30 transition-colors cursor-pointer group border-b border-slate-800/50 last:border-0">
      {/* Col 1: ID & Pulse */}
      <div className="col-span-4 flex items-center gap-4">
        <StatusDot status={s.status} isDelayed={isDelayed} />
        <div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-sm font-medium text-slate-200 group-hover:text-blue-400 transition-colors">
              TRIP ID: {s.tripId || "Unassigned"}
            </span>
            <span className="text-xs text-slate-500">
              {formatFirestoreDate(s.startedAt)}
            </span>
          </div>
          <div className="font-mono text-sm font-medium text-slate-200 group-hover:text-blue-400 transition-colors">
            {s.trackingNumber}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={s.status} />
            <span className="text-xs text-slate-500">
              Total Loaded: {s.totals["loadedCount"] || 0}
              {/* Total Loaded: {s.loadedCount || 0} */}
            </span>
            <span className="text-xs text-slate-500">
              Driver: {s.driver || "Unassigned"}
            </span>
          </div>
        </div>
      </div>

      {/* Col 2: Route */}
      <div className="col-span-2">
        <div className="text-sm font-medium text-slate-300">{s.route}</div>
        <div className="text-xs text-slate-600 font-mono mt-0.5">
          {s.routeCode}
        </div>
      </div>

      {/* Col 3: Progress */}
      <div className="col-span-3 pr-4">
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              s.status === "DELIVERED" ? "bg-emerald-500" : "bg-blue-500"
            }`}
            style={{ width: `${s.progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-blue-400 font-medium">
            {s.status.replace("_", " ")}
          </span>
          <span className="text-[10px] text-slate-600">{s.progress}%</span>
        </div>
      </div>

      {/* Col 4: Delay/Time */}
      <div className="col-span-2 flex-col items-center gap-3">
        <div className="text-xs text-slate-500">
          <span className="block text-slate-400">Updated</span>
          {s.updatedAt ? formatFirestoreDate(s.updatedAt) : "N/A"}
        </div>
        <div className="mt-2">
          <div className="text-xs text-slate-500">
            <span className="block text-slate-400">Delay Info: </span>
            {isDelayed ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                <FontAwesomeIcon
                  icon={
                    s.delayReason === "WEATHER" ? faExclamationTriangle : faShip
                  }
                />
                {s.delayReason}
              </div>
            ) : (
              <div className="text-xs text-slate-500">-</div>
            )}
          </div>
        </div>
      </div>

      {/* Col 5: Actions */}
      <div className="col-span-1 text-right">
        <button
          onClick={() => onClick(s.id)}
          className="text-slate-500 hover:text-white p-2"
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>
    </div>
  );
}

function StatusDot({ status, isDelayed }) {
  let color = "bg-blue-500";
  if (status === "DELIVERED") color = "bg-emerald-500";
  if (isDelayed) color = "bg-amber-500";

  return (
    <div className="relative flex items-center justify-center w-3 h-3">
      <span
        className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`}
      ></span>
      <span
        className={`relative inline-flex rounded-full h-2 w-2 ${color}`}
      ></span>
    </div>
  );
}
