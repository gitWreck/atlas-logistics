"use client";
import React, { useState, useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faPlus,
  faSync,
  faFilter,
  faRoute,
  faCalendarAlt,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import TripRow from "./TripRow"; // <--- We will create this next
// import TripDrawer from "./TripDrawer"; // <--- You can create this later
// import CreateTripModal from "./CreateTripModal"; // <--- You can create this later
import { auth } from "@/lib/firebase";
import { calculateProgress } from "@/app/utility/utilities";
import TripDrawer from "./TripDrawer";
import CreateTripModal from "../manifests/modals/CreateTripModal";
import BulkAssignmentModal from "../manifests/modals/BulkAssignmentModal";

export default function TripBoard({ userRole }) {
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
      const user = auth.currentUser;
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
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex gap-3">
            <div className="h-10 w-10 bg-emerald-600/20 rounded-xl flex items-center justify-center text-emerald-500">
              <FontAwesomeIcon icon={faRoute} size="lg" />
            </div>
            <div>
              <h1 className="flex text-xl font-bold text-white tracking-tight gap-2">
                Trip Board
                <button
                  onClick={fetchTrips}
                  disabled={loading}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <FontAwesomeIcon
                    icon={faSync}
                    spin={loading}
                    className="text-xs"
                  />
                </button>
              </h1>
              <p className="text-xs text-slate-500">
                Manage truck assignments and routes.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsNewTripModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Create Trip</span>
          </button>
        </div>
      </div>

      {/* --- CONTENT --- */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden shadow-xl backdrop-blur-sm">
          {/* CONTROLS */}
          <div className="px-6 py-4 border-b border-slate-800 flex flex-col xl:flex-row justify-between items-center gap-4 bg-slate-950/30">
            <h3 className="font-bold text-white whitespace-nowrap hidden xl:block">
              Active Manifests
            </h3>

            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <FontAwesomeIcon
                  icon={faSearch}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
                />
                <input
                  type="text"
                  placeholder="Search Trip ID, Driver, Plate..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Date */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                <FontAwesomeIcon
                  icon={faCalendarAlt}
                  className="text-slate-500 text-xs ml-1"
                />
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

              {/* Filter */}
              <div className="relative w-40">
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
                  <option value="DELAYED">Has Issues (Delayed)</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>
          </div>

          {/* TABLE HEADER */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800 bg-slate-950 text-xs font-semibold text-slate-500 uppercase tracking-wider">
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
          {filteredTrips.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/30 flex justify-between items-center">
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
                  <FontAwesomeIcon icon={faChevronLeft} /> Prev
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 text-xs hover:text-white disabled:opacity-50"
                >
                  Next <FontAwesomeIcon icon={faChevronRight} />
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
