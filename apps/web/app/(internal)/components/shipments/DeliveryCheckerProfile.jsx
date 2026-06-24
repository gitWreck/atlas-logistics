"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEnvelope,
  faMapLocationDot,
  faPenToSquare,
  faUser,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";
import { getDeliveryCheckerTabThemeClasses } from "@/app/utility/constant/theme";

export default function DeliveryCheckerProfile({
  checker = null,
  isDark = false,
  canEdit = false,
  onEditAreas,
}) {
  const theme = getDeliveryCheckerTabThemeClasses(isDark);

  if (!checker) {
    return (
      <div
        className={`border-b px-3 py-2.5 text-[11px] leading-relaxed sm:px-5 sm:py-3 sm:text-xs ${theme.filterBar} ${theme.subtitle}`}
      >
        Select a checker above to view their assigned delivery areas.
      </div>
    );
  }

  const municipalities = Array.isArray(checker.assignedMunicipalities)
    ? checker.assignedMunicipalities
    : [];
  const warehouseLabel = [checker.warehouseName, checker.warehouseCode]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`border-b px-3 py-3 sm:px-5 sm:py-4 ${theme.filterBar}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  isDark
                    ? "bg-blue-500/15 text-blue-300"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                <FontAwesomeIcon icon={faUser} className="text-sm" />
              </span>
              <p className={`truncate text-sm font-bold ${theme.title}`}>
                {checker.name || "Checker"}
              </p>
            </div>
            {checker.email ? (
              <span
                className={`inline-flex w-full min-w-0 items-center gap-1.5 text-[11px] sm:w-auto sm:text-xs ${theme.subtitle}`}
              >
                <FontAwesomeIcon icon={faEnvelope} className="shrink-0 opacity-70" />
                <span className="truncate">{checker.email}</span>
              </span>
            ) : null}
            {warehouseLabel ? (
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] sm:text-xs ${theme.subtitle}`}
              >
                <FontAwesomeIcon icon={faWarehouse} className="shrink-0 opacity-70" />
                {warehouseLabel}
              </span>
            ) : null}
          </div>

          <div className="mt-3">
            <div className="mb-2 flex items-center gap-2">
              <FontAwesomeIcon
                icon={faMapLocationDot}
                className={`text-[11px] ${theme.filterLabel}`}
              />
              <p
                className={`text-[10px] font-bold uppercase tracking-wider ${theme.filterLabel}`}
              >
                Assigned areas
              </p>
            </div>

            {municipalities.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {municipalities.map((municipality) => (
                  <span
                    key={municipality}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold sm:px-2.5 sm:py-1 sm:text-xs ${
                      isDark
                        ? "bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/25"
                        : "bg-sky-50 text-sky-800 ring-1 ring-sky-200"
                    }`}
                  >
                    {municipality}
                  </span>
                ))}
              </div>
            ) : (
              <p
                className={`rounded-lg border px-3 py-2 text-xs ${
                  isDark
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                No municipalities assigned. This checker will not see released
                shipments in the mobile pool until areas are assigned.
              </p>
            )}
          </div>
        </div>

        {canEdit && onEditAreas ? (
          <button
            type="button"
            onClick={onEditAreas}
            className={`inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors sm:w-auto sm:self-start sm:justify-start sm:py-2 ${
              isDark
                ? "border-slate-600 text-slate-200 hover:border-sky-500 hover:text-sky-300 hover:bg-sky-500/10"
                : "border-slate-300 text-slate-700 hover:border-sky-500 hover:text-sky-700 hover:bg-sky-50"
            }`}
          >
            <FontAwesomeIcon icon={faPenToSquare} className="text-sky-500" />
            Edit areas
          </button>
        ) : null}
      </div>
    </div>
  );
}
