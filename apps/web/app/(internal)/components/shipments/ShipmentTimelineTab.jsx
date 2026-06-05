"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { InfoCard } from "../ui/InfoCard";
import {
  SHIPMENT_STEPS_HUB_TRANSFER,
  SHIPMENT_STEPS_LOCAL_PICKUP,
} from "@/app/utility/constant/templates";
import { getShipmentTimelinePosition } from "@/app/utility/shipmentTimeline";
import { getPackageStatusLabel } from "@/app/utility/packageStatus";
import { useShipmentCustodyTimeline } from "@/app/(internal)/hooks/useShipmentCustodyTimeline";
import CustodyTimeline from "@/app/(internal)/components/custody/CustodyTimeline";

const ACTIVITY_LOGS_PER_PAGE = 5;

export default function ShipmentTimelineTab({ data, isDark = false }) {
  const shipmentId = data?.id || data?.shipmentId || null;
  const { events, loading, error } = useShipmentCustodyTimeline(
    shipmentId,
    !!shipmentId,
  );

  if (!data) return null;

  const isPickupOrder =
    data.status === "PENDING_PICKUP" ||
    data.status === "PICKED_UP" ||
    (data.statusHistory || []).some((h) => h.status.includes("PICKUP"));

  const STEPS = isPickupOrder
    ? SHIPMENT_STEPS_LOCAL_PICKUP
    : SHIPMENT_STEPS_HUB_TRANSFER;

  const timeline = getShipmentTimelinePosition(data.status, STEPS);
  const currentStepIndex = timeline.index;
  const currentStatusLabel = getPackageStatusLabel(data.status);

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
      <div className="grid grid-cols-2 gap-3 mb-8">
        <InfoCard label="Sender" value={data.sender?.name} isDark={isDark} />
        <InfoCard
          label="Recipient"
          value={data.recipient?.name}
          isDark={isDark}
        />
        <InfoCard
          label="Sender Phone"
          value={data.sender?.phone}
          isDark={isDark}
        />
        <InfoCard
          label="Recipient Phone"
          value={data.recipient?.phone}
          isDark={isDark}
        />
        <InfoCard label="Origin" value={data.origin} isDark={isDark} />
        <InfoCard
          label="Destination"
          value={data.destination}
          isDark={isDark}
        />
      </div>

      <div className={isDark ? "text-slate-500" : "text-slate-600"}>
        <div>
          <h3
            className={`text-xs font-bold uppercase mb-4 pl-1 ${
              isDark ? "text-slate-500" : "text-slate-600"
            }`}
          >
            Status Flow
          </h3>

          <div
            className={`space-y-0 relative pl-4 border-l-2 ml-2 ${
              isDark ? "border-slate-800" : "border-slate-200"
            }`}
          >
            {currentStepIndex < 0 && (
              <p
                className={`text-xs mb-4 ml-2 ${
                  isDark ? "text-amber-400/90" : "text-amber-700"
                }`}
              >
                Status{" "}
                <span className="font-mono font-semibold">{data.status}</span> is
                not mapped on this timeline yet. Badge above shows the live status.
              </p>
            )}

            {STEPS.map((step, idx) => {
              const isDone = currentStepIndex >= 0 && idx < currentStepIndex;
              const isCurrent = currentStepIndex >= 0 && idx === currentStepIndex;

              return (
                <div key={step} className="relative pb-8 last:pb-0">
                  <div
                    className={`
                      absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-300
                      ${
                        isDone
                          ? "bg-blue-600 border-blue-600"
                          : isDark
                            ? "bg-slate-900 border-slate-700"
                            : "bg-slate-100 border-slate-300"
                      }
                      ${isCurrent ? "ring-4 ring-blue-500/20 scale-110" : ""}
                    `}
                  >
                    {isDone && (
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        className="text-white text-[8px]"
                      />
                    )}
                  </div>

                  <div
                    className={`-mt-1.5 ml-2 transition-opacity duration-300 ${
                      isDone || isCurrent ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    <p
                      className={`text-sm font-bold ${
                        isDone || isCurrent
                          ? isDark
                            ? "text-white"
                            : "text-slate-900"
                          : isDark
                            ? "text-slate-400"
                            : "text-slate-500"
                      }`}
                    >
                      {step.replace(/_/g, " ")}
                    </p>

                    {isCurrent && (
                      <p
                        className={`text-[10px] mt-0.5 ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      >
                        Current: {currentStatusLabel}
                        {data.updatedAt ? ` • ${data.updatedAt}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-12 border-t pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h3
          className={`text-xs font-bold uppercase mb-2 tracking-widest pl-1 ${
            isDark ? "text-slate-500" : "text-slate-400"
          }`}
        >
          Scanned Info / Custody Timeline
        </h3>
        <p
          className={`text-xs mb-4 pl-1 ${
            isDark ? "text-slate-500" : "text-slate-500"
          }`}
        >
          Same event history shown on checker mobile Scan Info.
        </p>

        <CustodyTimeline
          events={events}
          loading={loading}
          error={error}
          isDark={isDark}
          emptyMessage="No custody events recorded yet. Release, load, and delivery actions will appear here."
        />
      </div>
    </div>
  );
}
