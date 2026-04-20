"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faEdit,
  faFilter,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";
import {
  getRowThemeClasses,
  getTableTheme,
  getOverviewThemeClasses,
} from "@/app/utility/constant/theme";
import { formatFirestoreDate } from "@/app/utility/utilities";
import {
  getTripDeparture,
  getTripDisplayId,
  getTripEta,
  getTripTruckLabel,
} from "@/app/utility/tripScheduleHelpers";
import StatusBadge from "../../ui/StatusBadge";
import { renderTimePair } from "../utils";

function getPlannedLoadingStart(trip) {
  return trip?.plannedLoadingStart || null;
}

function getPlannedLoadingEnd(trip) {
  return trip?.plannedLoadingEnd || null;
}

const ALLOWED_STATUSES = [
  "CREATED",
  "IN_TRANSIT",
  "LOADED",
  "ARRIVED",
  "COMPLETED",
  "CANCELLED",
];

function InfoBlock({ label, value, theme }) {
  return (
    <div className="min-w-0">
      <p
        className={`text-[10px] uppercase tracking-wide ${theme.cellSecondary}`}
      >
        {label}
      </p>
      <p className={`text-sm font-medium break-words ${theme.cellPrimary}`}>
        {value || "—"}
      </p>
    </div>
  );
}

