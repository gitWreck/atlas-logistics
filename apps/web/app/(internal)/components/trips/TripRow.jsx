"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisV,
  faTruck,
  faTruckPickup,
} from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";
import { getRowThemeClasses } from "@/app/utility/constant/theme";

function StatusDot({ status, isDelayed }) {
  let color = "bg-blue-500";
  let animate = false;

  if (status === "COMPLETED") color = "bg-emerald-500";
  if (status === "CREATED") color = "bg-slate-600";
  if (status === "IN_TRANSIT") {
    color = "bg-blue-500";
    animate = true;
  }
  if (isDelayed) {
    color = "bg-amber-500";
    animate = true;
  }

  return (
    <div className="relative flex items-center justify-center w-3 h-3 flex-shrink-0">
      {animate && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </div>
  );
}

export default function TripRow({ trip, onClick, isDark = false }) {
  const theme = getRowThemeClasses(isDark);

  const isDelayed = !!trip.delayReason && !trip.delayCleared;
  const loadedCount = trip.totalLoaded || 0;
  const totalCount = trip.totalItems || 0;
  const driverName = trip.driverName || "Unassigned";
  const isLocal = trip.tripType === "LOCAL_PICKUP";

  const tripIdTextClass = isDelayed
    ? theme.tripIdTextDelayed
    : theme.tripIdTextDefault;

  const rowStateClass = isDelayed ? theme.rowDelayed : theme.rowDefaultHover;

  const typeBadgeClass = isLocal
    ? theme.typeBadgeLocal
    : theme.typeBadgeTransfer;

  const progressBarClass =
    trip.status === "COMPLETED"
      ? theme.progressEmerald
      : isDelayed
        ? theme.progressAmber
        : theme.progressBlue;

  const statusTextClass = isDelayed
    ? theme.statusTextDelayed
    : trip.status === "COMPLETED"
      ? theme.statusTextCompleted
      : theme.statusTextDefault;

  const statusLabel = isDelayed
    ? trip.delayReason?.replaceAll("_", " ") || "DELAYED"
    : trip.status?.replaceAll("_", " ");

  return (
    <div
      className={`relative flex flex-col gap-3 p-4 border-b cursor-pointer transition-colors group md:grid md:grid-cols-12 md:gap-4 md:px-6 md:items-center ${theme.rowBorder} ${rowStateClass}`}
    >
      {/* Mobile Header */}
      <div className="flex md:hidden justify-between items-start mb-2">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <StatusDot status={trip.status} isDelayed={isDelayed} />
          </div>

          <div className="flex flex-col items-start gap-0.5 mt-1">
            <span
              className={`text-[8px] tracking-wider font-bold px-1.5 py-[1px] rounded border w-max ${typeBadgeClass}`}
            >
              {isLocal ? "LOCAL PICKUP" : "HUB TRANSFER"}
            </span>

            <span
              className={`font-mono text-sm font-bold transition-colors flex items-center gap-2 ${tripIdTextClass}`}
            >
              <FontAwesomeIcon
                icon={isLocal ? faTruckPickup : faTruck}
                className="text-[10px]"
              />
              {trip.tripId}
            </span>

            <div className={`text-[10px] ${theme.mutedText}`}>
              {formatFirestoreDate(trip.updatedAt)}
            </div>
          </div>
        </div>

        <button
          type="button"
          className={`p-2 -mr-2 rounded ${theme.actionButton}`}
          onClick={(e) => {
            e.stopPropagation();
            onClick(trip.id);
          }}
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>

      {/* Col 1 */}
      <div className="md:col-span-3 flex items-center gap-4">
        <div className="hidden md:block">
          <StatusDot status={trip.status} isDelayed={isDelayed} />
        </div>

        <div className="w-full">
          <div className="hidden md:flex flex-col items-start gap-2 mt-1">
            <div className="flex items-center gap-2">
              <span
                className={`font-mono text-sm font-bold transition-colors flex items-center gap-2 ${tripIdTextClass}`}
              >
                <FontAwesomeIcon
                  icon={isLocal ? faTruckPickup : faTruck}
                  className="text-[10px]"
                />
                {trip.tripId}
              </span>
            </div>
          </div>

          <div
            className={`text-xs md:mt-1 flex items-center justify-between md:justify-start gap-2 w-full ${theme.mutedText}`}
          >
            <div className="flex items-center gap-2">
              <span className={`font-medium ${theme.secondaryText}`}>
                {driverName}
              </span>
              <span className={theme.subtleText}>•</span>
              <span className={`font-mono ${theme.mutedText}`}>
                {trip.truckPlateNumber || "No Plate"}
              </span>
            </div>

            <span
              className={`md:hidden font-mono text-[10px] ${theme.mutedText}`}
            >
              {loadedCount}/{totalCount} Items
            </span>
          </div>
        </div>
      </div>

      {/* Col 2 */}
      <div
        className={`md:col-span-2 flex justify-between md:block items-center border-t md:border-0 pt-2 md:pt-0 ${theme.rowBorder}`}
      >
        <div
          className={`text-sm font-medium flex items-center gap-2 ${theme.secondaryText}`}
        >
          {trip.originCode}
          <span className={theme.routeArrow}>{isLocal ? "↻" : "→"}</span>
          {isLocal && trip.originCode === trip.destinationCode
            ? "HUB TRANSFER"
            : trip.destinationCode}
        </div>

        <div
          className={`text-[10px] font-mono md:mt-0.5 truncate max-w-[150px] md:max-w-[120px] ${theme.mutedText}`}
          title={trip.route}
        >
          {isLocal ? "LOCAL PICKUP" : `${trip.origin} → ${trip.destination}`}
        </div>

        <span
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${typeBadgeClass}`}
        >
          {isLocal ? "LOCAL PICKUP" : "HUB TRANSFER"}
        </span>
      </div>

      {/* Col 3 */}
      <div className="hidden md:block col-span-1 pr-4">
        <span
          className={`text-[14px] font-mono border-l pl-2 ${theme.statsDivider}`}
        >
          {loadedCount}/{totalCount} Loaded
        </span>
      </div>

      {/* Col 4 */}
      <div className="md:col-span-3 md:pr-4 w-full">
        <div
          className={`hidden md:flex justify-between text-[10px] mb-1 ${theme.mutedText}`}
        >
          <span>{trip.progress}%</span>
        </div>

        <div
          className={`h-1.5 w-full rounded-full overflow-hidden mt-1 md:mt-0 ${theme.progressTrack}`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressBarClass}`}
            style={{ width: `${trip.progress}%` }}
          />
        </div>

        <div className="mt-1.5 gap-2 flex">
          {isDelayed && (
            <span
              className={`text-[14px] px-1.5 rounded animate-pulse font-bold ${theme.delayedPill}`}
            >
              DELAYED
            </span>
          )}

          <span
            className={`text-[12px] font-bold uppercase tracking-wide ${statusTextClass}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Col 5 */}
      <div className="hidden md:flex col-span-2 flex-col gap-1">
        <div
          className={`text-[14px] flex items-center gap-1.5 ${theme.mutedText}`}
        >
          {formatFirestoreDate(trip.updatedAt)}
        </div>

        {trip.status !== "COMPLETED" && trip.estimatedArrival && (
          <div className={`text-xs ${theme.subtleText}`}>
            ETA: {new Date(trip.estimatedArrival).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Col 6 */}
      <div className="hidden md:block col-span-1 text-right">
        <button
          type="button"
          className={`p-2 rounded-full transition-colors ${theme.actionButton}`}
          onClick={(e) => {
            e.stopPropagation();
            onClick(trip.id);
          }}
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>
    </div>
  );
}
