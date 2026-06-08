"use client";

import React, { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBox,
  faWarehouse,
  faBarcode,
  faCircleCheck,
} from "@fortawesome/free-solid-svg-icons";
import { aggregateTripLoadSummary } from "@/app/utility/tripStats";

function SummaryCard({ label, value, subtext, icon, accent, isDark }) {
  const cardClass = isDark
    ? "rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
    : "rounded-2xl border border-slate-200 bg-white p-4";

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}
          >
            {label}
          </div>
          <div
            className={`mt-1 text-2xl font-bold leading-none ${isDark ? "text-white" : "text-slate-900"}`}
          >
            {value}
          </div>
          {subtext ? (
            <p
              className={`mt-2 text-[11px] leading-snug ${isDark ? "text-slate-400" : "text-slate-600"}`}
            >
              {subtext}
            </p>
          ) : null}
        </div>
        <div
          className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${accent.iconWrap}`}
        >
          <FontAwesomeIcon icon={icon} className={accent.icon} />
        </div>
      </div>
    </div>
  );
}

export default function TripLoadSummary({ trip = null, shipments = [], isDark = false }) {
  const stats = useMemo(
    () => aggregateTripLoadSummary(trip, shipments),
    [trip, shipments],
  );

  if (!stats.trackingNumbers && stats.loadedPackages <= 0) return null;

  const sectionLabel = isDark ? "text-slate-400" : "text-slate-500";
  const bannerClass = isDark
    ? "rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3"
    : "rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3";

  const accents = {
    loaded: {
      iconWrap: isDark ? "bg-blue-500/15" : "bg-blue-50",
      icon: isDark ? "text-blue-300" : "text-blue-600",
    },
    remaining: {
      iconWrap: isDark ? "bg-amber-500/15" : "bg-amber-50",
      icon: isDark ? "text-amber-300" : "text-amber-600",
    },
    tracking: {
      iconWrap: isDark ? "bg-violet-500/15" : "bg-violet-50",
      icon: isDark ? "text-violet-300" : "text-violet-600",
    },
    status: {
      iconWrap: isDark ? "bg-emerald-500/15" : "bg-emerald-50",
      icon: isDark ? "text-emerald-300" : "text-emerald-600",
    },
  };

  return (
    <div className="space-y-3">
      <h3 className={`text-xs font-bold uppercase tracking-wider ${sectionLabel}`}>
        Trip Load Summary
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryCard
          label="Packages Loaded"
          value={stats.loadedPackages}
          subtext="Pieces scanned and loaded on this trip"
          icon={faBox}
          accent={accents.loaded}
          isDark={isDark}
        />
        <SummaryCard
          label="Remaining in Warehouse"
          value={stats.remainingInWarehouse}
          subtext="Pieces to be assigned to a future trip"
          icon={faWarehouse}
          accent={accents.remaining}
          isDark={isDark}
        />
        <SummaryCard
          label="Tracking Numbers"
          value={stats.trackingNumbers}
          subtext="Shipments represented in this trip"
          icon={faBarcode}
          accent={accents.tracking}
          isDark={isDark}
        />
        <SummaryCard
          label="Trip Status"
          value={stats.tripStatus.replaceAll("_", " ")}
          subtext={stats.statusHint}
          icon={faCircleCheck}
          accent={accents.status}
          isDark={isDark}
        />
      </div>

      <div
        className={`${bannerClass} flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between`}
      >
        <p
          className={`text-sm font-semibold ${isDark ? "text-blue-300" : "text-blue-700"}`}
        >
          {stats.loadedSummaryLine}
        </p>
        {stats.remainingSummaryLine ? (
          <p
            className={`text-sm font-semibold ${isDark ? "text-amber-300" : "text-amber-700"}`}
          >
            {stats.remainingSummaryLine}
          </p>
        ) : null}
      </div>
    </div>
  );
}
