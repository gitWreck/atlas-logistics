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

const ACTIVITY_LOGS_PER_PAGE = 5;

export default function ShipmentTimelineTab({ data, isDark = false }) {
  const [activityPage, setActivityPage] = useState(1);

  const activityLogs = useMemo(
    () => [...(data?.statusHistory || [])].reverse(),
    [data?.statusHistory],
  );

  const totalActivityPages = Math.max(
    1,
    Math.ceil(activityLogs.length / ACTIVITY_LOGS_PER_PAGE),
  );
  const safeActivityPage = Math.min(activityPage, totalActivityPages);
  const activityStartIndex =
    (safeActivityPage - 1) * ACTIVITY_LOGS_PER_PAGE;
  const visibleActivityLogs = activityLogs.slice(
    activityStartIndex,
    activityStartIndex + ACTIVITY_LOGS_PER_PAGE,
  );

  useEffect(() => {
    setActivityPage(1);
  }, [data?.id, activityLogs.length]);

  useEffect(() => {
    setActivityPage((page) => Math.min(page, totalActivityPages));
  }, [totalActivityPages]);

  if (!data) return null;

  const isPickupOrder =
    data.status === "PENDING_PICKUP" ||
    data.status === "PICKED_UP" ||
    (data.statusHistory || []).some((h) => h.status.includes("PICKUP"));

  const STEPS = isPickupOrder
    ? SHIPMENT_STEPS_LOCAL_PICKUP
    : SHIPMENT_STEPS_HUB_TRANSFER;

  const currentStepIndex = STEPS.indexOf(data.status);

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
            {STEPS.map((step, idx) => {
              const isDone = currentStepIndex >= idx;
              const isCurrent = data.status === step;

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
                        Current Stage • {data.updatedAt}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* STATUS HISTORY LOG */}
      <div className="mt-12 border-t pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h3
          className={`text-xs font-bold uppercase mb-4 tracking-widest pl-1 ${
            isDark ? "text-slate-500" : "text-slate-400"
          }`}
        >
          Detailed Activity Log
        </h3>

        <div className="space-y-4">
          {activityLogs.length > 0 ? (
            visibleActivityLogs.map((log, idx) => (
              <div key={activityStartIndex + idx} className="flex gap-4 group">
                <div className="w-24 shrink-0 pt-1">
                  <p
                    className={`text-[12px] font-mono font-bold leading-none ${
                      isDark ? "text-slate-400" : "text-slate-700"
                    }`}
                  >
                    {log.at?._seconds
                      ? new Date(log.at._seconds * 1000).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )
                      : "—"}
                  </p>
                  <p
                    className={`text-[11px] font-medium mt-1 opacity-60 ${
                      isDark ? "text-slate-500" : "text-slate-500"
                    }`}
                  >
                    {log.at?._seconds
                      ? new Date(log.at._seconds * 1000).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                          },
                        )
                      : "—"}
                  </p>
                </div>

                <div
                  className={`flex-1 p-3 rounded-xl border transition-colors ${
                    isDark
                      ? "bg-slate-800/20 border-slate-800 group-hover:border-slate-700"
                      : "bg-slate-50 border-slate-200 group-hover:border-slate-300"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                        isDark
                          ? "bg-slate-800 text-slate-400"
                          : "bg-white text-slate-600 border"
                      }`}
                    >
                      {log.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  {log.note && (
                    <p
                      className={`text-xs mt-2 italic leading-relaxed ${
                        isDark ? "text-slate-400" : "text-slate-600"
                      }`}
                    >
                      "{log.note}"
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div
              className={`text-xs italic text-center p-8 border border-dashed rounded-xl ${
                isDark
                  ? "border-slate-800 text-slate-600"
                  : "border-slate-200 text-slate-400"
              }`}
            >
              No detailed logs available for this shipment yet.
            </div>
          )}
        </div>

        {totalActivityPages > 1 && (
          <div
            className={`mt-5 px-4 py-3 border rounded-xl flex flex-col sm:flex-row justify-between items-center gap-3 text-xs ${
              isDark
                ? "bg-slate-900/40 border-slate-800 text-slate-500"
                : "bg-slate-50 border-slate-200 text-slate-500"
            }`}
          >
            <span>
              Showing{" "}
              <span
                className={`font-bold ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                {activityStartIndex + 1}
              </span>
              -
              <span
                className={`font-bold ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                {Math.min(
                  activityStartIndex + ACTIVITY_LOGS_PER_PAGE,
                  activityLogs.length,
                )}
              </span>{" "}
              of {activityLogs.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setActivityPage((page) => Math.max(1, page - 1))
                }
                disabled={safeActivityPage === 1}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  isDark
                    ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                    : "border-slate-200 text-slate-600 hover:bg-white"
                }`}
                aria-label="Previous activity log page"
              >
                <FontAwesomeIcon icon={faChevronLeft} size="xs" />
              </button>

              <div
                className={`flex items-center px-3 h-8 border rounded-lg text-xs font-bold ${
                  isDark
                    ? "bg-slate-950 border-slate-700 text-slate-300"
                    : "bg-white border-slate-200 text-slate-700"
                }`}
              >
                Page {safeActivityPage} of {totalActivityPages}
              </div>

              <button
                type="button"
                onClick={() =>
                  setActivityPage((page) =>
                    Math.min(totalActivityPages, page + 1),
                  )
                }
                disabled={safeActivityPage === totalActivityPages}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  isDark
                    ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                    : "border-slate-200 text-slate-600 hover:bg-white"
                }`}
                aria-label="Next activity log page"
              >
                <FontAwesomeIcon icon={faChevronRight} size="xs" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
