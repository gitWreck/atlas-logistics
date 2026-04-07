"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxesStacked,
  faChevronLeft,
  faChevronRight,
  faFilter,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";
import { getTableTheme } from "@/app/utility/constant/theme";
import { formatFirestoreDate } from "@/app/utility/utilities";
import {
  getTripDeparture,
  getTripDisplayId,
  getTripEta,
  getTripRoute,
  getTripShipmentCount,
  getTripTruckLabel,
} from "@/app/utility/tripScheduleHelpers";

export default function TruckScheduleTable({
  trips = [],
  conflicts = [],
  isDark = false,
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const itemsPerPage = 5;
  const theme = getTableTheme(isDark);

  const hasTripConflict = (trip) => {
    return conflicts.some(
      (item) =>
        item.currentTrip?.id === trip.id ||
        item.nextTrip?.id === trip.id ||
        item.currentTrip?.tripId === trip.tripId ||
        item.nextTrip?.tripId === trip.tripId,
    );
  };

  const getTripStatusValue = (trip) => {
    return String(trip.status || "").toUpperCase();
  };

  const filteredTrips = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return trips.filter((trip) => {
      const allowedStatuses = [
        "CREATED",
        "IN_TRANSIT",
        "COMPLETED",
        "ARRIVED",
        "CANCELLED",
      ];

      const truckLabel = String(getTripTruckLabel(trip) || "").toLowerCase();
      const tripId = String(getTripDisplayId(trip) || "").toLowerCase();
      const route = String(getTripRoute(trip) || "").toLowerCase();
      const departure = String(
        formatFirestoreDate(getTripDeparture(trip)) || "",
      ).toLowerCase();
      const eta = String(
        formatFirestoreDate(getTripEta(trip)) || "",
      ).toLowerCase();

      const statusValue = String(trip.status || "").toUpperCase();

      // hide rows not in allowed list
      if (!allowedStatuses.includes(statusValue)) {
        return false;
      }

      const statusText = String(trip.status || "Scheduled").toLowerCase();
      const hasConflict = hasTripConflict(trip);

      const matchesSearch =
        !keyword ||
        truckLabel.includes(keyword) ||
        tripId.includes(keyword) ||
        route.includes(keyword) ||
        departure.includes(keyword) ||
        eta.includes(keyword) ||
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
      ? "No truck-linked trip schedules available."
      : "No matching trip schedules found.";

  return (
    <div className={`rounded-2xl overflow-hidden border ${theme.container}`}>
      {/* Header */}
      <div className={`px-4 py-4 border-b ${theme.header}`}>
        <h3 className={`font-bold ${theme.headingText}`}>Schedule List</h3>
        <p className={`text-xs mt-1 ${theme.tableText}`}>
          Planned departure and estimated arrival per truck-assigned trip
        </p>
      </div>

      {/* Filters */}
      <div
        className={`px-4 py-3 border-b flex flex-col sm:flex-row gap-3 ${theme.filters}`}
      >
        <div className="relative flex-1">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className={`absolute left-3 top-2.5 ${theme.inputIcon}`}
          />
          <input
            type="text"
            placeholder="Search truck, trip, route, or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full border rounded-lg pl-8 pr-3 py-1.5 focus:border-blue-500 outline-none transition-colors ${theme.input}`}
          />
        </div>

        <div className="relative w-full sm:w-44">
          <FontAwesomeIcon
            icon={faFilter}
            className={`absolute left-3 top-2.5 ${theme.inputIcon}`}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`w-full border rounded-lg pl-8 pr-3 py-1.5 focus:border-blue-500 outline-none appearance-none cursor-pointer ${theme.input}`}
          >
            <option value="ALL">All Status</option>
            <option value="CONFLICT">Conflict</option>
            <option value="CREATED">Created</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="ARRIVED">Arrived</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={theme.topDivider ? `border-t ${theme.topDivider}` : ""}>
        <div className="overflow-x-auto">
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
                  Status
                </th>
              </tr>
            </thead>

            <tbody className={`divide-y ${theme.tbodyDivide}`}>
              {paginatedTrips.length > 0 ? (
                paginatedTrips.map((trip) => {
                  const hasConflict = hasTripConflict(trip);
                  const statusLabel = trip.status || "Scheduled";

                  return (
                    <tr
                      key={trip.id || trip.tripId}
                      className={`transition-colors ${theme.rowHover}`}
                    >
                      <td
                        className={`px-4 py-3 font-bold ${theme.cellPrimary}`}
                      >
                        {getTripTruckLabel(trip)}
                      </td>

                      <td className={`px-4 py-3 ${theme.cellSecondary}`}>
                        {getTripDisplayId(trip)}
                      </td>

                      <td className={`px-4 py-3 ${theme.cellSecondary}`}>
                        {getTripRoute(trip)}
                      </td>

                      <td className={`px-4 py-3 ${theme.cellPrimary}`}>
                        {formatFirestoreDate(getTripDeparture(trip))}
                      </td>

                      <td className={`px-4 py-3 ${theme.cellPrimary}`}>
                        {formatFirestoreDate(getTripEta(trip))}
                      </td>

                      <td className={`px-4 py-3 ${theme.cellSecondary}`}>
                        <div
                          className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border text-xs ${theme.countBadge}`}
                        >
                          <FontAwesomeIcon
                            icon={faBoxesStacked}
                            className="text-amber-500"
                          />
                          {getTripShipmentCount(trip)}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-[10px] border ${theme.roleBadge}`}
                          >
                            {statusLabel}
                          </span>

                          {hasConflict && (
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-[10px] border ${theme.statusInactive}`}
                            >
                              Conflict
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className={`px-4 py-8 text-center text-sm ${theme.emptyText}`}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredTrips.length > 0 && (
        <div
          className={`px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row justify-between items-center gap-3 text-xs ${theme.footer}`}
        >
          <span>
            Showing{" "}
            <span className={`font-bold ${theme.footerBold}`}>
              {Math.min(currentPage * itemsPerPage, filteredTrips.length)}
            </span>{" "}
            of {filteredTrips.length}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
            >
              <FontAwesomeIcon icon={faChevronLeft} className="mr-1" />
            </button>

            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
            >
              <FontAwesomeIcon icon={faChevronRight} className="ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
