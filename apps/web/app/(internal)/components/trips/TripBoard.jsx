"use client";
import React, { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
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

const TripBoard = forwardRef(function TripBoard({ user, userRole, profile, isDark = false }, ref) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & Drawer State
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState(null);

  // Search & Filter State
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      // const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();

      // Change this to your actual API endpoint for trips
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
      const formatted = data.trips.map((t) => ({
        ...t,
        progress: calculateProgress(t.status),
      }));

      setTrips(formatted || []);
    } catch (err) {
      console.error("Error fetching trips:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  // --- FILTER LOGIC ---
  const filteredTrips = useMemo(() => {
    setCurrentPage(1); // Reset page on filter change

    return trips.filter((t) => {
      // 1. Search (ID, Driver, Plate)
      const searchContent = [
        t.tripId,
        t.driverName,
        t.truckPlateNumber,
        t.route,
        t.tripType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchContent.includes(searchQuery.toLowerCase())) return false;

      // 2. Date Range (createdAt or startedAt)
      if (startDate || endDate) {
        const tripDate = t.createdAt?._seconds
          ? new Date(t.createdAt._seconds * 1000)
          : new Date(t.createdAt);

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

      // 3. Status Filter
      if (activeFilter !== "ALL") {
        if (activeFilter === "ACTIVE")
          return ["IN_TRANSIT", "LOADED"].includes(t.status);

        if (activeFilter === "DELAYED") return t.delayCleared === false;

        if (activeFilter === "COMPLETED") return t.status === "COMPLETED";
      }

      // 4. NEW: Trip Type Filter
      if (typeFilter !== "ALL") {
        if (t.tripType !== typeFilter) return false;
      }

      return true;
    });
  }, [searchQuery, activeFilter, typeFilter, trips, startDate, endDate]);

  // --- PAGINATION ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTrips.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTrips.length / itemsPerPage);

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  useImperativeHandle(ref, () => ({
    openCreateTripModal: () => setIsNewTripModalOpen(true),
  }), []);

  return (
    <div
      className={`min-h-screen font-sans ${
        isDark ? "bg-slate-950 text-slate-200" : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* --- CONTENT --- */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div
          className={`rounded-xl overflow-hidden shadow-xl backdrop-blur-sm border ${
            isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"
          }`}
        >
          {/* CONTROLS */}
          <div
            className={`px-4 sm:px-6 py-4 border-b flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 ${
              isDark
                ? "border-slate-800 bg-slate-950/30"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <h3
              className={`font-bold whitespace-nowrap hidden xl:flex items-center gap-2 ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Active Manifests
              <button
                onClick={fetchTrips}
                disabled={loading}
                className={`transition-colors p-1 rounded ${
                  isDark
                    ? "text-slate-500 hover:text-white hover:bg-slate-800"
                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                }`}
                title="Refresh"
              >
                <FontAwesomeIcon icon={faSync} spin={loading} className="text-xs" />
              </button>
            </h3>

            {/* Filter Container - Stack on mobile, Row on Desktop */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full xl:w-auto">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <FontAwesomeIcon
                  icon={faSearch}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
                />
                <input
                  type="text"
                  placeholder="Search Trip ID..."
                  className={`w-full rounded-lg pl-9 pr-4 py-2 text-sm focus:border-emerald-500 focus:outline-none border ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                {/* Date Picker (Scrollable on very small screens) */}
                <div
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 flex-1 sm:flex-none justify-center border ${
                    isDark
                      ? "bg-slate-900 border-slate-700"
                      : "bg-white border-slate-300"
                  }`}
                >
                  <input
                    type="date"
                    className={`bg-transparent text-xs outline-none w-24 ${
                      isDark
                        ? "text-white [color-scheme:dark]"
                        : "text-slate-900 [color-scheme:light]"
                    }`}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="date"
                    className={`bg-transparent text-xs outline-none w-24 ${
                      isDark
                        ? "text-white [color-scheme:dark]"
                        : "text-slate-900 [color-scheme:light]"
                    }`}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                {/* Type Filter (NEW) */}
                <div className="relative w-full sm:w-40">
                  <FontAwesomeIcon
                    icon={faRoute}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
                  />
                  <select
                    className={`w-full rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none appearance-none cursor-pointer border ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white"
                        : "bg-white border-slate-300 text-slate-900"
                    }`}
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
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
                  />
                  <select
                    className={`w-full rounded-lg pl-9 pr-4 py-2 text-sm focus:border-emerald-500 focus:outline-none appearance-none cursor-pointer border ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white"
                        : "bg-white border-slate-300 text-slate-900"
                    }`}
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

          {/* TABLE: wrap header + body for horizontal scroll on smaller widths */}
          <div className="md:overflow-x-auto">
            <div className="md:min-w-[900px]">
              {/* TABLE HEADER (Hidden on Mobile) */}
              <div
                className={`hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b text-xs font-semibold uppercase tracking-wider ${
                  isDark
                    ? "border-slate-800 bg-slate-950 text-slate-500"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                <div className="col-span-3">Trip Info / Driver</div>
                <div className="col-span-2">Route</div>
                <div className="col-span-1">Stats</div>
                <div className="col-span-3">Progress</div>
                <div className="col-span-2">Update</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              {/* TABLE BODY */}
              <div className="min-h-[300px]">
                {loading ? (
                  <div className="p-10 text-center text-slate-600 animate-pulse">
                    Loading trips...
                  </div>
                ) : currentItems.length === 0 ? (
                  <div className="p-10 text-center text-slate-600">
                    No trips found.
                  </div>
                ) : (
                  currentItems.map((t) => (
                    <TripRow
                      key={t.id}
                      trip={t}
                      onClick={setSelectedTripId}
                      isDark={isDark}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* PAGINATION */}
          {/* ... (Your pagination code remains mostly the same, just ensure flex-wrap if needed) ... */}
          {filteredTrips.length > 0 && (
            <div
              className={`px-4 sm:px-6 py-4 border-t flex justify-between items-center ${
                isDark
                  ? "border-slate-800 bg-slate-950/30"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <span className="text-xs text-slate-600">
                Page{" "}
                <span
                  className={`font-bold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {currentPage}
                </span>{" "}
                of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- PLACEHOLDERS FOR DRAWER/MODAL --- */}
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
