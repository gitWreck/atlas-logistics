"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faPen,
  faTimesCircle,
} from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";
import AssignDriverModal from "../manifests/modals/AssignDriverModal";
import {
  STEP_HUB_TRANSFER,
  STEP_LOCAL_PICKUP,
} from "@/app/utility/constant/templates";
import { InfoCard } from "../ui/InfoCard";
import { getTimelineThemeClasses } from "@/app/utility/constant/theme";
import { getTimelineActionClasses } from "@/app/utility/constant/action";

export default function TripTimelineTab({ data, onRefresh, isDark = false }) {
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);

  const theme = getTimelineThemeClasses(isDark);
  const action = getTimelineActionClasses(isDark);

  const isLocal = data.tripType === "LOCAL_PICKUP";
  const steps = isLocal ? STEP_LOCAL_PICKUP : STEP_HUB_TRANSFER;

  const isCancelled = data.status === "CANCELLED";
  const currentStepIndex = isCancelled ? -1 : steps.indexOf(data.status);

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
      {/* Header */}
      <div className="flex justify-between items-end mb-2">
        <div className="flex flex-col">
          <h4
            className={`text-xs font-bold uppercase tracking-wider ${theme.sectionLabel}`}
          >
            Vehicle & Driver
          </h4>

          <span
            className={`text-[10px] font-bold mt-1 uppercase w-max px-1.5 py-0.5 rounded border ${
              isLocal ? action.localBadge : action.transferBadge
            }`}
          >
            {isLocal ? "Local Pickup" : "Hub Transfer"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsDriverModalOpen(true)}
          className={`text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-2 border ${action.editButton}`}
        >
          <FontAwesomeIcon icon={faPen} size="sm" />
          <span>Edit</span>
        </button>
      </div>

      {/* Info Grid */}
      <div className={theme.infoCardGrid}>
        <InfoCard label="Driver" value={data.driverName} isDark={isDark} />
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

      {/* Timeline */}
      <div className={theme.mutedText}>
        <h3
          className={`text-xs font-bold uppercase mb-4 pl-1 ${theme.sectionLabel}`}
        >
          {isLocal ? "Collection Progress" : "Trip Progress"}
        </h3>

        <div
          className={`space-y-0 relative pl-4 border-l-2 ml-2 ${theme.rail}`}
        >
          {isCancelled && (
            <div className="relative pb-8">
              <div
                className={`absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${action.cancelledDot}`}
              >
                <FontAwesomeIcon
                  icon={faTimesCircle}
                  className="text-white text-[8px]"
                />
              </div>

              <div className="-mt-1.5 ml-2">
                <p className={`text-sm font-bold ${action.cancelledTitle}`}>
                  CANCELLED
                </p>
                <p className={`text-[10px] mt-0.5 ${action.cancelledMeta}`}>
                  Trip halted • {formatFirestoreDate(data.updatedAt)}
                </p>
              </div>
            </div>
          )}

          {!isCancelled &&
            steps.map((step, idx) => {
              const isDone = currentStepIndex >= idx;
              const isCurrent = data.status === step;

              return (
                <div key={step} className="relative pb-8 last:pb-0">
                  <div
                    className={`absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                      isDone ? action.doneDot : theme.pendingDot
                    } ${isCurrent ? action.currentRing : ""}`}
                  >
                    {isDone && (
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        className="text-white text-[8px]"
                      />
                    )}
                  </div>

                  <div
                    className={`-mt-1.5 ml-2 transition-opacity duration-500 ${
                      isDone || isCurrent ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    <p
                      className={`text-sm font-bold ${
                        isDone || isCurrent ? theme.title : theme.fadedText
                      }`}
                    >
                      {step.replace(/_/g, " ")}
                    </p>

                    {isCurrent && (
                      <p className={action.currentMeta}>
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
