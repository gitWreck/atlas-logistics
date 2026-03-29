"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faSync,
  faFilter,
  faChevronLeft,
  faChevronRight,
  faRoute,
} from "@fortawesome/free-solid-svg-icons";
import TripRow from "./TripRow";
import { calculateProgress } from "@/app/utility/utilities";
import TripDrawer from "./TripDrawer";
import CreateTripModal from "../manifests/modals/CreateTripModal";
import { getBoardThemeClasses } from "@/app/utility/constant/theme";

const TripBoard = forwardRef(function TripBoard(
  { user, userRole, profile, isDark = false },
  ref,
) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState(null);

  const [activeFilter, setActiveFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const theme = getBoardThemeClasses(isDark);

  const fetchTrips = async () => {
    try {
      setLoading(true);

      if (!user) return;

      const token = await user.getIdToken();

      const res = await fetch("/api/trips", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to fetch trips");

      const data = await res.json();

      const formatted = (data.trips || []).map((trip) => ({
        ...trip,
        progress: calculateProgress(trip.status),
      }));

      setTrips(formatted);
    } catch (err) {
      console.error("Error fetching trips:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      const searchContent = [
        trip.tripId,
        trip.driverName,
        trip.truckPlateNumber,
        trip.route,
        trip.tripType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchContent.includes(searchQuery.toLowerCase())) return false;

      if (startDate || endDate) {
        const tripDate = trip.createdAt?._seconds
          ? new Date(trip.createdAt._seconds * 1000)
          : new Date(trip.createdAt);

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (tripDate < start) return false;
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (tripDate > end) return false;
        }
      }

      if (activeFilter !== "ALL") {
        if (activeFilter === "ACTIVE") {
          return ["IN_TRANSIT", "LOADED"].includes(trip.status);
        }

        if (activeFilter === "DELAYED") {
          return trip.delayCleared === false;
        }

        if (activeFilter === "COMPLETED") {
          return trip.status === "COMPLETED";
        }
      }

      if (typeFilter !== "ALL" && trip.tripType !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [searchQuery, activeFilter, typeFilter, trips, startDate, endDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilter, typeFilter, startDate, endDate]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTrips.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTrips.length / itemsPerPage);

  const selectedTrip = trips.find((trip) => trip.id === selectedTripId);

  useImperativeHandle(
    ref,
    () => ({
      openCreateTripModal: () => setIsNewTripModalOpen(true),
    }),
    [],
  );

  return (
    <div className={`min-h-screen font-sans ${theme.page}`}>
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div
          className={`rounded-xl overflow-hidden shadow-xl backdrop-blur-sm border ${theme.board}`}
        >
          {/* Controls */}
          <div
            className={`px-4 sm:px-6 py-4 border-b flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 ${theme.header}`}
          >
            <h3
              className={`font-bold whitespace-nowrap hidden xl:flex items-center gap-2 ${theme.title}`}
            >
              Active Manifests
              <button
                type="button"
                onClick={fetchTrips}
                disabled={loading}
                className={`transition-colors p-1 rounded ${theme.refreshButton}`}
                title="Refresh"
              >
                <FontAwesomeIcon
                  icon={faSync}
                  spin={loading}
                  className="text-xs"
                />
              </button>
            </h3>

            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full xl:w-auto">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <FontAwesomeIcon
                  icon={faSearch}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.iconMuted}`}
                />
                <input
                  type="text"
                  placeholder="Search Trip ID..."
                  className={`w-full rounded-lg pl-9 pr-4 py-2 text-sm focus:border-emerald-500 focus:outline-none border ${theme.input}`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                {/* Date Range */}
                <div
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 flex-1 sm:flex-none justify-center border ${theme.filterWrap}`}
                >
                  <input
                    type="date"
                    className={`bg-transparent text-xs outline-none w-24 ${theme.dateInput}`}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className={theme.iconMuted}>-</span>
                  <input
                    type="date"
                    className={`bg-transparent text-xs outline-none w-24 ${theme.dateInput}`}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                {/* Type Filter */}
                <div className="relative w-full sm:w-40">
                  <FontAwesomeIcon
                    icon={faRoute}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.iconMuted}`}
                  />
                  <select
                    className={`w-full rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none appearance-none cursor-pointer border ${theme.input}`}
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="ALL">All Route Types</option>
                    <option value="TRANSFER">Transfers</option>
                    <option value="LOCAL">Local Pickups</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div className="relative w-full sm:w-40">
                  <FontAwesomeIcon
                    icon={faFilter}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.iconMuted}`}
                  />
                  <select
                    className={`w-full rounded-lg pl-9 pr-4 py-2 text-sm focus:border-emerald-500 focus:outline-none appearance-none cursor-pointer border ${theme.input}`}
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value)}
                  >
                    <option value="ALL">All Trips</option>
                    <option value="ACTIVE">In Transit</option>
                    <option value="DELAYED">Delayed</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
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

              <div className="min-h-[300px]">
                {loading ? (
                  <div
                    className={`p-10 text-center animate-pulse ${theme.emptyText}`}
                  >
                    Loading trips...
                  </div>
                ) : currentItems.length === 0 ? (
                  <div className={`p-10 text-center ${theme.emptyText}`}>
                    No trips found.
                  </div>
                ) : (
                  currentItems.map((trip) => (
                    <TripRow
                      key={trip.id}
                      trip={trip}
                      onClick={setSelectedTripId}
                      isDark={isDark}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Pagination */}
          {filteredTrips.length > 0 && (
            <div
              className={`px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row justify-between items-center gap-3 text-xs ${theme.footer}`}
            >
              <span className={theme.footerText}>
                Page{" "}
                <span className={`font-bold ${theme.footerStrong}`}>
                  {currentPage}
                </span>{" "}
                of {totalPages}
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <TripDrawer
        isOpen={!!selectedTripId}
        onClose={() => setSelectedTripId(null)}
        data={selectedTrip}
        onRefreshTrips={fetchTrips}
        isDark={isDark}
      />

      <CreateTripModal
        isOpen={isNewTripModalOpen}
        onClose={() => setIsNewTripModalOpen(false)}
        onSuccess={fetchTrips}
        isDark={isDark}
      />
    </div>
  );
});

export default TripBoard;
