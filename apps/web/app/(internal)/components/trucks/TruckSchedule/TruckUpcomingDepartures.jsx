"use client";

import React from "react";
import { getOverviewThemeClasses } from "@/app/utility/constant/theme";
import { formatFirestoreDate } from "@/app/utility/utilities";
import {
  getTripDeparture,
  getTripDisplayId,
  getTripEta,
  getTripRoute,
  getTripShipmentCount,
  getTripTruckLabel,
} from "@/app/utility/tripScheduleHelpers";

export default function TruckUpcomingDepartures({
  trips = [],
  isDark = false,
}) {
  const theme = getOverviewThemeClasses(isDark);

  return (
    <div className={`rounded-2xl border p-4 ${theme.sectionCard}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className={`font-bold ${theme.strongText}`}>
            Upcoming Departures
          </h3>
          <p className={`text-xs mt-1 ${theme.mutedText}`}>
            Earliest truck-bound trips
          </p>
        </div>

        <span
          className={`text-[11px] px-2 py-1 rounded-full ${theme.overviewSuccessBadge}`}
        >
          {trips.length} shown
        </span>
      </div>

      <div className="space-y-3">
        {trips.length > 0 ? (
          trips.slice(0, 3).map((trip) => (
            <div
              key={trip.id || trip.tripId}
              className={`rounded-2xl border p-4 ${theme.overviewSubPanel}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-bold ${theme.strongText}`}>
                      {getTripTruckLabel(trip)}
                    </span>

                    <span
                      className={`text-[10px] px-2 py-1 rounded-full ${theme.overviewInfoBadge}`}
                    >
                      {trip.status || "Scheduled"}
                    </span>
                  </div>

                  <div className={`text-xs mt-1 ${theme.mutedText}`}>
                    {getTripDisplayId(trip)}
                  </div>

                  <div className={`text-sm mt-3 ${theme.strongText}`}>
                    {getTripRoute(trip)}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs min-w-0">
                  <div>
                    <div className={theme.overviewTinyMuted}>Departure</div>
                    <div className={`mt-1 font-semibold ${theme.strongText}`}>
                      {formatFirestoreDate(getTripDeparture(trip))}
                    </div>
                  </div>

                  <div>
                    <div className={theme.overviewTinyMuted}>ETA</div>
                    <div className={`mt-1 font-semibold ${theme.strongText}`}>
                      {formatFirestoreDate(getTripEta(trip))}
                    </div>
                  </div>

                  <div>
                    <div className={theme.overviewTinyMuted}>Shipments</div>
                    <div className={`mt-1 font-semibold ${theme.strongText}`}>
                      {getTripShipmentCount(trip)}
                    </div>
                  </div>

                  <div>
                    <div className={theme.overviewTinyMuted}>Truck</div>
                    <div
                      className={`mt-1 font-semibold ${theme.highlightText}`}
                    >
                      {getTripTruckLabel(trip)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div
            className={`rounded-2xl border p-5 text-sm ${theme.overviewSubPanel} ${theme.mutedText}`}
          >
            No upcoming truck schedules found.
          </div>
        )}
      </div>
    </div>
  );
}
