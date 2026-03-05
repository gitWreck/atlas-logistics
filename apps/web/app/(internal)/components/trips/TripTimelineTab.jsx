import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faPen,
  faTimesCircle,
} from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";
import AssignDriverModal from "../manifests/modals/AssignDriverModal";

// Helper for info cards with dark/light support
function InfoCard({ label, value, isDark }) {
  return (
    <div
      className={`p-3 rounded-lg border flex flex-col justify-center min-h-[64px] ${
        isDark
          ? "bg-slate-800/30 border-slate-800"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      <div
        className={`text-[10px] uppercase font-bold mb-1 ${
          isDark ? "text-slate-500" : "text-slate-600"
        }`}
      >
        {label}
      </div>
      <div
        className={`text-sm font-medium truncate ${
          isDark ? "text-slate-300" : "text-slate-800"
        }`}
        title={value || "—"}
      >
        {value || "—"}
      </div>
    </div>
  );
}

export default function TripTimelineTab({
  data,
  onRefresh,
  isDark = false,
}) {
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);

  // Dynamic steps based on trip type
  const isLocal = data.tripType === "LOCAL";

  const STEPS = isLocal
    ? [
        "CREATED",
        "DISPATCHED", // Van leaves hub
        "IN_TRANSIT", // Collecting around houses
        "ARRIVED", // Returned to hub
        "COMPLETED", // Items scanned by warehouse
      ]
    : ["CREATED", "LOADING", "LOADED", "IN_TRANSIT", "ARRIVED", "COMPLETED"];

  const isCancelled = data.status === "CANCELLED";
  const currentStepIndex = isCancelled ? -1 : STEPS.indexOf(data.status);

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
      {/* HEADER WITH EDIT BUTTON */}
      <div className="flex justify-between items-end mb-2">
        <div className="flex flex-col">
          <h4
            className={`text-xs font-bold uppercase tracking-wider ${
              isDark ? "text-slate-500" : "text-slate-600"
            }`}
          >
            Vehicle & Driver
          </h4>
          <span
            className={`text-[10px] font-bold mt-1 uppercase w-max px-1.5 py-0.5 rounded border ${
              isLocal
                ? isDark
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  : "bg-amber-100 text-amber-800 border-amber-300"
                : isDark
                  ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                  : "bg-blue-100 text-blue-800 border-blue-300"
            }`}
          >
            {isLocal ? "Local Pickup Route" : "Warehouse Transfer"}
          </span>
        </div>

        <button
          onClick={() => setIsDriverModalOpen(true)}
          className={`text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-2 border ${
            isDark
              ? "bg-slate-800 hover:bg-slate-700 text-blue-400 border-slate-700"
              : "bg-slate-100 hover:bg-slate-200 text-blue-600 border-slate-300"
          }`}
        >
          <FontAwesomeIcon icon={faPen} size="sm" />
          <span>Edit</span>
        </button>
      </div>

      {/* 1. KEY INFO GRID */}
      <div className="grid grid-cols-2 gap-3 mb-8 mt-4">
        <InfoCard
          label="Driver"
          value={data.driverName}
          isDark={isDark}
        />
        <InfoCard
          label="Plate Number"
          value={data.truckPlateNumber}
          isDark={isDark}
        />
        <InfoCard
          label={isLocal ? "Processing Hub" : "Origin"}
          value={data.origin}
          isDark={isDark}
        />
        <InfoCard
          label={isLocal ? "Route" : "Destination"}
          value={
            isLocal && data.origin === data.destination
              ? "Hub Collection"
              : data.destination
          }
          isDark={isDark}
        />
      </div>

      {/* 2. TIMELINE VISUAL */}
      <div className={isDark ? "text-slate-500" : "text-slate-600"}>
        <h3
          className={`text-xs font-bold uppercase mb-4 pl-1 ${
            isDark ? "text-slate-500" : "text-slate-600"
          }`}
        >
          {isLocal ? "Collection Progress" : "Trip Progress"}
        </h3>

        <div
          className={`space-y-0 relative pl-4 border-l-2 ml-2 ${
            isDark ? "border-slate-800" : "border-slate-300"
          }`}
        >
          {/* CANCELLED INDICATOR */}
          {isCancelled && (
            <div className="relative pb-8">
              <div className="absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2 border-red-500 bg-red-600 flex items-center justify-center ring-4 ring-red-900/20">
                <FontAwesomeIcon
                  icon={faTimesCircle}
                  className="text-white text-[8px]"
                />
              </div>
              <div className="-mt-1.5 ml-2">
                <p className="text-sm font-bold text-red-500">CANCELLED</p>
                <p className="text-[10px] text-red-400 mt-0.5">
                  Trip halted • {formatFirestoreDate(data.updatedAt)}
                </p>
              </div>
            </div>
          )}

          {/* STANDARD TIMELINE LOOP */}
          {!isCancelled &&
            STEPS.map((step, idx) => {
              const isDone = currentStepIndex >= idx;
              const isCurrent = data.status === step;

              return (
                <div key={step} className="relative pb-8 last:pb-0">
                  {/* Dot / Indicator */}
                  <div
                    className={`
                      absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-500
                      ${
                        isDone
                          ? "bg-emerald-600 border-emerald-600"
                          : isDark
                            ? "bg-slate-900 border-slate-700"
                            : "bg-slate-300 border-slate-400"
                      }
                      ${
                        isCurrent
                          ? "ring-4 ring-emerald-500/20 scale-110"
                          : ""
                      }
                    `}
                  >
                    {isDone && (
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        className="text-white text-[8px]"
                      />
                    )}
                  </div>

                  {/* Text Content */}
                  <div
                    className={`-mt-1.5 ml-2 transition-opacity duration-500 ${
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
                      <p className="text-[10px] text-emerald-400 mt-0.5 animate-pulse">
                        Current Stage • Updated{" "}
                        {formatFirestoreDate(data.updatedAt)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* 3. ASSIGN DRIVER MODAL */}
      <AssignDriverModal
        isOpen={isDriverModalOpen}
        onClose={() => setIsDriverModalOpen(false)}
        trip={data}
        onSuccess={() => onRefresh?.()}
        isDark={isDark}
      />
    </div>
  );
}