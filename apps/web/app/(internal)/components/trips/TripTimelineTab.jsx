"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faPenToSquare,
  faTimesCircle,
  faTruck,
} from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";
import TripAssignmentModal from "./modals/TripAssignmentModal";
import EditTripDetailsModal from "./modals/EditTripDetailsModal";
import {
  STEP_HUB_TRANSFER,
  STEP_HUB_MANIFEST,
  STEP_LOCAL_PICKUP,
} from "@/app/utility/constant/templates";
import { InfoCard } from "../ui/InfoCard";
import StatusBadge from "../ui/StatusBadge";
import { getTimelineThemeClasses } from "@/app/utility/constant/theme";
import { getTimelineActionClasses } from "@/app/utility/constant/action";
import {
  getManifestStatusLabel,
  resolveManifestStatus,
} from "@/app/utility/manifestStatus";
import { resolveHubTripTimelineStep } from "@/app/utility/tripStats";

function formatStepLabel(step) {
  if (step === "AWAITING_LOADING") return "Awaiting Loading";
  return String(step || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function TripTimelineTab({
  data,
  onRefresh,
  isDark = false,
  user,
  profile,
}) {
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const theme = getTimelineThemeClasses(isDark);
  const action = getTimelineActionClasses(isDark);

  const isLocal = data.tripType === "LOCAL_PICKUP";
  const isHubTransfer =
    String(data.tripType || "HUB_TRANSFER").toUpperCase() === "HUB_TRANSFER";
  const steps = isLocal ? STEP_LOCAL_PICKUP : STEP_HUB_TRANSFER;
  const isAdmin = String(profile?.role || "").toLowerCase() === "admin";

  const isCancelled = data.status === "CANCELLED";
  const timelineStep = isLocal
    ? data.status
    : resolveHubTripTimelineStep(data);
  const currentStepIndex = isCancelled ? -1 : steps.indexOf(timelineStep);

  const manifestStatus = resolveManifestStatus(data);
  const manifestStepIndex = STEP_HUB_MANIFEST.indexOf(manifestStatus);

  const manifestTimestamp =
    manifestStatus === "RECONCILED"
      ? data.reconciledAt
      : manifestStatus === "RECEIVING_IN_PROGRESS"
        ? data.receivingStartedAt
        : manifestStatus === "LOCKED"
          ? data.manifestGeneratedAt
          : data.createdAt;

  const renderTimelineSteps = (stepList, { activeStatus, activeIndex }) =>
    stepList.map((step, idx) => {
      const isDone =
        activeStatus === "COMPLETED" ? idx <= activeIndex : activeIndex > idx;
      const isCurrent =
        activeStatus === step ||
        (activeStatus === "UNLOADING" && step === "ARRIVED");

      return (
        <div key={step} className="relative pb-8 last:pb-0">
          <div
            className={`absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
              isDone || isCurrent ? action.doneDot : theme.pendingDot
            } ${isCurrent ? action.currentRing : ""}`}
          >
            {(isDone || isCurrent) && (
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
              {formatStepLabel(step)}
            </p>

            {isCurrent && (
              <p className={action.currentMeta}>
                Current stage • Updated {formatFirestoreDate(data.updatedAt)}
              </p>
            )}
          </div>
        </div>
      );
    });

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDriverModalOpen(true)}
            className={`text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-2 border ${action.editButton}`}
          >
            <FontAwesomeIcon icon={faTruck} size="sm" />
            <span>Edit</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsDetailsModalOpen(true)}
              className={`text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-2 border ${action.editButton}`}
            >
              <FontAwesomeIcon icon={faPenToSquare} size="sm" />
              <span>Details</span>
            </button>
          )}
        </div>
      </div>

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

          {!isCancelled && renderTimelineSteps(steps, {
            activeStatus: timelineStep,
            activeIndex: currentStepIndex,
          })}
        </div>

        {isHubTransfer && !isCancelled && (
          <div className="mt-8">
            <div className="flex items-center justify-between gap-2 mb-4 pl-1">
              <h3
                className={`text-xs font-bold uppercase ${theme.sectionLabel}`}
              >
                Manifest Progress
              </h3>
              <StatusBadge status={manifestStatus} isDark={isDark} />
            </div>

            <div
              className={`space-y-0 relative pl-4 border-l-2 ml-2 ${theme.rail}`}
            >
              {STEP_HUB_MANIFEST.map((step, idx) => {
                const isDone = manifestStepIndex > idx;
                const isCurrent = manifestStepIndex === idx;

                return (
                  <div key={step} className="relative pb-6 last:pb-0">
                    <div
                      className={`absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                        isDone || isCurrent ? action.doneDot : theme.pendingDot
                      } ${isCurrent ? action.currentRing : ""}`}
                    >
                      {(isDone || isCurrent) && (
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
                        {getManifestStatusLabel(step)}
                      </p>

                      {isCurrent && (
                        <p className={action.currentMeta}>
                          Current manifest stage •{" "}
                          {formatFirestoreDate(manifestTimestamp || data.updatedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <TripAssignmentModal
        isOpen={isDriverModalOpen}
        onClose={() => setIsDriverModalOpen(false)}
        trip={data}
        onSuccess={() => onRefresh?.()}
        isDark={isDark}
        user={user}
        profile={profile}
      />

      <EditTripDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        trip={data}
        onSuccess={() => onRefresh?.()}
        isDark={isDark}
        profile={profile}
      />
    </div>
  );
}
