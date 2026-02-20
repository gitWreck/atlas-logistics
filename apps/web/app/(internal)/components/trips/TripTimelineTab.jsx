import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faPen,
  faTimesCircle,
} from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";
import AssignDriverModal from "../manifests/modals/AssignDriverModal";

// Internal Helper for Info Cards
function InfoCard({ label, value }) {
  return (
    <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800 flex flex-col justify-center min-h-[64px]">
      <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
        {label}
      </div>
      <div
        className="text-slate-300 text-sm font-medium truncate"
        title={value || "—"}
      >
        {value || "—"}
      </div>
    </div>
  );
}

export default function TripTimelineTab({ data, onRefresh }) {
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);

  // --- NEW: Dynamic Steps based on tripType ---
  const isLocal = data.tripType === "LOCAL";

  const STEPS = isLocal
    ? [
        "CREATED",
        "DISPATCHED", // Equivalent to 'Loading/Loaded' for a local van leaving the hub empty
        "IN_TRANSIT", // Actively driving around houses picking things up
        "ARRIVED", // Returned to the Origin Hub
        "COMPLETED", // Items scanned in by warehouse
      ]
    : ["CREATED", "LOADING", "LOADED", "IN_TRANSIT", "ARRIVED", "COMPLETED"];

  const isCancelled = data.status === "CANCELLED";
  const currentStepIndex = isCancelled ? -1 : STEPS.indexOf(data.status);

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
      {/* HEADER WITH EDIT BUTTON */}
      <div className="flex justify-between items-end mb-2">
        <div className="flex flex-col">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Vehicle & Driver
          </h4>
          {/* Show the trip type here for clarity */}
          <span
            className={`text-[10px] font-bold mt-1 uppercase w-max px-1.5 py-0.5 rounded border ${isLocal ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"}`}
          >
            {isLocal ? "Local Pickup Route" : "Warehouse Transfer"}
          </span>
        </div>

        <button
          onClick={() => setIsDriverModalOpen(true)}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-3 py-1.5 rounded transition-colors flex items-center gap-2 border border-slate-700"
        >
          <FontAwesomeIcon icon={faPen} size="sm" />
          <span>Edit</span>
        </button>
      </div>

      {/* 1. KEY INFO GRID */}
      <div className="grid grid-cols-2 gap-3 mb-8 mt-4">
        <InfoCard label="Driver" value={data.driverName} />
        <InfoCard label="Plate Number" value={data.truckPlateNumber} />
        <InfoCard
          label={isLocal ? "Processing Hub" : "Origin"}
          value={data.origin}
        />
        {/* If local, destination is usually N/A or the same hub */}
        <InfoCard
          label={isLocal ? "Route" : "Destination"}
          value={
            isLocal && data.origin === data.destination
              ? "Hub Collection"
              : data.destination
          }
        />
      </div>

      {/* 2. TIMELINE VISUAL */}
      <div className="text-slate-500">
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 pl-1">
          {isLocal ? "Collection Progress" : "Trip Progress"}
        </h3>

        <div className="space-y-0 relative pl-4 border-l-2 border-slate-800 ml-2">
          {/* 1. SPECIAL 'CANCELLED' INDICATOR (Only shows if cancelled) */}
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

          {/* 2. STANDARD TIMELINE LOOP */}
          {!isCancelled &&
            STEPS.map((step, idx) => {
              // Logic: Is this step finished?
              const isDone = currentStepIndex >= idx;

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
                    className={`-mt-1.5 ml-2 transition-opacity duration-500 ${
                      isDone || isCurrent ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    <p
                      className={`text-sm font-bold ${
                        isDone || isCurrent ? "text-white" : "text-slate-400"
                      }`}
                    >
                      {step.replace(/_/g, " ")}
                    </p>

                    {/* Show Timestamp only for the Current Active Step */}
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

      {/* 4. RENDER THE MODAL */}
      <AssignDriverModal
        isOpen={isDriverModalOpen}
        onClose={() => setIsDriverModalOpen(false)}
        trip={data}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}
