import React, { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faSync,
  faPlus,
  faLock,
  faScroll,
  faFilter,
  faCalendarAlt,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../ui/StatusBadge";

export default function TripsSidebar({
  trips,
  loading,
  selectedTripId,
  onSelectTrip,
  onRefresh,
  onCreateTrip,
}) {
  // --- STATE ---
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [filterDate, setFilterDate] = useState(""); // Single date for simplicity (or range)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // --- LOGIC ---
  const filtered = useMemo(() => {
    // 1. Reset Page on filter change
    setCurrentPage(1);

    return trips.filter((t) => {
      // A. Text Search
      const hay = [t.tripId, t.driverName, t.route, t.status]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;

      // B. Status Filter
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;

      // C. Date Filter (Assumes t.createdAt or t.tripDate exists)
      if (filterDate) {
        // Safe Date Parsing (Handle Firestore Timestamp or String)
        const tripDateVal = t.createdAt?._seconds
          ? t.createdAt._seconds * 1000
          : t.createdAt;
        if (!tripDateVal) return false;

        const tripDate = new Date(tripDateVal).toISOString().slice(0, 10);
        if (tripDate !== filterDate) return false;
      }

      return true;
    });
  }, [trips, search, statusFilter, filterDate]);

  // Pagination Slicing
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedTrips = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-xl backdrop-blur-sm h-full">
      {/* --- HEADER --- */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex flex-col gap-3">
        {/* Row 1: Title & Actions */}
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
            Trips{" "}
            <span className="text-slate-600 text-[10px] ml-1">
              ({filtered.length})
            </span>
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-2 py-1.5 rounded border transition-colors text-xs ${
                showFilters || statusFilter !== "ALL" || filterDate
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              }`}
            >
              <FontAwesomeIcon icon={faFilter} />
            </button>
            <button
              onClick={onCreateTrip}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
            >
              <FontAwesomeIcon icon={faPlus} /> New
            </button>
          </div>
        </div>

        {/* Row 2: Search Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3 top-2.5 text-slate-500 text-xs"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, Driver..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white focus:border-blue-500 outline-none transition-colors"
            />
          </div>
          <button
            onClick={onRefresh}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 px-3 rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={faSync} spin={loading} />
          </button>
        </div>

        {/* Row 3: Collapsible Filters (New) */}
        {showFilters && (
          <div className="grid grid-cols-2 gap-2 pt-1 animate-in slide-in-from-top-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg p-2 outline-none focus:border-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="PLANNED">Planned</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <div className="relative">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg p-2 outline-none focus:border-blue-500 [color-scheme:dark]"
              />
            </div>
          </div>
        )}
      </div>

      {/* --- LIST --- */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            Loading trips...
          </div>
        ) : paginatedTrips.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            No trips found.
          </div>
        ) : (
          paginatedTrips.map((t) => {
            const isActive = t.id === selectedTripId;
            const isLocked = t.manifestLocked;
            const isCert = !!t.certificate;

            return (
              <div
                key={t.id}
                onClick={() => onSelectTrip(t.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                  isActive
                    ? "bg-blue-600/10 border-blue-500/50 shadow-md shadow-blue-900/20"
                    : "bg-slate-900/40 border-slate-800/50 hover:bg-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span
                    className={`font-mono text-sm font-bold ${
                      isActive ? "text-blue-400" : "text-slate-200"
                    }`}
                  >
                    {t.tripId || "NO-ID"}
                  </span>
                  <div className="flex gap-1">
                    {isCert && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        <FontAwesomeIcon icon={faScroll} />
                      </span>
                    )}
                    {isLocked && (
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        <FontAwesomeIcon icon={faLock} />
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>{t.route || "No Route"}</span>
                  <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-400">
                    {t.totalItems || 0} Pkgs
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={t.status} reason={t.delayReason} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* --- FOOTER: PAGINATION (New) --- */}
      {filtered.length > itemsPerPage && (
        <div className="p-3 border-t border-slate-800 bg-slate-950/30 flex justify-between items-center text-xs">
          <span className="text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30"
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30"
            >
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
