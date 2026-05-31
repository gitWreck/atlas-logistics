"use client";

import React from "react";
import { formatTimelineTimestamp } from "@/app/utility/custodyTimeline";

function DetailLine({ label, value, isDark }) {
  if (!value) return null;
  return (
    <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
      <span className={`font-bold ${isDark ? "text-slate-500" : "text-slate-500"}`}>
        {label}:
      </span>{" "}
      {value}
    </p>
  );
}

function TimelineEventCard({ event, isLast, isDark }) {
  const { time, date } = formatTimelineTimestamp(event.timestamp);
  const truckLabel = event.truckName
    ? `${event.truckName}${event.truckPlate ? ` (${event.truckPlate})` : ""}`
    : event.truckPlate || null;
  const vehicleLabel = event.deliveryVehicleName || event.deliveryVehicleId;

  return (
    <div className="flex gap-4 group">
      <div className="w-24 shrink-0 pt-1">
        <p
          className={`text-[12px] font-mono font-bold leading-none ${
            isDark ? "text-slate-400" : "text-slate-700"
          }`}
        >
          {time}
        </p>
        <p
          className={`text-[11px] font-medium mt-1 opacity-60 ${
            isDark ? "text-slate-500" : "text-slate-500"
          }`}
        >
          {date}
        </p>
      </div>

      <div className="relative flex-1 pb-8 last:pb-0">
        {!isLast && (
          <div
            className={`absolute left-[7px] top-4 bottom-0 w-0.5 ${
              isDark ? "bg-slate-800" : "bg-slate-200"
            }`}
          />
        )}

        <div
          className={`relative p-3 rounded-xl border transition-colors ${
            isDark
              ? "bg-slate-800/20 border-slate-800 group-hover:border-slate-700"
              : "bg-slate-50 border-slate-200 group-hover:border-slate-300"
          }`}
        >
          <div
            className={`absolute -left-[21px] top-3 w-3.5 h-3.5 rounded-full border-2 ${
              isDark
                ? "bg-blue-600 border-blue-500"
                : "bg-blue-600 border-blue-600"
            }`}
          />

          <div className="flex justify-between items-start gap-3 mb-1">
            <p
              className={`text-sm font-bold ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {event.title}
            </p>
            {event.source === "status_history" && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  isDark
                    ? "bg-slate-800 text-slate-500"
                    : "bg-white text-slate-500 border"
                }`}
              >
                Legacy
              </span>
            )}
          </div>

          <DetailLine label="By" value={event.actorName} isDark={isDark} />
          <DetailLine label="Location" value={event.location} isDark={isDark} />
          <DetailLine label="Trip" value={event.tripId} isDark={isDark} />
          <DetailLine label="Truck" value={truckLabel} isDark={isDark} />
          <DetailLine label="Driver" value={event.driverName} isDark={isDark} />
          <DetailLine label="Checker" value={event.checkerName} isDark={isDark} />
          <DetailLine
            label="Manager"
            value={event.warehouseManagerName}
            isDark={isDark}
          />
          <DetailLine label="Vehicle" value={vehicleLabel} isDark={isDark} />
          {event.remarks && (
            <p
              className={`text-xs mt-2 italic leading-relaxed ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}
            >
              "{event.remarks}"
            </p>
          )}

          {event.proofPhotoUrl && (
            <img
              src={event.proofPhotoUrl}
              alt="Proof"
              className="mt-3 w-full max-h-40 object-cover rounded-lg border border-slate-700/30"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustodyTimeline({
  events = [],
  loading = false,
  error = null,
  isDark = false,
  emptyMessage = "No custody events recorded yet.",
}) {
  if (loading) {
    return (
      <div
        className={`text-xs italic text-center p-8 border border-dashed rounded-xl ${
          isDark
            ? "border-slate-800 text-slate-500"
            : "border-slate-200 text-slate-400"
        }`}
      >
        Loading custody timeline...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`text-xs text-center p-8 border border-dashed rounded-xl ${
          isDark
            ? "border-red-900/40 text-red-300"
            : "border-red-200 text-red-600"
        }`}
      >
        Could not load custody timeline.
      </div>
    );
  }

  if (!events.length) {
    return (
      <div
        className={`text-xs italic text-center p-8 border border-dashed rounded-xl ${
          isDark
            ? "border-slate-800 text-slate-600"
            : "border-slate-200 text-slate-400"
        }`}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-0 pl-4">
      {events.map((event, index) => (
        <TimelineEventCard
          key={event.eventId || `${event.eventType}-${index}`}
          event={event}
          isLast={index === events.length - 1}
          isDark={isDark}
        />
      ))}
    </div>
  );
}
