"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisV,
  faWeightHanging,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../ui/StatusBadge";
import { getRowThemeClasses } from "@/app/utility/constant/theme";
import { formatFirestoreDate } from "@/app/utility/utilities";

function getOptionalOdometer(value) {
  if (value === null || value === undefined || value === "") return null;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function StatusDot({ status }) {
  let color = "bg-emerald-500";

  if (status === "MAINTENANCE") color = "bg-amber-500";
  if (status === "DISABLED" || status === "OUT_OF_SERVICE")
    color = "bg-red-500";
  if (status === "IDLE") color = "bg-slate-500";

  const isPulsing = status === "ACTIVE";

  return (
    <div className="relative flex items-center justify-center w-3 h-3 flex-shrink-0">
      {isPulsing && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </div>
  );
}

export default function TruckRow({ truck: t, onEdit, isDark = false }) {
  const theme = getRowThemeClasses(isDark);

  const serviceIntervalKm = 5000;

  const currentOdo = Number(t.currentOdometer) || 0;
  const lastPmsOdo = Number(t.lastPmsOdometer) || 0;

  const distanceSincePms =
    currentOdo > 0 && lastPmsOdo >= 0
      ? Math.max(currentOdo - lastPmsOdo, 0)
      : 0;

  const pmsRemainingKm = Math.max(serviceIntervalKm - distanceSincePms, 0);

  const pmsProgress = Math.min(
    Math.max((distanceSincePms / serviceIntervalKm) * 100, 0),
    100,
  );

  const isCritical = pmsRemainingKm <= 500;
  const pmsLabel = isCritical ? "Service Required" : "PMS Health";
  const pmsBarClass = isCritical ? theme.progressAmber : theme.progressBlue;
  const ltoExpiry = t.registrationExpiry
    ? new Date(t.registrationExpiry)
    : null;
  const today = new Date();

  const daysUntilExpiry = ltoExpiry
    ? Math.ceil((ltoExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isLtoDue = daysUntilExpiry !== null && daysUntilExpiry <= 30;

  const lastOilChange = getOptionalOdometer(t.lastOilChange);
  const lastTireChange = getOptionalOdometer(t.lastTireChange);

  const isOilDue =
    lastOilChange !== null &&
    currentOdo > 0 &&
    currentOdo - lastOilChange >= 10000;

  const isTireDue =
    lastTireChange !== null &&
    currentOdo > 0 &&
    currentOdo - lastTireChange >= 50000;

  const hasComplianceAlerts = isLtoDue || isOilDue || isTireDue;

  const payloadValue = t.payloadCapacity || t.payload || "-";
  const updatedAt = t.updatedAt ? formatFirestoreDate(t.updatedAt) : "-";
  const mobileDividerClass = isDark
    ? "border-b-4 border-b-slate-700/80 md:border-b md:border-b-slate-800/50"
    : "border-b-4 border-b-slate-300 md:border-b md:border-b-slate-200";

  return (
    <div
      className={`relative flex flex-col gap-3 p-4 transition-colors cursor-pointer group last:border-b-0 md:grid md:grid-cols-13 md:gap-4 md:px-6 md:items-center ${mobileDividerClass} ${theme.rowDefaultHover}`}
    >
      {/* MOBILE HEADER */}
      <div className="flex md:hidden justify-between items-start mb-1">
        <div className="flex items-center gap-3">
          <StatusDot status={t.status} />
          <div>
            <div
              className={`font-mono text-base font-medium uppercase ${theme.primaryText}`}
            >
              {t.plateNumber || "NO PLATE"}
            </div>
            <div
              className={`text-xs font-bold uppercase tracking-tight ${theme.mutedText}`}
            >
              {t.model || "Unknown Model"}
            </div>
          </div>
        </div>

        <button
          type="button"
          className={`p-2 -mr-2 rounded transition-colors ${theme.actionButton}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>

      {/* COL 1: PLATE / MODEL */}
      <div className="md:col-span-4 flex items-center gap-4">
        <div className="hidden md:block">
          <StatusDot status={t.status} />
        </div>

        <div className="w-full">
          <div className="hidden md:block">
            <div
              className={`font-mono text-sm font-medium uppercase transition-colors ${theme.truckPlateText}`}
            >
              {t.plateNumber || "NO PLATE"}
            </div>

            <div className="flex items-center gap-3 mt-1">
              <span
                className={`text-[10px] font-bold uppercase tracking-tight ${theme.mutedText}`}
              >
                {t.model || "Unknown Model"}
              </span>

              <span
                className={`text-xs font-mono border-l pl-2 ${theme.statsDivider}`}
              >
                {t.type || "Unknown Type"}
              </span>
            </div>
          </div>

          <div className="md:hidden flex flex-wrap items-center gap-2 mt-1">
            <span className={`text-sm font-mono ${theme.truckTypeText}`}>
              Type: {t.type || "Unknown Type"}
            </span>
            <StatusBadge status={t.status} size="xs" />
          </div>
        </div>
      </div>

      {/* COL 2: STATUS */}
      <div className="hidden md:col-span-2 md:flex md:flex-col md:items-start md:justify-start gap-2">
        <StatusBadge status={t.status} size="xs" />
      </div>

      {/* COL 3: PMS */}
      <div className="md:col-span-3 md:pr-4 w-full mt-2 md:mt-0">
        <div
          className={`h-1.5 w-full rounded-full overflow-hidden ${theme.progressTrack}`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${pmsBarClass}`}
            style={{ width: `${pmsProgress}%` }}
          />
        </div>

        <div className="flex justify-between mt-1.5">
          <span
            className={`text-xs md:text-[10px] font-bold uppercase ${
              isCritical ? theme.statusTextDelayed : theme.mutedText
            }`}
          >
            {pmsLabel}
          </span>

          <span className={`text-xs md:text-[10px] font-mono ${theme.subtleText}`}>
            {pmsRemainingKm} KM left
          </span>
        </div>
      </div>

      {/* COL 4: DETAILS / COMPLIANCE */}
      <div
        className={`md:col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 md:flex-col md:items-start md:justify-center md:gap-1.5 mt-2 md:mt-0 border-t md:border-0 pt-2 md:pt-0 ${theme.rowBorder}`}
      >
        <div
          className={`text-sm md:text-xs flex items-center gap-2 whitespace-nowrap ${theme.truckMetaText}`}
        >
          <FontAwesomeIcon
            icon={faWeightHanging}
            className={`text-[10px] ${theme.mutedText}`}
          />
          {payloadValue} KG
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {isLtoDue && (
            <span
              className={`text-[10px] md:text-[9px] font-bold px-1.5 py-0.5 rounded ${theme.complianceWarningBadge}`}
            >
              LTO RENEWAL
            </span>
          )}

          {isOilDue && (
            <span
              className={`text-[10px] md:text-[9px] font-bold px-1.5 py-0.5 rounded ${theme.complianceDangerBadge}`}
            >
              OIL CHANGE
            </span>
          )}

          {isTireDue && (
            <span
              className={`text-[10px] md:text-[9px] font-bold px-1.5 py-0.5 rounded ${theme.complianceDangerBadge}`}
            >
              TIRES DUE
            </span>
          )}

          {!hasComplianceAlerts && (
            <span
              className={`text-xs md:text-[10px] font-bold uppercase tracking-wider ${theme.complianceOkText}`}
            >
              Fully Compliant
            </span>
          )}
        </div>

        <div
          className={`text-xs md:text-[10px] flex items-center gap-2 whitespace-nowrap ${theme.subtleText}`}
        >
          <span>
            LTO:{" "}
            <span className={`font-mono ${theme.secondaryText}`}>
              {t.registrationExpiry
                ? new Date(t.registrationExpiry).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "-"}
            </span>
          </span>
        </div>
      </div>

      <div className="hidden md:block col-span-1 text-right">
        <div className={`text-xs flex items-center gap-1.5 ${theme.mutedText}`}>
          {updatedAt}
        </div>
      </div>

      {/* COL 5: ACTION */}
      <div className="hidden md:block col-span-1 text-right">
        <button
          type="button"
          className={`p-2 rounded-full transition-colors ${theme.actionButton}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>
    </div>
  );
}
