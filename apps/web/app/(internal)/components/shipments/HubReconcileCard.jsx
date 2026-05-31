"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardCheck } from "@fortawesome/free-solid-svg-icons";
import {
  formatReconcileResult,
  hasReconcileVariance,
  isEligibleForHubReconcile,
} from "@/app/utility/hubReconcile";

export default function HubReconcileCard({
  shipment,
  isDark = false,
  canManage = false,
  onReconcile,
}) {
  if (!shipment) return null;

  const result = formatReconcileResult(shipment);
  const variance = hasReconcileVariance(shipment);
  const eligible = isEligibleForHubReconcile(shipment.status);

  const boxClass = isDark
    ? "border border-slate-800 bg-slate-900/60 rounded-xl p-4"
    : "border border-slate-200 bg-slate-50 rounded-xl p-4";

  return (
    <div className={boxClass}>
      <div className="flex items-start justify-between gap-3">
        <h3
          className={`text-sm font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}
        >
          <FontAwesomeIcon icon={faClipboardCheck} className="text-emerald-500" />
          Odiongan Reconcile
        </h3>
        {canManage && eligible && onReconcile && (
          <button
            type="button"
            onClick={onReconcile}
            className="text-xs font-semibold rounded-lg bg-emerald-600 text-white px-3 py-1.5 hover:bg-emerald-500"
          >
            {result ? "Update" : "Reconcile"}
          </button>
        )}
      </div>

      {result ? (
        <div className="mt-3 space-y-1">
          <p
            className={`text-sm font-semibold ${variance ? "text-amber-500" : "text-emerald-500"}`}
          >
            {result}
            {variance && " — variance detected"}
          </p>
          {shipment.reconciledBy && (
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              By {shipment.reconciledBy}
            </p>
          )}
        </div>
      ) : (
        <p className={`text-xs mt-2 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
          {eligible
            ? "Not reconciled yet. Record expected vs received pieces at Odiongan."
            : "Reconcile is not available for this shipment status."}
        </p>
      )}
    </div>
  );
}
