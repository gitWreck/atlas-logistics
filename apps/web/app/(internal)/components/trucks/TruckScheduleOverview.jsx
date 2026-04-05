"use client";

import React, { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays,
  faClock,
  faRoute,
  faTruck,
  faTriangleExclamation,
  faBoxesStacked,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import { getOverviewThemeClasses } from "@/app/utility/constant/theme";

function formatDateTime(value) {
  if (!value) return "—";
  try {
    const date =
      typeof value?.toDate === "function" ? value.toDate() : new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "—";
  }
}

function getTimeValue(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  try {
    const date =
      typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    return date.getTime();
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function getTripDeparture(trip) {
  return (
    trip.plannedDeparture ||
    trip.departure ||
    trip.departureAt ||
    trip.scheduledDeparture ||
    null
  );
}

function getTripEta(trip) {
  return (
    trip.estimatedArrival ||
    trip.eta ||
    trip.estimatedArrivalAt ||
    trip.arrivalEstimate ||
    null
  );
}

function getTripRoute(trip) {
  const origin = trip.origin || trip.originName || trip.pickupLocation || "—";
  const destination =
    trip.destination || trip.destinationName || trip.dropoffLocation || "—";
  return `${origin} → ${destination}`;
}

function getTripShipmentCount(trip) {
  return (
    trip.totalShipments ||
    trip.shipmentCount ||
    trip.totalItems ||
    trip.totalLoaded ||
    0
  );
}

function isTripActiveForSchedule(trip) {
  if (!trip) return false;
  if (!trip.truckId) return false;
  if (trip.active === false) return false;
  if (trip.status === "COMPLETED" || trip.status === "CANCELLED") return false;
  return true;
}

export default function TruckScheduleOverview({
  truckTrips = [],
  isDark = false,
}) {
  const theme = getOverviewThemeClasses(isDark);

  const data = useMemo(() => {
    const activeTrips = (truckTrips || [])
      .filter(isTripActiveForSchedule)
      .sort(
        (a, b) =>
          getTimeValue(getTripDeparture(a)) - getTimeValue(getTripDeparture(b)),
      );

    const truckMap = new Map();

    for (const trip of activeTrips) {
      const truckId = trip.truckId;
      if (!truckMap.has(truckId)) {
        truckMap.set(truckId, []);
      }
      truckMap.get(truckId).push(trip);
    }

    let conflicts = [];
    let nextDepartureTrip = null;

    for (const [, trips] of truckMap.entries()) {
      const sortedTrips = [...trips].sort(
        (a, b) =>
          getTimeValue(getTripDeparture(a)) - getTimeValue(getTripDeparture(b)),
      );

      if (!nextDepartureTrip && sortedTrips.length > 0) {
        nextDepartureTrip = sortedTrips[0];
      } else if (sortedTrips.length > 0) {
        const currentNext = getTimeValue(getTripDeparture(nextDepartureTrip));
        const challenger = getTimeValue(getTripDeparture(sortedTrips[0]));
        if (challenger < currentNext) nextDepartureTrip = sortedTrips[0];
      }

      for (let i = 0; i < sortedTrips.length - 1; i++) {
        const currentTrip = sortedTrips[i];
        const nextTrip = sortedTrips[i + 1];

        const currentEta = getTimeValue(getTripEta(currentTrip));
        const nextDeparture = getTimeValue(getTripDeparture(nextTrip));

        if (
          currentEta !== Number.POSITIVE_INFINITY &&
          nextDeparture !== Number.POSITIVE_INFINITY &&
          nextDeparture < currentEta
        ) {
          conflicts.push({
            truckId: currentTrip.truckId,
            truckLabel:
              currentTrip.truckPlateNumber ||
              nextTrip.truckPlateNumber ||
              currentTrip.truckId,
            currentTrip,
            nextTrip,
          });
        }
      }
    }

    const upcomingTrips = activeTrips.slice(0, 5);

    return {
      activeTrips,
      truckGroups: truckMap,
      trucksWithUpcomingTrips: truckMap.size,
      totalScheduledTrips: activeTrips.length,
      nextDepartureTrip,
      conflicts,
      upcomingTrips,
    };
  }, [truckTrips]);

  return (
    <section
      className={`rounded-2xl p-4 sm:p-5 ${theme.wrapper} shadow-xl backdrop-blur-sm`}
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
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${theme.badge}`}
        >
          <FontAwesomeIcon icon={faClock} />
          Phase 1
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <div className={`rounded-2xl p-4 border ${theme.analyticsCard}`}>
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] uppercase font-bold ${theme.analyticsLabel}`}
            >
              Scheduled Trips
            </span>
            <FontAwesomeIcon icon={faRoute} className="text-blue-500" />
          </div>
          <div className={`mt-3 text-2xl font-bold ${theme.analyticsValue}`}>
            {data.totalScheduledTrips}
          </div>
          <div className={`text-xs mt-1 ${theme.mutedText}`}>
            Active trips with truck assignment
          </div>
        </div>

        <div className={`rounded-2xl p-4 border ${theme.analyticsCard}`}>
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] uppercase font-bold ${theme.analyticsLabel}`}
            >
              Trucks in Schedule
            </span>
            <FontAwesomeIcon icon={faTruck} className="text-indigo-500" />
          </div>
          <div className={`mt-3 text-2xl font-bold ${theme.analyticsValue}`}>
            {data.trucksWithUpcomingTrips}
          </div>
          <div className={`text-xs mt-1 ${theme.mutedText}`}>
            Trucks with at least one upcoming trip
          </div>
        </div>

        <div className={`rounded-2xl p-4 border ${theme.analyticsCard}`}>
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] uppercase font-bold ${theme.analyticsLabel}`}
            >
              Next Departure
            </span>
            <FontAwesomeIcon icon={faClock} className="text-emerald-500" />
          </div>
          <div className={`mt-3 text-base font-bold ${theme.analyticsValue}`}>
            {data.nextDepartureTrip
              ? formatDateTime(getTripDeparture(data.nextDepartureTrip))
              : "—"}
          </div>
          <div className={`text-xs mt-1 ${theme.mutedText}`}>
            {data.nextDepartureTrip
              ? `${data.nextDepartureTrip.truckPlateNumber || "Unlabeled Truck"} • ${getTripRoute(data.nextDepartureTrip)}`
              : "No scheduled departure"}
          </div>
        </div>

        <div className={`rounded-2xl p-4 border ${theme.analyticsCard}`}>
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] uppercase font-bold ${theme.analyticsLabel}`}
            >
              Active Conflicts
            </span>
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className="text-red-500"
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className={`text-2xl font-bold ${theme.analyticsValue}`}>
              {data.conflicts.length}
            </div>
            {data.conflicts.length > 0 && (
              <span
                className={`text-[10px] px-2 py-1 rounded-full ${theme.warningBadge}`}
              >
                Needs review
              </span>
            )}
          </div>
          <div className={`text-xs mt-1 ${theme.mutedText}`}>
            Overlap between trip departure and ETA
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        {/* Upcoming departures */}
        <div
          className={`xl:col-span-2 rounded-2xl border p-4 ${theme.sectionCard}`}
        >
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
              className={`text-[11px] px-2 py-1 rounded-full ${theme.successBadge}`}
            >
              {data.upcomingTrips.length} shown
            </span>
          </div>

          <div className="space-y-3">
            {data.upcomingTrips.length > 0 ? (
              data.upcomingTrips.map((trip) => (
                <div
                  key={trip.id}
                  className={`rounded-2xl border p-4 ${theme.subPanel}`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-bold ${theme.strongText}`}
                        >
                          {trip.truckPlateNumber || "No Plate"}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-1 rounded-full ${theme.badge}`}
                        >
                          {trip.status || "Scheduled"}
                        </span>
                      </div>

                      <div className={`text-xs mt-1 ${theme.mutedText}`}>
                        {trip.id || "No Trip ID"}
                      </div>

                      <div className={`text-sm mt-3 ${theme.strongText}`}>
                        {getTripRoute(trip)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs min-w-0">
                      <div>
                        <div className={theme.tinyMuted}>Departure</div>
                        <div
                          className={`mt-1 font-semibold ${theme.strongText}`}
                        >
                          {formatDateTime(getTripDeparture(trip))}
                        </div>
                      </div>

                      <div>
                        <div className={theme.tinyMuted}>ETA</div>
                        <div
                          className={`mt-1 font-semibold ${theme.strongText}`}
                        >
                          {formatDateTime(getTripEta(trip))}
                        </div>
                      </div>

                      <div>
                        <div className={theme.tinyMuted}>Shipments</div>
                        <div
                          className={`mt-1 font-semibold ${theme.strongText}`}
                        >
                          {getTripShipmentCount(trip)}
                        </div>
                      </div>

                      <div>
                        <div className={theme.tinyMuted}>Truck</div>
                        <div
                          className={`mt-1 font-semibold ${theme.highlightText}`}
                        >
                          {trip.truckPlateNumber || "Assigned"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div
                className={`rounded-2xl border p-5 text-sm ${theme.subPanel} ${theme.mutedText}`}
              >
                No upcoming truck schedules found.
              </div>
            )}
          </div>
        </div>

        {/* Conflict watch */}
        <div className={`rounded-2xl border p-4 ${theme.sectionCard}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className={`font-bold ${theme.strongText}`}>
                Conflict Watch
              </h3>
              <p className={`text-xs mt-1 ${theme.mutedText}`}>
                Trips that overlap on the same truck
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {data.conflicts.length > 0 ? (
              data.conflicts.slice(0, 5).map((item, index) => (
                <div
                  key={`${item.truckId}-${index}`}
                  className={`rounded-2xl p-3 ${theme.warningBadge}`}
                >
                  <div className="flex items-start gap-2">
                    <FontAwesomeIcon
                      icon={faTriangleExclamation}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold">
                        {item.truckLabel || "Truck"}
                      </div>

                      <div className="text-xs mt-1 opacity-90">
                        {getTripRoute(item.currentTrip)}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] mt-2 opacity-90">
                        <span>
                          {formatDateTime(getTripEta(item.currentTrip))}
                        </span>
                        <FontAwesomeIcon icon={faArrowRight} />
                        <span>
                          {formatDateTime(getTripDeparture(item.nextTrip))}
                        </span>
                      </div>

                      <div className="text-[11px] mt-2 opacity-90">
                        Next trip departs before previous ETA.
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div
                className={`rounded-2xl border p-4 text-sm ${theme.subPanel} ${theme.mutedText}`}
              >
                No truck schedule conflicts found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule table */}
      <div
        className={`rounded-2xl overflow-hidden border ${theme.sectionCard}`}
      >
        <div className="px-4 py-4">
          <h3 className={`font-bold ${theme.strongText}`}>Schedule List</h3>
          <p className={`text-xs mt-1 ${theme.mutedText}`}>
            Planned departure and estimated arrival per truck-assigned trip
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={`border-y ${theme.tableHead}`}>
              <tr>
                <th className="text-left px-4 py-3 text-[11px] uppercase font-bold">
                  Truck
                </th>
                <th className="text-left px-4 py-3 text-[11px] uppercase font-bold">
                  Trip
                </th>
                <th className="text-left px-4 py-3 text-[11px] uppercase font-bold">
                  Route
                </th>
                <th className="text-left px-4 py-3 text-[11px] uppercase font-bold">
                  Departure
                </th>
                <th className="text-left px-4 py-3 text-[11px] uppercase font-bold">
                  ETA
                </th>
                <th className="text-left px-4 py-3 text-[11px] uppercase font-bold">
                  Shipments
                </th>
                <th className="text-left px-4 py-3 text-[11px] uppercase font-bold">
                  Remarks
                </th>
              </tr>
            </thead>

            <tbody>
              {data.activeTrips.length > 0 ? (
                data.activeTrips.map((trip) => {
                  const hasConflict = data.conflicts.some(
                    (item) =>
                      item.currentTrip?.id === trip.id ||
                      item.nextTrip?.id === trip.id,
                  );

                  return (
                    <tr
                      key={trip.id}
                      className={`border-t transition-colors ${theme.row}`}
                    >
                      <td className={`px-4 py-3 font-bold ${theme.strongText}`}>
                        {trip.truckPlateNumber || "No Plate"}
                      </td>

                      <td className={`px-4 py-3 ${theme.mutedText}`}>
                        {trip.id || "—"}
                      </td>

                      <td className={`px-4 py-3 ${theme.mutedText}`}>
                        {getTripRoute(trip)}
                      </td>

                      <td className={`px-4 py-3 ${theme.strongText}`}>
                        {formatDateTime(getTripDeparture(trip))}
                      </td>

                      <td className={`px-4 py-3 ${theme.strongText}`}>
                        {formatDateTime(getTripEta(trip))}
                      </td>

                      <td className={`px-4 py-3 ${theme.mutedText}`}>
                        <div className="inline-flex items-center gap-2">
                          <FontAwesomeIcon
                            icon={faBoxesStacked}
                            className="text-amber-500"
                          />
                          {getTripShipmentCount(trip)}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-[10px] ${
                            hasConflict ? theme.warningBadge : theme.badge
                          }`}
                        >
                          {hasConflict
                            ? "Conflict"
                            : trip.status || "Scheduled"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className={`px-4 py-8 text-center text-sm ${theme.mutedText}`}
                  >
                    No truck-linked trip schedules available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
