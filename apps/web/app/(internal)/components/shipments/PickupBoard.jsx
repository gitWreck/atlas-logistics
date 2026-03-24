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
  faExclamationCircle,
} from "@fortawesome/free-solid-svg-icons";
import ShipmentRow from "./ShipmentRow";
import ShipmentDrawer from "./ShipmentDrawer";
import UnifiedShipmentModal from "./UnifiedShipmentModal";
import { calculateProgress } from "@/app/utility/utilities";

const PickupBoard = forwardRef(function PickupBoard(
  { user, profile, isDark = false },
  ref,
) {
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & Drawer State
  const [isNewPickupModalOpen, setIsNewPickupModalOpen] = useState(false);
  const [selectedPickupId, setSelectedPickupId] = useState(null);
  const [editingPickup, setEditingPickup] = useState(null); // ✅ NEW: Tracks which shipment is being edited

  // Search & Filter State
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [delayType, setDelayType] = useState("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // --- 1. DATA FETCHING ---
  const fetchPickups = async () => {
    try {
      setLoading(true);

      if (!user) {
        console.error("User is not logged in yet.");
        return;
      }

      const token = await user.getIdToken();

      // ✅ Calling a dedicated API that ONLY returns pickup requests
      const res = await fetch("/api/shipments/pickups", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || errorData.error || "Server Error");
      }

      const data = await res.json();

      const formatted = data.pickups.map((p) => ({
        ...p,
        progress: calculateProgress(p.status),
      }));

      setPickups(formatted);
    } catch (err) {
      console.error("Failed to fetch pickups:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPickups();
  }, [user]);

  // --- 2. FILTER LOGIC ---
  const filteredPickups = useMemo(() => {
    setCurrentPage(1); // Reset pagination on filter change

    return pickups.filter((p) => {
      // A. Search
      const searchContent = [
        p.trackingNumber,
        p.sender?.name,
        p.recipient?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchContent.includes(searchQuery.toLowerCase())) return false;

      // B. Date Range
      if (startDate || endDate) {
        const reqDate = p.createdAt?._seconds
          ? new Date(p.createdAt._seconds * 1000)
          : new Date(p.createdAt);

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (reqDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (reqDate > end) return false;
        }
      }

      // C. Status & Delay
      if (activeFilter !== "ALL") {
        if (activeFilter === "ACTIVE" && p.status === "DELIVERED") return false;

        if (activeFilter === "DELAYED") {
          if (p.status !== "DELAYED") return false;
          if (delayType !== "ALL" && p.delayReason !== delayType) return false;
        } else if (activeFilter !== "ACTIVE") {
          if (p.status !== activeFilter) return false;
        }
      }

      return true;
    });
  }, [searchQuery, activeFilter, pickups, startDate, endDate, delayType]);

  // --- 3. PAGINATION ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredPickups.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredPickups.length / itemsPerPage) || 1;

  // --- 4. HELPERS ---
  const uniqueDelayReasons = useMemo(() => {
    const reasons = new Set(
      pickups
        .filter((p) => p.status === "DELAYED" && p.delayReason)
        .map((p) => p.delayReason),
    );
    return Array.from(reasons);
  }, [pickups]);

  const selectedPickup = pickups.find((p) => p.id === selectedPickupId);

  useImperativeHandle(
    ref,
    () => ({
      openCreateModal: () => {
        setEditingPickup(null); // ✅ Ensure it opens in Create Mode
        setIsNewPickupModalOpen(true);
      },
    }),
    [],
  );

  return (
    <div
      className={`min-h-screen font-sans ${isDark ? "bg-slate-950 text-slate-200" : "bg-slate-50 text-slate-900"}`}
    >
      <main className="mx-auto p-4 sm:p-6">
        <div
          className={`border rounded-xl overflow-hidden shadow-xl backdrop-blur-sm ${isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"}`}
        >
          {/* --- HEADER & CONTROLS --- */}
          <div
            className={`px-4 sm:px-6 py-4 border-b flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 ${isDark ? "border-slate-800 bg-slate-950/30" : "border-slate-200 bg-slate-50"}`}
          >
            <h3
              className={`font-bold whitespace-nowrap hidden xl:flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Pickup Requests
              <button
                onClick={fetchPickups}
                disabled={loading}
                className={`transition-colors p-1 rounded ${isDark ? "text-slate-500 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"}`}
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
                  className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
                />
                <input
                  type="text"
                  placeholder="Search Tracking or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none ${isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"}`}
                />
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                {/* Date Filter */}
                <div
                  className={`flex items-center gap-2 border rounded-lg px-2 py-1 flex-1 sm:flex-none justify-center ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-300"}`}
                >
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`bg-transparent text-xs outline-none w-24 ${isDark ? "text-white [color-scheme:dark]" : "text-slate-900 [color-scheme:light]"}`}
                  />
                  <span
                    className={isDark ? "text-slate-600" : "text-slate-400"}
                  >
                    -
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`bg-transparent text-xs outline-none w-24 ${isDark ? "text-white [color-scheme:dark]" : "text-slate-900 [color-scheme:light]"}`}
                  />
                </div>

                {/* Status Filter */}
                <div className="relative w-full sm:w-40">
                  <FontAwesomeIcon
                    icon={faFilter}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
                  />
                  <select
                    value={activeFilter}
                    onChange={(e) => {
                      setActiveFilter(e.target.value);
                      setDelayType("ALL");
                    }}
                    className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none appearance-none cursor-pointer ${isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"}`}
                  >
                    <option value="ALL">All Pickups</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="PENDING_PICKUP">Pending</option>
                    <option value="PICKED_UP">Picked Up</option>
                    <option value="RECEIVED">At Hub</option>
                    <option value="IN_TRANSIT">In Transit</option>
                    <option value="DELIVERED">Completed</option>
                    <option value="DELAYED">Delayed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Conditional Delay Filter */}
              {activeFilter === "DELAYED" && (
                <div className="relative w-full sm:w-40 animate-in fade-in slide-in-from-right-2 duration-300">
                  <FontAwesomeIcon
                    icon={faExclamationCircle}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 text-sm"
                  />
                  <select
                    value={delayType}
                    onChange={(e) => setDelayType(e.target.value)}
                    className={`w-full border border-amber-500/50 rounded-lg pl-9 pr-4 py-2 text-sm focus:border-amber-500 focus:outline-none appearance-none cursor-pointer ${isDark ? "bg-slate-900 text-amber-100" : "bg-amber-50 text-amber-900"}`}
                  >
                    <option value="ALL">All Reasons</option>
                    {uniqueDelayReasons.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* --- TABLE AREA --- */}
          <div className="md:overflow-x-auto">
            <div className="md:min-w-[900px]">
              {/* Header Row */}
              <div
                className={`hidden md:grid grid-cols-13 gap-4 px-6 py-3 border-b text-xs font-semibold uppercase tracking-wider ${isDark ? "border-slate-800 bg-slate-950 text-slate-500" : "border-slate-200 bg-slate-50 text-slate-600"}`}
              >
                <div className="col-span-4">Tracking / Customer</div>
                <div className="col-span-2">Pickup Route</div>
                <div className="col-span-2">Details</div>
                <div className="col-span-3">Status</div>
                <div className="col-span-1">Last Update</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              {/* Body */}
              <div className="min-h-[300px]">
                {loading ? (
                  <div
                    className={`p-10 text-center animate-pulse ${isDark ? "text-slate-500" : "text-slate-600"}`}
                  >
                    Loading pickup requests...
                  </div>
                ) : filteredPickups.length === 0 ? (
                  <div
                    className={`p-10 text-center ${isDark ? "text-slate-500" : "text-slate-600"}`}
                  >
                    No pickup requests found.
                  </div>
                ) : (
                  currentItems.map((p) => (
                    <ShipmentRow
                      key={p.id}
                      s={p}
                      onClick={setSelectedPickupId}
                      isDark={isDark}
                      onEdit={() => {
                        setEditingPickup(p); // ✅ Pass the specific shipment data
                        setIsNewPickupModalOpen(true);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* --- PAGINATION FOOTER --- */}
          {filteredPickups.length > 0 && (
            <div
              className={`px-4 sm:px-6 py-4 border-t flex justify-between items-center ${isDark ? "border-slate-800 bg-slate-950/30" : "border-slate-200 bg-slate-50"}`}
            >
              <span
                className={`text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}
              >
                Showing{" "}
                <span
                  className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  {indexOfFirstItem + 1}
                </span>{" "}
                to{" "}
                <span
                  className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  {Math.min(indexOfLastItem, filteredPickups.length)}
                </span>{" "}
                of {filteredPickups.length}
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 ${isDark ? "border-slate-700 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800" : "border-slate-300 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 ${isDark ? "border-slate-700 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800" : "border-slate-300 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- DRAWERS & MODALS --- */}
      <ShipmentDrawer
        isOpen={!!selectedPickupId}
        onClose={() => setSelectedPickupId(null)}
        data={selectedPickup}
        isDark={isDark}
        onRefresh={fetchPickups}
      />

      <UnifiedShipmentModal
        profile={profile}
        isOpen={isNewPickupModalOpen}
        onClose={() => {
          setIsNewPickupModalOpen(false);
          setEditingPickup(null); // ✅ Clear data on close
        }}
        isDark={isDark}
        user={user}
        onSuccess={() => {
          fetchPickups();
          setEditingPickup(null); // ✅ Clear data on success
        }}
        resetTrigger={isNewPickupModalOpen}
        editData={editingPickup} // ✅ Pass the data down to trigger Update Mode
      />
    </div>
  );
});

export default PickupBoard;
