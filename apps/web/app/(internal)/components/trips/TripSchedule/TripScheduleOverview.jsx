"use client";

import React, { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays, faClock } from "@fortawesome/free-solid-svg-icons";
import { getOverviewThemeClasses } from "@/app/utility/constant/theme";
import {
  getScheduleSummary,
  getUpcomingTrips,
  getScheduleConflicts,
} from "@/app/utility/tripScheduleHelpers";
import TripScheduleSummaryCards from "./TripScheduleSummaryCards";
import TripUpcomingDepartures from "./TripUpcomingDepartures";
import TripScheduleConflictList from "./TripScheduleConflictList";
import TripScheduleTable from "./TripScheduleTable";

export default function TripScheduleOverview({
  trips = [],
  isDark = false,
  onOpenTripSchedule,
  onOpenScheduleModal,
}) {
  const theme = getOverviewThemeClasses(isDark);

  const summary = useMemo(() => {
    return getScheduleSummary(trips);
  }, [trips]);

  const upcomingTrips = useMemo(() => {
    return getUpcomingTrips(trips, 5);
  }, [trips]);

  const conflicts = useMemo(() => {
    return getScheduleConflicts(trips);
  }, [trips]);

  return (
    <>
      <section
        className={`rounded-2xl p-4 sm:p-5 ${theme.overviewWrapper} shadow-xl backdrop-blur-sm mb-10`}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-5">
          <div>
            <h2
              className={`text-lg sm:text-xl font-bold flex items-center gap-2 ${theme.strongText}`}
            >
              <FontAwesomeIcon
                icon={faCalendarDays}
                className="text-blue-500"
              />
              Trip Schedule Overview
            </h2>
            <p className={`text-sm mt-1 ${theme.mutedText}`}>
              Quick scheduling view of truck-assigned trips based on departure
              and arrival timing.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenScheduleModal}
            className={` bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 text-white inline-flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${theme.overviewInfoBadge}`}
          >
            <FontAwesomeIcon icon={faClock} />
            Create Trip Schedule
          </button>
        </div>

        <div className="mb-5">
          <TripScheduleSummaryCards summary={summary} isDark={isDark} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
          <div className="xl:col-span-3">
            <TripUpcomingDepartures trips={upcomingTrips} isDark={isDark} />
          </div>

          {/* Uncomment when ready */}
          {/* <div>
          <TripScheduleConflictList conflicts={conflicts} isDark={isDark} />
        </div> */}
        </div>
      </section>

      <TripScheduleTable
        trips={summary.activeTrips || []}
        conflicts={conflicts}
        isDark={isDark}
        onOpenTripSchedule={onOpenTripSchedule}
      />
    </>
  );
}
