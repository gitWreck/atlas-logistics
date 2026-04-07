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
import TruckScheduleSummaryCards from "./TruckScheduleSummaryCards";
import TruckUpcomingDepartures from "./TruckUpcomingDepartures";
import TruckScheduleConflictList from "./TruckScheduleConflictList";
import TruckScheduleTable from "./TruckScheduleTable";

export default function TruckScheduleOverview({
  truckTrips = [],
  isDark = false,
}) {
  console.log("TruckScheduleOverview received trips:", truckTrips);

  const theme = getOverviewThemeClasses(isDark);

  const summary = useMemo(() => {
    return getScheduleSummary(truckTrips);
  }, [truckTrips]);

  const upcomingTrips = useMemo(() => {
    return getUpcomingTrips(truckTrips, 5);
  }, [truckTrips]);

  const conflicts = useMemo(() => {
    return getScheduleConflicts(truckTrips);
  }, [truckTrips]);

  return (
    <section
      className={`rounded-2xl p-4 sm:p-5 ${theme.wrapper} shadow-xl backdrop-blur-sm mb-10`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-5">
        <div>
          <h2
            className={`text-lg sm:text-xl font-bold flex items-center gap-2 ${theme.strongText}`}
          >
            <FontAwesomeIcon icon={faCalendarDays} className="text-blue-500" />
            Truck Schedule Overview
          </h2>
          <p className={`text-sm mt-1 ${theme.mutedText}`}>
            Quick scheduling view for assigned trucks based on trip departure
            and estimated arrival.
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${theme.infoBadge}`}
        >
          <FontAwesomeIcon icon={faClock} />
          Phase 1
        </div>
      </div>

      <div className="mb-5">
        <TruckScheduleSummaryCards summary={summary} isDark={isDark} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        <div className="xl:col-span-3">
          <TruckUpcomingDepartures trips={upcomingTrips} isDark={isDark} />
        </div>

        {/* <div>
          <TruckScheduleConflictList conflicts={conflicts} isDark={isDark} />
        </div> */}
      </div>

      <TruckScheduleTable
        trips={summary.activeTrips || []}
        conflicts={conflicts}
        isDark={isDark}
      />
    </section>
  );
}
