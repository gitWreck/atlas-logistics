"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRoute,
  faTruck,
  faClock,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import {
  getOverviewThemeClasses,
  getStatCardTheme,
} from "@/app/utility/constant/theme";
import {
  getTripDeparture,
  getTripRoute,
  getTripTruckLabel,
} from "@/app/utility/tripScheduleHelpers";
import { formatScheduleDate } from "../tripHelpers";

export default function TripScheduleSummaryCards({ summary, isDark = false }) {
  const theme = getOverviewThemeClasses(isDark);
  const stat = getStatCardTheme(isDark);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      <StatCard
        palette={stat.blue}
        icon={faRoute}
        title="Scheduled Trips"
        value={summary?.totalScheduledTrips || 0}
        subtitle="Active trips with truck assignment"
      />

      <StatCard
        palette={stat.indigo}
        icon={faTruck}
        title="Trucks in Schedule"
        value={summary?.trucksWithUpcomingTrips || 0}
        subtitle="Trucks with at least one active trip"
      />

      <StatCard
        palette={stat.emerald}
        icon={faClock}
        title="Next Departure"
        value={
          summary?.nextDepartureTrip
            ? formatScheduleDate(getTripDeparture(summary.nextDepartureTrip))
            : "—"
        }
        subtitle={
          summary?.nextDepartureTrip
            ? `${getTripTruckLabel(summary.nextDepartureTrip)} • ${getTripRoute(summary.nextDepartureTrip)}`
            : "No scheduled departure"
        }
        valueClassName="text-base"
      />

      {/* <StatCard
        palette={stat.red}
        icon={faTriangleExclamation}
        title="Active Conflicts"
        value={summary?.totalConflicts || 0}
        subtitle="Overlap between departure and ETA"
        extraContent={
          (summary?.totalConflicts || 0) > 0 ? (
            <span
              className={`text-[10px] px-2 py-1 rounded-full ${theme.overviewWarningBadge}`}
            >
              Needs review
            </span>
          ) : null
        }
      /> */}
    </div>
  );
}

function StatCard({
  palette,
  icon,
  title,
  value,
  subtitle,
  extraContent = null,
  valueClassName = "text-2xl",
}) {
  return (
    <div className={`rounded-2xl p-4 border ${palette.card}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-[11px] uppercase font-bold ${palette.title}`}>
          {title}
        </span>

        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${palette.iconWrap}`}
        >
          <FontAwesomeIcon icon={icon} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <div className={`font-bold ${valueClassName} ${palette.value}`}>
          {value}
        </div>
        {extraContent}
      </div>

      <div className={`text-xs mt-1 ${palette.subtitle}`}>{subtitle}</div>
    </div>
  );
}
