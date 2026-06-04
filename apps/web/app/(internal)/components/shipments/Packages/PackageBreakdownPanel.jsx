"use client";

import React from "react";
import {
  getActiveBreakdownRows,
  resolveShipmentPackageBreakdown,
} from "@/app/utility/packageStatus";

export default function PackageBreakdownPanel({
  shipment = {},
  isDark = false,
  className = "",
}) {
  const breakdown = resolveShipmentPackageBreakdown(shipment);
  const rows = getActiveBreakdownRows(breakdown);

  if (!breakdown.total) return null;

  const theme = isDark
    ? {
        panel: "border-slate-700 bg-slate-900/40",
        label: "text-slate-500",
        value: "text-slate-100",
        total: "text-slate-300",
      }
    : {
        panel: "border-slate-200 bg-slate-50",
        label: "text-slate-500",
        value: "text-slate-900",
        total: "text-slate-700",
      };

  return (
    <div className={`border rounded-xl p-4 ${theme.panel} ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className={`text-[10px] font-bold uppercase ${theme.label}`}>
          Package locations
        </div>
        <div className={`text-xs font-bold ${theme.total}`}>
          {breakdown.total} total
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={`text-xs ${theme.label}`}>No location data yet.</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className={theme.label}>{row.label}</span>
              <span className={`font-bold tabular-nums ${theme.value}`}>
                {row.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
