"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faRoute,
  faTruck,
  faBoxesStacked,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
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

export default function TripUpcomingDepartures({ trips = [], isDark = false }) {
  const theme = getOverviewThemeClasses(isDark);

  return (
    <div className={`rounded-3xl border p-4 sm:p-5 ${theme.sectionCard}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`font-bold text-base ${theme.strongText}`}>
            Upcoming Departures
          </h3>
          <p className={`text-xs mt-1 ${theme.mutedText}`}>
            Earliest scheduled trips lined up for dispatch
          </p>
        </div>

        <span
          className={`text-[11px] px-2.5 py-1 rounded-full ${theme.overviewSuccessBadge}`}
        >
          {trips.length} shown
        </span>
      </div>

      <div className="space-y-3">
        {trips.length > 0 ? (
          trips.slice(0, 3).map((trip) => (
            <div
              key={trip.id || trip.tripId}
              className={`rounded-3xl border p-4 sm:p-5 shadow-sm transition-all hover:-translate-y-0.5 ${theme.overviewModernCard}`}
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-sm font-bold ${theme.strongText}`}>
                        {getTripDisplayId(trip)}
                      </span>

                      <span
                        className={`text-[10px] px-2.5 py-1 rounded-full ${theme.overviewInfoBadge}`}
                      >
                        {trip.status || "Scheduled"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border ${theme.overviewMetaPill}`}
                      >
                        <FontAwesomeIcon
                          icon={faTruck}
                          className="text-[11px]"
                        />
                        {getTripTruckLabel(trip)}
                      </span>

                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border ${theme.overviewMetaPill}`}
                      >
                        <FontAwesomeIcon
                          icon={faRoute}
                          className="text-[11px]"
                        />
                        {getTripRoute(trip)}
                      </span>
                    </div>
                  </div>

                  <div className={`text-xs ${theme.mutedText}`}>
                    Upcoming trip
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    className={`rounded-2xl border px-4 py-3 ${theme.overviewStatCard}`}
                  >
                    <div
                      className={`flex items-center gap-2 text-[11px] uppercase font-semibold ${theme.overviewTinyMuted}`}
                    >
                      <FontAwesomeIcon
                        icon={faClock}
                        className="text-blue-500"
                      />
                      Departure
                    </div>
                    <div
                      className={`mt-2 text-sm font-semibold ${theme.strongText}`}
                    >
                      {formatFirestoreDate(getTripDeparture(trip))}
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl border px-4 py-3 ${theme.overviewStatCard}`}
                  >
                    <div
                      className={`flex items-center gap-2 text-[11px] uppercase font-semibold ${theme.overviewTinyMuted}`}
                    >
                      <FontAwesomeIcon
                        icon={faArrowRight}
                        className="text-emerald-500"
                      />
                      Estimated Arrival
                    </div>
                    <div
                      className={`mt-2 text-sm font-semibold ${theme.strongText}`}
                    >
                      {formatFirestoreDate(getTripEta(trip))}
                    </div>
                  </div>

                  <div
                    className={`rounded-2xl border px-4 py-3 ${theme.overviewStatCard}`}
                  >
                    <div
                      className={`flex items-center gap-2 text-[11px] uppercase font-semibold ${theme.overviewTinyMuted}`}
                    >
                      <FontAwesomeIcon
                        icon={faBoxesStacked}
                        className="text-amber-500"
                      />
                      Shipments
                    </div>
                    <div
                      className={`mt-2 text-sm font-semibold ${theme.strongText}`}
                    >
                      {getTripShipmentCount(trip)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div
            className={`rounded-3xl border p-6 text-sm ${theme.overviewSubPanel} ${theme.mutedText}`}
          >
            No upcoming trip schedules found.
          </div>
        )}
      </div>
    </div>
  );
}
