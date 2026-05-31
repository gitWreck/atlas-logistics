"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUndo } from "@fortawesome/free-solid-svg-icons";
import {
  formatReturnSummary,
  isEligibleForReturnReceive,
} from "@/app/utility/returnLoop";

export default function ReturnLoopCard({
  shipment,
  isDark = false,
  canManage = false,
  onReceiveReturned,
}) {
  if (!shipment) return null;

  const summary = formatReturnSummary(shipment);
  const awaitingReceive = isEligibleForReturnReceive(shipment);
  const received = Boolean(shipment.returnReceivedAt);

  const boxClass = isDark
    ? "border border-slate-800 bg-slate-900/60 rounded-xl p-4"
    : "border border-slate-200 bg-slate-50 rounded-xl p-4";

  return (
    <div className={boxClass}>
      <div className="flex items-start justify-between gap-3">
        <h3
          className={`text-sm font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}
        >
          <FontAwesomeIcon icon={faUndo} className="text-violet-500" />
          Return loop
        </h3>
        {canManage && awaitingReceive && onReceiveReturned && (
          <button
            type="button"
            onClick={onReceiveReturned}
            className="text-xs font-semibold rounded-lg bg-violet-600 text-white px-3 py-1.5 hover:bg-violet-500"
          >
            Receive returned
          </button>
        )}
      </div>

      {summary ? (
        <p
          className={`text-xs mt-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}
        >
          {summary}
        </p>
      ) : (
        <p className={`text-xs mt-2 ${isDark ? "text-slate-500" : "text-slate-500"}`}>
          No failed delivery or return on this shipment yet.
        </p>
      )}

      {shipment.currentTripId && (
        <p className={`text-[11px] mt-2 font-mono ${isDark ? "text-slate-400" : "text-slate-600"}`}>
          Trip: {shipment.currentTripId}
        </p>
      )}

      {received && (
        <p className="text-xs mt-2 font-semibold text-emerald-500">
          Ready to re-release to another checker.
        </p>
      )}
    </div>
  );
}
