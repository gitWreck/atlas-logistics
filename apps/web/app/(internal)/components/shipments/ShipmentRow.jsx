"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEdit,
  faEllipsisV,
  faTruck,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../ui/StatusBadge";
import { getRowThemeClasses } from "@/app/utility/constant/theme";

function StatusDot({ status, isDelayed }) {
  let color = "bg-blue-500";
  let animate = false;

  if (status === "DELIVERED") color = "bg-emerald-500";
  if (status === "CREATED") color = "bg-slate-600";
  if (isDelayed) {
    color = "bg-amber-500";
    animate = true;
  } else if (!["DELIVERED", "CREATED"].includes(status)) {
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

export default function ShipmentRow({
  shipmentBoard,
  s,
  onClick,
  isDark = false,
  onEdit,
}) {
  const theme = getRowThemeClasses(isDark);

  const isDelayed =
    !!s.truckDetails?.delayReason && !s.truckDetails?.delayCleared;

  const loadedCount = s.metrics?.totalLoaded || 0;
  const totalCount = s.metrics?.totalContent || 0;
  const driverName = s.truckDetails?.driverName || "Unassigned";

  const trackingNumber = s.trackingNumber || "—";
  const routeCode = `${s.originCode || "N/A"} -> ${s.destinationCode || "N/A"}`;
  const routeLabel = `${s.origin || "—"} -> ${s.destination || "—"}`;
  const updatedLabel = s.updatedAt || "Just now";

  const rowStateClass = isDelayed ? theme.rowDelayed : theme.rowDefaultHover;

  const progressBarClass =
    s.status === "DELIVERED"
      ? theme.progressEmerald
      : isDelayed
        ? theme.progressAmber
        : theme.progressBlue;

  const statusTextClass = isDelayed
    ? theme.statusTextDelayed
    : s.status === "DELIVERED"
      ? theme.statusTextCompleted
      : theme.statusTextDefault;

  return (
    <div
      className={`relative flex flex-col gap-3 p-4 border-b cursor-pointer transition-colors group md:grid md:grid-cols-13 md:gap-4 md:px-6 md:items-center ${theme.rowBorder} ${rowStateClass}`}
    >
      {/* Mobile Header */}
      <div className="flex md:hidden justify-between items-start mb-1">
        <div className="flex items-center gap-3">
          <StatusDot status={s.status} isDelayed={isDelayed} />

          <div>
            <div
              className={`font-mono text-sm font-bold ${theme.tripIdTextShipment}`}
            >
              {trackingNumber}
            </div>
            <div className={`text-[10px] ${theme.mutedText}`}>
              {updatedLabel}
            </div>
          </div>
        </div>

        <div className="flex items-center">
          {s.isPickupRequested === true && (
            <button
              type="button"
              className={`p-2 rounded transition-colors ${theme.actionButton}`}
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(s);
              }}
            >
              <FontAwesomeIcon icon={faEdit} />
            </button>
          )}

          <button
            type="button"
            className={`p-2 -mr-2 rounded transition-colors ${theme.actionButton}`}
            onClick={(e) => {
              e.stopPropagation();
              onClick(s.id);
            }}
          >
            <FontAwesomeIcon icon={faEllipsisV} />
          </button>
        </div>
      </div>

      {/* Col 1: Tracking / Driver */}
      <div className="md:col-span-4 flex items-center gap-4">
        <div className="hidden md:block">
          <StatusDot status={s.status} isDelayed={isDelayed} />
        </div>

        <div className="w-full">
          <div
            className={`hidden md:flex items-center gap-2 font-mono text-sm font-medium transition-colors ${theme.secondaryText}`}
          >
            <FontAwesomeIcon icon={faTruck} className="text-[10px]" />
            <span>{trackingNumber}</span>
          </div>

          <div className="flex flex-wrap md:flex-nowrap items-center gap-3 mt-1">
            <StatusBadge status={s.status} size="xs" isDark={isDark} />

            <span
              className={`text-xs font-mono border-l pl-2 ${theme.statsDivider}`}
            >
              {loadedCount}/{totalCount} Loaded
            </span>

            <span
              className={`hidden md:block text-xs border-l pl-2 truncate max-w-[120px] ${theme.mutedText} ${theme.rowBorder.replace("border-", "border-l ")}`}
              title={driverName}
            >
              Driver: {driverName}
            </span>
          </div>

          <div className={`md:hidden text-xs mt-1 ${theme.mutedText}`}>
            Driver: {driverName}
          </div>
        </div>
      </div>

      {/* Col 2: Route */}
      <div
        className={`md:col-span-2 flex justify-between md:block items-center border-t md:border-0 pt-2 md:pt-0 ${theme.rowBorder}`}
      >
        <div className={`text-sm font-medium ${theme.secondaryText}`}>
          {routeCode}
        </div>
        <div className={`text-xs font-mono mt-0.5 ${theme.subtleText}`}>
          {routeLabel}
        </div>
      </div>

      {/* Col 3: Sender / Recipient */}
      <div
        className={`md:col-span-2 flex flex-col justify-center gap-1.5 md:border-0 pt-2 md:pt-0 ${theme.rowBorder}`}
      >
        <div className="flex items-center gap-2 truncate">
          <span
            className={`text-[9px] font-bold uppercase w-8 shrink-0 ${theme.subtleText}`}
          >
            From
          </span>
          <span
            className={`text-sm font-medium truncate ${theme.secondaryText}`}
          >
            {s.sender?.name || "Unknown"}
          </span>
        </div>

        <div className="flex items-center gap-2 truncate">
          <span
            className={`text-[9px] font-bold uppercase w-8 shrink-0 ${theme.subtleText}`}
          >
            To
          </span>
          <span
            className={`text-sm font-medium truncate ${theme.secondaryText}`}
          >
            {s.recipient?.name || "Unknown"}
          </span>
        </div>
      </div>

      {/* Col 4: Progress */}
      <div className="md:col-span-3 md:pr-4 w-full mt-2 md:mt-0">
        <div
          className={`h-1.5 w-full rounded-full overflow-hidden ${theme.progressTrack}`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressBarClass}`}
            style={{ width: `${s.progress || 0}%` }}
          />
        </div>

        <div className="flex justify-between mt-1.5">
          <span
            className={`text-[10px] font-medium uppercase ${statusTextClass}`}
          >
            {s.status?.replaceAll("_", " ") || "UNKNOWN"}
          </span>
          <span className={`text-[10px] ${theme.subtleText}`}>
            {s.progress || 0}%
          </span>
        </div>
      </div>

      {/* Col 5: Time / Delay */}
      <div className="hidden md:flex col-span-1 flex-col gap-2">
        <div className={`text-xs ${theme.mutedText}`}>{updatedLabel}</div>

        {isDelayed && (
          <div className="w-fit">
            <StatusBadge
              status={s.truckDetails?.status}
              reason={s.truckDetails?.delayReason}
              isDark={isDark}
            />
          </div>
        )}
      </div>

      {/* Col 6: Actions */}
      <div className="hidden md:block col-span-1 text-right">
        {s.isPickupRequested === true && shipmentBoard !== true && (
          <button
            type="button"
            className={`p-2 rounded-full transition-colors ${theme.actionButton}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(s);
            }}
          >
            <FontAwesomeIcon icon={faEdit} />
          </button>
        )}

        <button
          type="button"
          className={`p-2 rounded-full transition-colors ${theme.actionButton}`}
          onClick={(e) => {
            e.stopPropagation();
            onClick(s.id);
          }}
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>
    </div>
  );
}
