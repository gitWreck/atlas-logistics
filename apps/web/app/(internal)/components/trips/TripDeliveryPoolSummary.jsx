"use client";

import React, { useMemo } from "react";
import {
  aggregateTripDeliveryPool,
  formatTripDeliveryPoolLine,
} from "@/app/utility/tripDeliveryPoolCounts";

export default function TripDeliveryPoolSummary({
  shipments = [],
  isDark = false,
}) {
  const stats = useMemo(
    () => aggregateTripDeliveryPool(shipments),
    [shipments],
  );

  if (!stats.total) return null;

  const boxClass = isDark
    ? "mb-4 rounded-xl border border-indigo-800/60 bg-indigo-950/40 px-4 py-3"
    : "mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3";

  return (
    <div className={boxClass}>
      <p
        className={`text-xs font-bold uppercase tracking-wide ${isDark ? "text-indigo-300" : "text-indigo-800"}`}
      >
        Last-mile piece pool (this trip)
      </p>
      <p
        className={`mt-1 text-sm font-semibold ${isDark ? "text-white" : "text-indigo-950"}`}
      >
        {formatTripDeliveryPoolLine(stats)}
      </p>
      <p
        className={`mt-1 text-xs ${isDark ? "text-indigo-200/80" : "text-indigo-700"}`}
      >
        {stats.total} pieces across {shipments.length} shipment
        {shipments.length === 1 ? "" : "s"} — warehouse custody until load
        scan.
      </p>
    </div>
  );
}
