import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";

// Internal Helper for Info Cards
function InfoCard({ label, value }) {
  return (
    <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800">
      <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
        {label}
      </div>
      <div className="text-slate-300 text-sm font-medium truncate">
        {value || "—"}
      </div>
    </div>
  );
}

// Logic to determine active step based on status
function calculateCurrentStep(status) {
  // You can expand this logic if you have more granular sub-statuses
  return status;
}

export default function TripTimelineTab({ data }) {
  // Define the ordered steps of a Trip Lifecycle
  const STEPS = ["CREATED", "LOADING", "LOADED", "IN_TRANSIT", "COMPLETED"];

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
      {/* 1. KEY INFO GRID */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <InfoCard label="Driver" value={data.driverName} />
        <InfoCard label="Plate Number" value={data.truckPlateNumber} />
        <InfoCard label="Origin" value={data.origin} />
        <InfoCard label="Destination" value={data.destination} />
      </div>

      {/* 2. TIMELINE VISUAL */}
      <div className="text-slate-500">
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 pl-1">
          Trip Progress
        </h3>

        <div className="space-y-0 relative pl-4 border-l-2 border-slate-800 ml-2">
          {STEPS.map((step, idx) => {
            // Logic: Is this step finished?
            // (Simple check: if current status index >= step index)
            const currentIdx = STEPS.indexOf(data.status);
            const stepIdx = STEPS.indexOf(step);
            const isDone = currentIdx >= stepIdx;

            // Logic: Is this the specific active step?
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
                        : "bg-slate-900 border-slate-700"
                    }
                    ${isCurrent ? "ring-4 ring-emerald-500/20 scale-110" : ""}
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
                  className={`-mt-1.5 ml-2 transition-opacity duration-500 ${isDone ? "opacity-100" : "opacity-40"}`}
                >
                  <p
                    className={`text-sm font-bold ${
                      isDone ? "text-white" : "text-slate-400"
                    }`}
                  >
                    {step.replace(/_/g, " ")}
                  </p>

                  {/* Show Timestamp only for the Current Step or Completed Steps (if you tracked them individually) */}
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
    </div>
  );
}
