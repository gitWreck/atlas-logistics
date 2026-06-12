"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBox,
  faLock,
  faTruck,
  faTruckPickup,
} from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";
import {
  getTripBoardStatusLabel,
  getTripStatsDisplay,
} from "@/app/utility/tripStats";
import { getRowThemeClasses } from "@/app/utility/constant/theme";
import StatusDot from "../ui/StatusDot";
import ManifestStatusBadge from "../ui/ManifestStatusBadge";
import TripLifecycleMenu from "./TripLifecycleMenu";

export default function TripRow({
  trip,
  onClick,
  onDeleted,
  profile,
  isDark = false,
}) {
  const theme = getRowThemeClasses(isDark);

  const normalizedStatus = String(trip.status || "").toUpperCase();
  const isCompleted = ["COMPLETED", "DELIVERED"].includes(normalizedStatus);
  const isDelayed = !!trip.delayReason && !trip.delayCleared;
  const isManifestLocked = !!trip.manifestLocked;
  const tripStats = getTripStatsDisplay(trip);
  const statsCount = tripStats.count;
  const totalCount = tripStats.total;
  const statsLabel = tripStats.label;
  const statsSubLabel = tripStats.subLabel;
  const driverName = trip.driverName || "Unassigned";

  const tripType = String(trip.tripType || "HUB_TRANSFER").toUpperCase();
  const isLocal = tripType === "LOCAL_PICKUP";
  const isDelivery = tripType === "DELIVERY";
  const isHubTransfer = tripType === "HUB_TRANSFER";

  const tripIdTextClass = isDelayed
    ? theme.tripIdTextDelayed
    : theme.tripIdTextDefault;

  const rowStateClass = isDelayed ? theme.rowDelayed : theme.rowDefaultHover;
  const mobileDividerClass = isDark
    ? "border-b-4 border-b-slate-700/80 md:border-b md:border-b-slate-800/50"
    : "border-b-4 border-b-slate-300 md:border-b md:border-b-slate-200";

  const typeBadgeClass = isDelivery
    ? theme.typeBadgeDelivery || theme.typeBadgeTransfer
    : isLocal
      ? theme.typeBadgeLocal
      : theme.typeBadgeTransfer;
  const lockedBadgeClass =
    "bg-emerald-600/20 text-emerald-400 border-emerald-500/30";

  const progressBarClass = isCompleted
    ? theme.progressEmerald
    : isDelayed
      ? theme.progressAmber
      : theme.progressBlue;

  const statusTextClass = isDelayed
    ? theme.statusTextDelayed
    : isCompleted
      ? theme.statusTextCompleted
      : theme.statusTextDefault;

  const boardStatusLabel = getTripBoardStatusLabel(trip);
  const statusLabel = isDelayed
    ? trip.delayReason?.replaceAll("_", " ") || "DELAYED"
    : boardStatusLabel?.replaceAll("_", " ");

  const tripTypeLabel = isDelivery ? "DEL" : isLocal ? "PKP" : "HUB";

  const tripTypeFullLabel = isDelivery
    ? "DELIVERY"
    : isLocal
      ? "LOCAL PICKUP"
      : "HUB TRANSFER";

  const tripIcon = isDelivery ? faBox : isLocal ? faTruckPickup : faTruck;

  const routeArrow = isLocal ? "↻" : "→";

  const routeCodeText = isDelivery
    ? trip.destinationCode || "DELIVERY"
    : isLocal && trip.originCode === trip.destinationCode
      ? "LOCAL"
      : trip.destinationCode;

  const routeText = isDelivery
    ? trip.destination || "Delivery"
    : isLocal
      ? "LOCAL PICKUP"
      : `${trip.origin} → ${trip.destination}`;

  return (
    <div
      className={`relative flex flex-col gap-3 p-4 cursor-pointer transition-colors group md:grid md:grid-cols-12 md:gap-4 md:px-6 md:items-center ${mobileDividerClass} ${rowStateClass}`}
    >
      {/* Mobile Header */}
      <div className="flex md:hidden justify-between items-start mb-2">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <StatusDot
              status={trip.status}
              isDelayed={isDelayed}
              animateActive={false}
            />
          </div>

          <div className="flex flex-col items-start gap-0.5 mt-1">
            {/* <span
              className={`text-[8px] tracking-wider font-bold px-1.5 py-[1px] rounded border w-max ${typeBadgeClass}`}
            >
              {tripTypeLabel}
            </span> */}

            <span
              className={`font-mono text-base md:text-sm font-bold transition-colors flex items-center gap-2 ${tripIdTextClass}`}
            >
              <FontAwesomeIcon
                icon={tripIcon}
                className="text-xs md:text-[10px]"
              />
              {trip.tripId}
            </span>

            <div className={`text-xs md:text-[10px] ${theme.mutedText}`}>
              {formatFirestoreDate(trip.updatedAt)}
            </div>
          </div>
        </div>

        <TripLifecycleMenu
          trip={trip}
          profile={profile}
          onOpenTrip={() => onClick(trip.id)}
          onSuccess={onDeleted}
          isDark={isDark}
          buttonClassName={theme.actionButton}
        />
      </div>

      {/* Col 1 */}
      <div className="md:col-span-3 flex items-center gap-4">
        <div className="hidden md:block">
          <StatusDot
            status={trip.status}
            isDelayed={isDelayed}
            animateActive={false}
          />
        </div>

        <div className="w-full">
          <div className="hidden md:flex flex-col items-start gap-2 mt-1">
            <div className="flex items-center gap-2">
              {/* <span
                className={`text-[9px] tracking-wider font-bold px-1.5 py-0.5 rounded border ${typeBadgeClass}`}
              >
                {tripTypeLabel}
              </span> */}

              <span
                className={`font-mono text-sm font-bold transition-colors flex items-center gap-2 ${tripIdTextClass}`}
              >
                <FontAwesomeIcon icon={tripIcon} className="text-[10px]" />
                {trip.tripId}
              </span>
            </div>
          </div>

          <div
            className={`text-sm md:text-xs md:mt-1 flex items-center justify-between md:justify-start gap-2 w-full ${theme.mutedText}`}
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
              className={`md:hidden font-mono text-xs ${theme.mutedText}`}
            >
              {statsCount}/{totalCount} {statsLabel}
              {statsSubLabel ? ` · ${statsSubLabel}` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Col 2 */}
      <div
        className={`md:col-span-2 flex justify-between md:block items-center border-t md:border-0 pt-2 md:pt-0 ${theme.rowBorder}`}
      >
        <div
          className={`text-base md:text-sm font-medium flex items-center gap-2 ${theme.secondaryText}`}
        >
          {trip.originCode || "—"}
          <span className={theme.routeArrow}>{routeArrow}</span>
          {routeCodeText || "—"}
        </div>

        <div
          className={`text-sm md:text-[10px] font-mono md:mt-0.5 truncate max-w-[150px] md:max-w-[120px] ${theme.mutedText}`}
          title={trip.route || routeText}
        >
          {routeText}
        </div>

        <div className="md:mt-1 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center text-[10px] md:text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none ${typeBadgeClass}`}
          >
            {tripTypeFullLabel}
          </span>

          {isHubTransfer ? (
            <ManifestStatusBadge trip={trip} isDark={isDark} compact />
          ) : (
            isManifestLocked && (
              <span
                className={`inline-flex items-center text-[10px] md:text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none gap-1 ${lockedBadgeClass}`}
              >
                <FontAwesomeIcon
                  icon={faLock}
                  className="text-[9px] md:text-[8px] text-current"
                />
                LOCKED
              </span>
            )
          )}
        </div>
      </div>

      {/* Col 3 */}
      <div className="hidden md:block col-span-2 pr-2">
        <div className={`border-l pl-3 min-w-0 ${theme.statsDivider}`}>
          <span className="text-[14px] font-mono block">
            {statsCount}/{totalCount}
          </span>
          <span className={`text-[10px] block mt-0.5 ${theme.mutedText}`}>
            {statsLabel}
          </span>
          {statsSubLabel ? (
            <span className={`text-[9px] block mt-0.5 ${theme.subtleText}`}>
              {statsSubLabel}
            </span>
          ) : null}
        </div>
      </div>

      {/* Col 4 */}
      <div className="md:col-span-3 md:pr-4 w-full">
        <div
          className={`hidden md:flex justify-between text-[10px] mb-1 ${theme.mutedText}`}
        >
          <span>
            {Number.isFinite(trip.progress)
              ? `${trip.progress}%`
              : "0%"}
          </span>
        </div>

        <div
          className={`h-1.5 w-full rounded-full overflow-hidden mt-1 md:mt-0 ${theme.progressTrack}`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressBarClass}`}
            style={{ width: `${trip.progress}%` }}
          />
        </div>

        <div className="mt-1.5 gap-2 flex flex-wrap">
          {isDelayed && (
            <span
              className={`text-[14px] px-1.5 rounded animate-pulse font-bold ${theme.delayedPill}`}
            >
              DELAYED
            </span>
          )}

          <span
            className={`text-sm md:text-[12px] font-bold uppercase tracking-wide ${statusTextClass}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Col 5 */}
      <div className="hidden md:flex col-span-1 flex-col gap-1 min-w-0">
        <div
          className={`text-[12px] flex items-center gap-1.5 whitespace-nowrap ${theme.mutedText}`}
        >
          {formatFirestoreDate(trip.updatedAt)}
        </div>

        {/* {trip.status !== "COMPLETED" && trip.estimatedArrival && (
          <div className={`text-xs ${theme.subtleText}`}>
            ETA:{" "}
            {new Date(trip.estimatedArrival).toLocaleString("en-PH", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
        )} */}
      </div>

      {/* Col 6 */}
      <div className="hidden md:flex col-span-1 justify-end items-center">
        <TripLifecycleMenu
          trip={trip}
          profile={profile}
          onOpenTrip={() => onClick(trip.id)}
          onSuccess={onDeleted}
          isDark={isDark}
          buttonClassName={theme.actionButton}
        />
      </div>
    </div>
  );
}
