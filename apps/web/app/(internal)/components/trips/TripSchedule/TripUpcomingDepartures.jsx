"use client";

import React, { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faRoute,
  faTruck,
  faBoxesStacked,
  faArrowRight,
  faTruckPickup,
  faBox,
  faTruckFast,
} from "@fortawesome/free-solid-svg-icons";
import { getOverviewThemeClasses } from "@/app/utility/constant/theme";
import {
  getTripDeparture,
  getTripDisplayId,
  getTripEta,
  getTripRoute,
  getTripShipmentCount,
  getTripTruckLabel,
} from "@/app/utility/tripScheduleHelpers";
import { formatScheduleDate, getDayLabel } from "../tripHelpers";

const TABS = [
  {
    key: "HUB_TRANSFER",
    label: "Hub",
    icon: faRoute,
  },
  {
    key: "LOCAL_PICKUP",
    label: "Pickup",
    icon: faTruckPickup,
  },
  {
    key: "DELIVERY",
    label: "Delivery",
    icon: faBox,
  },
];

export default function TripUpcomingDepartures({ trips = [], isDark = false }) {
  const theme = getOverviewThemeClasses(isDark);
  const [activeTab, setActiveTab] = useState("HUB_TRANSFER");

  const filteredTrips = useMemo(() => {
    return trips.filter(
      (trip) => String(trip?.tripType || "HUB_TRANSFER") === activeTab,
    );
  }, [trips, activeTab]);

  const shownTrips = filteredTrips.slice(0, 3);

  return (
    // <div className={`rounded-3xl border p-4 sm:p-5 ${theme.sectionCard}`}>
    <>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className={`font-bold sm:text-xl flex items-center gap-2 text-base ${theme.strongText}`}
          >
            <FontAwesomeIcon icon={faTruckFast} className="text-blue-500" />
            Upcoming Departures
          </h3>
          <p className={`text-sm mt-1 ${theme.mutedText}`}>
            Earliest scheduled trips lined up for dispatch
          </p>

          <div className="mt-3">
            <div
              className={`inline-flex items-center gap-1.5  rounded-2xl backdrop-blur-sm ${theme.overviewSubPanel}`}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;

                const activeStyle =
                  tab.key === "HUB_TRANSFER"
                    ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                    : tab.key === "LOCAL_PICKUP"
                      ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                      : "bg-emerald-500 text-white shadow-md shadow-emerald-500/20";

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? activeStyle
                        : `text-slate-500 hover:text-slate-800 hover:bg-white/60 dark:hover:bg-white/5`
                    }`}
                  >
                    <FontAwesomeIcon icon={tab.icon} className="text-[11px]" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <span
          className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full ${theme.overviewSuccessBadge}`}
        >
          {shownTrips.length} shown
        </span>
      </div>

      <div className="space-y-3">
        {shownTrips.length > 0 ? (
          shownTrips.map((trip) => {
            const departure = getTripDeparture(trip);
            const arrival = getTripEta(trip);
            const tripType = String(trip?.tripType || "HUB_TRANSFER");

            const tripTypeLabel =
              tripType === "DELIVERY"
                ? "Delivery"
                : tripType === "LOCAL_PICKUP"
                  ? "Pickup"
                  : "Hub";

            const tripTypeIcon =
              tripType === "DELIVERY"
                ? faBox
                : tripType === "LOCAL_PICKUP"
                  ? faTruckPickup
                  : faRoute;

            return (
              <div
                key={trip.id || trip.tripId}
                className={`rounded-3xl border p-4 sm:p-5 shadow-sm transition-all hover:-translate-y-0.5 ${theme.overviewModernCard}`}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span
                          className={`text-sm font-bold ${theme.strongText}`}
                        >
                          {getTripDisplayId(trip)}
                        </span>

                        <span
                          className={`text-[10px] px-2.5 py-1 rounded-full ${theme.overviewInfoBadge}`}
                        >
                          {trip.status || "Scheduled"}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border ${theme.overviewMetaPill}`}
                        >
                          <FontAwesomeIcon
                            icon={tripTypeIcon}
                            className="text-[10px]"
                          />
                          {tripTypeLabel}
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
                        <>
                          {formatScheduleDate(departure)}
                          <div
                            className={`mt-1 text-[11px] ${theme.mutedText}`}
                          >
                            {getDayLabel(departure)}
                          </div>
                        </>
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
                        <>
                          {formatScheduleDate(arrival)}
                          <div
                            className={`mt-1 text-[11px] ${theme.mutedText}`}
                          >
                            {getDayLabel(arrival)}
                          </div>
                        </>
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
            );
          })
        ) : (
          <div
            className={`rounded-3xl border p-6 text-sm ${theme.overviewSubPanel} ${theme.mutedText}`}
          >
            No upcoming{" "}
            {activeTab === "HUB_TRANSFER"
              ? "hub"
              : activeTab === "LOCAL_PICKUP"
                ? "pickup"
                : "delivery"}{" "}
            trip schedules found.
          </div>
        )}
      </div>
    </>
    /* </div> */
  );
}