export default function TripScheduleTable({
  trips = [],
  conflicts = [],
  isDark = false,
  onOpenTripSchedule,
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const itemsPerPage = 5;
  const theme = getTableTheme(isDark);
  const themeRow = getRowThemeClasses(isDark);
  const overviewTheme = getOverviewThemeClasses(isDark);

  const hasTripConflict = (trip) => {
    return conflicts.some(
      (item) =>
        item.currentTrip?.id === trip.id ||
        item.nextTrip?.id === trip.id ||
        item.currentTrip?.tripId === trip.tripId ||
        item.nextTrip?.tripId === trip.tripId,
    );
  };

  const filteredTrips = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return trips.filter((trip) => {
      const truckLabel = String(getTripTruckLabel(trip) || "").toLowerCase();
      const tripId = String(getTripDisplayId(trip) || "").toLowerCase();
      const departure = String(
        formatFirestoreDate(getTripDeparture(trip)) || "",
      ).toLowerCase();
      const eta = String(
        formatFirestoreDate(getTripEta(trip)) || "",
      ).toLowerCase();
      const loadingStart = String(
        formatFirestoreDate(getPlannedLoadingStart(trip)) || "",
      ).toLowerCase();
      const loadingEnd = String(
        formatFirestoreDate(getPlannedLoadingEnd(trip)) || "",
      ).toLowerCase();

      const statusValue = String(trip.status || "").toUpperCase();
      if (!ALLOWED_STATUSES.includes(statusValue)) return false;

      const statusText = String(trip.status || "Scheduled").toLowerCase();
      const hasConflict = hasTripConflict(trip);

      const matchesSearch =
        !keyword ||
        truckLabel.includes(keyword) ||
        tripId.includes(keyword) ||
        departure.includes(keyword) ||
        eta.includes(keyword) ||
        loadingStart.includes(keyword) ||
        loadingEnd.includes(keyword) ||
        statusText.includes(keyword) ||
        (hasConflict && "conflict".includes(keyword));

      const matchesStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "CONFLICT"
            ? hasConflict
            : statusValue === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [trips, search, statusFilter, conflicts]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTrips.length / itemsPerPage),
  );
  const currentPage = Math.min(page, totalPages);

  const paginatedTrips = filteredTrips.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const emptyMessage =
    trips.length === 0
      ? "No trip schedules available."
      : "No matching trip schedules found.";

  return (
    <div
      className={`rounded-2xl overflow-hidden border shadow-xl backdrop-blur-sm mb-10 ${theme.container}`}
    >
      <div className={`px-4 sm:px-5 py-4 border-b ${theme.header}`}>
        <h3 className={`font-bold text-base sm:text-lg ${theme.headingText}`}>
          Schedule List
        </h3>
        <p className={`text-xs mt-1 ${theme.tableText}`}>
          Planned trip movement and loading schedule
        </p>
      </div>

      <div
        className={`px-4 sm:px-5 py-3 border-b flex flex-col lg:flex-row gap-3 ${theme.filters}`}
      >
        <div className="relative flex-1">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.inputIcon}`}
          />
          <input
            type="text"
            placeholder="Search truck, trip, time, or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none transition-colors ${theme.input}`}
          />
        </div>

        <div className="relative w-full lg:w-52">
          <FontAwesomeIcon
            icon={faFilter}
            className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.inputIcon}`}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none appearance-none cursor-pointer ${theme.input}`}
          >
            <option value="ALL">All Status</option>
            <option value="CONFLICT">Conflict</option>
            <option value="CREATED">Created</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="LOADED">Loaded</option>
            <option value="ARRIVED">Arrived</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className={theme.topDivider ? `border-t ${theme.topDivider}` : ""}>
        {paginatedTrips.length > 0 ? (
          <>
            {/* Mobile / Tablet Cards */}
            <div className="block lg:hidden p-3 sm:p-4 space-y-3">
              {paginatedTrips.map((trip) => {
                const hasConflict = hasTripConflict(trip);
                const statusLabel = trip.status || "Scheduled";

                return (
                  <div
                    key={trip.id || trip.tripId}
                    className={`rounded-2xl border p-4 shadow-sm ${theme.container} ${theme.rowHover}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-xs ${theme.cellSecondary}`}>
                          Truck
                        </p>
                        <h4
                          className={`font-bold text-sm sm:text-base ${theme.cellPrimary}`}
                        >
                          {getTripTruckLabel(trip) || "—"}
                        </h4>
                        {trip.driverName && (
                          <p className={`text-xs mt-1 ${theme.cellSecondary}`}>
                            Driver: {trip.driverName}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenTripSchedule(trip)}
                        className={`w-10 h-10 shrink-0 rounded-xl inline-flex items-center justify-center transition-all ${themeRow.actionButton}`}
                        title="Edit Schedule"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={`text-[10px] uppercase tracking-wide ${theme.cellSecondary}`}
                        >
                          Trip
                        </p>
                        <p
                          className={`text-sm font-semibold ${theme.cellPrimary}`}
                        >
                          {getTripDisplayId(trip) || "—"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusBadge status={statusLabel} isDark={isDark} />
                        {hasConflict && (
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-[10px] border ${theme.statusInactive}`}
                          >
                            Conflict
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <div
                        className={`rounded-2xl border px-4 py-3 ${overviewTheme.overviewStatCard}`}
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {/* Departure */}
                          <div>
                            <div
                              className={`text-[11px] uppercase font-semibold ${overviewTheme.overviewTinyMuted}`}
                            >
                              Departure
                            </div>
                            <div
                              className={`mt-2 text-sm font-semibold ${overviewTheme.strongText}`}
                            >
                              {formatFirestoreDate(getTripDeparture(trip)) ||
                                "—"}
                            </div>
                          </div>

                          {/* ETA */}
                          <div>
                            <div
                              className={`text-[11px] uppercase font-semibold ${overviewTheme.overviewTinyMuted}`}
                            >
                              ETA
                            </div>
                            <div
                              className={`mt-2 text-sm font-semibold ${overviewTheme.strongText}`}
                            >
                              {formatFirestoreDate(getTripEta(trip)) || "—"}
                            </div>
                          </div>

                          {/* Loading Start */}
                          <div>
                            <div
                              className={`text-[11px] uppercase font-semibold ${overviewTheme.overviewTinyMuted}`}
                            >
                              Loading
                            </div>
                            <div
                              className={`mt-2 text-sm font-semibold ${overviewTheme.strongText}`}
                            >
                              {formatFirestoreDate(
                                getPlannedLoadingStart(trip),
                              ) || "—"}
                            </div>
                          </div>

                          {/* Loading End */}
                          {/* <div>
                            <div
                              className={`text-[11px] uppercase font-semibold ${overviewTheme.overviewTinyMuted}`}
                            >
                              Loading End
                            </div>
                            <div
                              className={`mt-2 text-sm font-semibold ${overviewTheme.strongText}`}
                            >
                              {formatFirestoreDate(
                                getPlannedLoadingEnd(trip),
                              ) || "—"}
                            </div>
                          </div> */}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className={`w-full text-sm ${theme.tableText}`}>
                <thead className={theme.thead}>
                  <tr>
                    <th className="text-left px-4 py-3 text-[11px] uppercase font-bold">
                      Truck
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase font-bold">
                      Trip
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase font-bold">
                      Departure
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase font-bold">
                      Arrival
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase font-bold">
                      Loading
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase font-bold">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] uppercase font-bold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className={`divide-y ${theme.tbodyDivide}`}>
                  {paginatedTrips.map((trip) => {
                    const hasConflict = hasTripConflict(trip);
                    const statusLabel = trip.status || "Scheduled";

                    return (
                      <tr
                        key={trip.id || trip.tripId}
                        className={`transition-colors ${theme.rowHover}`}
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="space-y-1">
                            <div className={`font-bold ${theme.cellPrimary}`}>
                              {getTripTruckLabel(trip)}
                            </div>
                            {trip.driverName && (
                              <div className={`text-xs ${theme.cellSecondary}`}>
                                {trip.driverName}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <div className="space-y-1">
                            <div
                              className={`font-semibold ${theme.cellPrimary}`}
                            >
                              {getTripDisplayId(trip)}
                            </div>
                            {/* <div className={`text-xs ${theme.cellSecondary}`}>
                              {trip.status || "Scheduled"}
                            </div> */}
                          </div>
                        </td>

                        {/* Departure */}
                        <td className="px-4 py-3 align-top">
                          <div className="text-sm font-medium">
                            {formatFirestoreDate(getTripDeparture(trip)) || "—"}
                          </div>
                        </td>

                        {/* Arrival */}
                        <td className="px-4 py-3 align-top">
                          <div className="text-sm font-medium">
                            {formatFirestoreDate(getTripEta(trip)) || "—"}
                          </div>
                        </td>

                        {/* Loading */}
                        <td className="px-4 py-3 align-top">
                          <div className="text-xs leading-tight">
                            <div>
                              {formatFirestoreDate(
                                getPlannedLoadingStart(trip),
                              ) || "—"}
                            </div>
                            {/* <div>
                              <span className="font-semibold">End:</span>{" "}
                              {formatFirestoreDate(
                                getPlannedLoadingEnd(trip),
                              ) || "—"}
                            </div> */}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={statusLabel} isDark={isDark} />
                            {hasConflict && (
                              <span
                                className={`inline-flex px-2 py-1 rounded-full text-[10px] border ${theme.statusInactive}`}
                              >
                                Conflict
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => onOpenTripSchedule(trip)}
                            className={`w-9 h-9 rounded-xl inline-flex items-center justify-center transition-all ${themeRow.actionButton}`}
                            title="Edit Schedule"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className={`px-4 py-10 text-center text-sm ${theme.emptyText}`}>
            {emptyMessage}
          </div>
        )}
      </div>

      {filteredTrips.length > 0 && (
        <div
          className={`px-4 sm:px-5 py-4 border-t flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-xs ${theme.footer}`}
        >
          <span className="text-center sm:text-left">
            Showing{" "}
            <span className={`font-bold ${theme.footerBold}`}>
              {Math.min(currentPage * itemsPerPage, filteredTrips.length)}
            </span>{" "}
            of {filteredTrips.length}
          </span>

          <div className="flex items-center justify-center sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-2 rounded-xl border disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>

            <span className={`text-xs font-medium px-2 ${theme.footerBold}`}>
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-2 rounded-xl border disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
            >
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
