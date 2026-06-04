"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import TripRow from "./TripRow";
import { getBoardThemeClasses } from "@/app/utility/constant/theme";
import TablePaginationFooter from "../ui/TablePaginationFooter";

export default function CompletedTripsTable({
  trips = [],
  loading = false,
  isDark = false,
  profile,
  completedTripLimit = "50",
  onCompletedTripLimitChange,
  onSelectTrip,
  onDeleted,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const itemsPerPage = 10;
  const theme = getBoardThemeClasses(isDark);

  const filteredTrips = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return trips;

    return trips.filter((trip) => {
      const searchContent = [
        trip.tripId,
        trip.driverName,
        trip.truckPlateNumber,
        trip.route,
        trip.tripType,
        trip.origin,
        trip.destination,
        trip.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchContent.includes(query);
    });
  }, [searchQuery, trips]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTrips.length / itemsPerPage),
  );

  const currentItems = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return filteredTrips.slice(indexOfFirstItem, indexOfLastItem);
  }, [currentPage, filteredTrips]);

  useEffect(() => {
    setCurrentPage(1);
  }, [completedTripLimit, filteredTrips]);

  return (
    <div
      className={`rounded-xl overflow-hidden shadow-xl backdrop-blur-sm border ${theme.board}`}
    >
      <div className={`px-4 sm:px-6 py-4 border-b ${theme.header}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <h3 className={`font-bold flex items-center gap-2 ${theme.title}`}>
            <FontAwesomeIcon
              icon={faCheckCircle}
              className="text-emerald-500"
            />
            Completed Trips
          </h3>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
            <div className="relative w-full sm:w-72">
              <FontAwesomeIcon
                icon={faSearch}
                className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.iconMuted}`}
              />
              <input
                type="text"
                placeholder="Search completed trips..."
                className={`w-full rounded-lg pl-9 pr-4 py-2 text-sm focus:border-emerald-500 focus:outline-none border ${theme.input}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${theme.pageBadge}`}
            >
              {filteredTrips.length} of {trips.length}
            </span>
          </div>
        </div>
      </div>

      <div className="md:overflow-x-auto">
        <div className="md:min-w-[900px]">
          <div
            className={`hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b text-xs font-semibold uppercase tracking-wider ${theme.tableHead}`}
          >
            <div className="col-span-3">Trip Info / Driver</div>
            <div className="col-span-2">Route</div>
            <div className="col-span-1">Stats</div>
            <div className="col-span-3">Progress</div>
            <div className="col-span-2">Update</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          <div className="min-h-[220px]">
            {loading ? (
              <div
                className={`p-10 text-center animate-pulse ${theme.emptyText}`}
              >
                Loading completed trips...
              </div>
            ) : currentItems.length === 0 ? (
              <div className={`p-10 text-center ${theme.emptyText}`}>
                {searchQuery.trim()
                  ? "No completed trips match your search."
                  : "No completed trips found."}
              </div>
            ) : (
              currentItems.map((trip) => (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  onClick={onSelectTrip}
                  onDeleted={onDeleted}
                  profile={profile}
                  isDark={isDark}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {filteredTrips.length > 0 && (
        <TablePaginationFooter
          totalItems={filteredTrips.length}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalPages={totalPages}
          limitValue={completedTripLimit}
          limitTitle="Limit completed trips"
          onLimitChange={onCompletedTripLimitChange}
          onPrevious={() =>
            setCurrentPage((page) => Math.max(1, page - 1))
          }
          onNext={() =>
            setCurrentPage((page) => Math.min(totalPages, page + 1))
          }
          theme={theme}
        />
      )}
    </div>
  );
}
