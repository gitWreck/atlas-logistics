"use client";
import React, { useState, useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faPlus,
  faSync,
  faFilter,
  faRoute,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import TripRow from "./TripRow"; // <--- We will create this next
import { calculateProgress } from "@/app/utility/utilities";
import TripDrawer from "./TripDrawer";
import CreateTripModal from "../manifests/modals/CreateTripModal";

export default function TripBoard({ user, userRole, profile }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & Drawer State
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState(null);

  // Search & Filter State
  const [activeFilter, setActiveFilter] = useState("ALL");
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

        // Critical: "Delayed" logic based on our previous discussion
        if (activeFilter === "DELAYED") {
          // It is delayed if delayCleared is FALSE
          return t.delayCleared === false;
        }

        if (activeFilter === "COMPLETED") return t.status === "COMPLETED";
      }

      return true;
    });
  }, [searchQuery, activeFilter, trips, startDate, endDate]);

  // --- PAGINATION ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTrips.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTrips.length / itemsPerPage);

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* --- HEADER --- */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Title Section */}
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="h-10 w-10 bg-emerald-600/20 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
              <FontAwesomeIcon icon={faRoute} size="lg" />
            </div>
            <div className="flex-1">
              <h1 className="flex text-xl font-bold text-white tracking-tight gap-2 items-center">
                Trip Board
                <button
                  onClick={fetchTrips}
                  disabled={loading}
                  className="text-slate-500 hover:text-white transition-colors p-1"
                >
                  <FontAwesomeIcon
                    icon={faSync}
                    spin={loading}
                    className="text-xs"
                  />
                </button>
              </h1>
              <p className="text-xs text-slate-500 line-clamp-1">
                Manage truck assignments and routes.
              </p>
            </div>

            {/* Mobile Create Button (Visible only on small screens) */}
            <button
              onClick={() => setIsNewTripModalOpen(true)}
              className="sm:hidden bg-emerald-600 text-white h-10 w-10 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20"
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </div>

          {/* Desktop Create Button (Hidden on mobile) */}
          <button
            onClick={() => setIsNewTripModalOpen(true)}
            className="hidden sm:flex bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Create Trip</span>
          </button>
        </div>
      </div>

      {/* --- CONTENT --- */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden shadow-xl backdrop-blur-sm">
          {/* CONTROLS */}
          <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-slate-950/30">
            <h3 className="font-bold text-white whitespace-nowrap hidden xl:block">
              Active Manifests
            </h3>

            {/* Filter Container - Stack on mobile, Row on Desktop */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full xl:w-auto">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <FontAwesomeIcon
                  icon={faSearch}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
                />
                <input
                  type="text"
                  placeholder="Search Trip ID..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                {/* Date Picker (Scrollable on very small screens) */}
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 flex-1 sm:flex-none justify-center">
                  <input
                    type="date"
                    className="bg-transparent text-xs text-white outline-none w-24 [color-scheme:dark]"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className="text-slate-600">-</span>
                  <input
                    type="date"
                    className="bg-transparent text-xs text-white outline-none w-24 [color-scheme:dark]"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                {/* Status Filter */}
                <div className="relative w-full sm:w-40">
                  <FontAwesomeIcon
                    icon={faFilter}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
                  />
                  <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none appearance-none cursor-pointer"
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

          {/* TABLE HEADER (Hidden on Mobile) */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800 bg-slate-950 text-xs font-semibold text-slate-500 uppercase tracking-wider">
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
              <div className="p-10 text-center text-slate-500 animate-pulse">
                Loading trips...
              </div>
            ) : currentItems.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                No trips found.
              </div>
            ) : (
              currentItems.map((t) => (
                <TripRow key={t.id} trip={t} onClick={setSelectedTripId} />
              ))
            )}
          </div>

          {/* PAGINATION */}
          {/* ... (Your pagination code remains mostly the same, just ensure flex-wrap if needed) ... */}
          {filteredTrips.length > 0 && (
            <div className="px-4 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/30 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Page <span className="text-white font-bold">{currentPage}</span>{" "}
                of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 text-xs hover:text-white disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 text-xs hover:text-white disabled:opacity-50"
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
        // onAddShipment={() => setBulkModalOpen(true)}
        onRefreshTrips={fetchTrips}
      />
      <CreateTripModal
        isOpen={isNewTripModalOpen}
        onClose={() => setIsNewTripModalOpen(false)}
        onSuccess={fetchTrips}
      />
    </div>
  );
}
