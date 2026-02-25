"use client";
import React, { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faSync,
  faFilter,
  faTruckFast,
  faFileCsv,
  faCalendarAlt,
  faChevronLeft,
  faChevronRight,
  faExclamationCircle,
} from "@fortawesome/free-solid-svg-icons";
import ShipmentRow from "./ShipmentRow";
import ShipmentDrawer from "./ShipmentDrawer";
import ReceivePackageForm from "./ReceivePackageForm";
import { calculateProgress } from "@/app/utility/utilities";
import UnifiedShipmentModal from "./UnifiedShipmentModal";

const ShipmentBoard = forwardRef(function ShipmentBoard({ user, userRole, profile, isDark = false }, ref) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & Drawer State
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState(null);

  // Search & Filter State
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("ALL");

  // --- NEW STATES ---
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [delayType, setDelayType] = useState("ALL"); // For specific delay reasons
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Change this number to show more/less rows

  const fetchShipments = async () => {
    try {
      setLoading(true);
      // const user = auth.currentUser;

      if (!user) {
        console.error("User is not logged in yet.");
        setLoading(false);
        return;
      }
      const token = await user.getIdToken();

      const res = await fetch("/api/shipments", {
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

      const formatted = data.shipments.map((s) => ({
        ...s,
        progress: calculateProgress(s.status),
      }));

      setShipments(formatted);
    } catch (err) {
      console.error("FULL ERROR:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  // --- 2. UPDATED LOGIC (Includes Date & Delay Filter) ---
  const filteredShipments = useMemo(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);

    return shipments.filter((s) => {
      // A. Search Logic
      const searchContent = [
        s.trackingNumber,
        s.sender?.name,
        s.recipient?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchContent.includes(searchQuery.toLowerCase())) return false;

      // B. Date Range Logic (Checks createdAt or updatedAt)
      if (startDate || endDate) {
        const shipmentDate = s.createdAt?._seconds
          ? new Date(s.createdAt._seconds * 1000)
          : new Date(s.createdAt);

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (shipmentDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (shipmentDate > end) return false;
        }
      }

      // C. Status Filter Logic
      if (activeFilter !== "ALL") {
        if (activeFilter === "ACTIVE" && s.status === "DELIVERED") return false;
        if (activeFilter === "DELAYED") {
          if (s.status !== "DELAYED") return false;
          // D. Specific Delay Type Filter
          if (delayType !== "ALL" && s.delayReason !== delayType) return false;
        }
        if (activeFilter === "DELIVERED" && s.status !== "DELIVERED")
          return false;
      }

      // D. NEW: Shipment Mode Logic
      if (modeFilter !== "ALL") {
        // We know it's a home pickup if the initial status or current status includes 'PICKUP'
        // Or if the originCode equals the destinationCode (Local Collection)
        const isPickup =
          s.status === "PENDING_PICKUP" ||
          s.status === "PICKED_UP" ||
          (s.statusHistory &&
            s.statusHistory.some((h) => h.status.includes("PICKUP")));

        if (modeFilter === "PICKUP" && !isPickup) return false;
        if (modeFilter === "DROP_OFF" && isPickup) return false;
      }

      return true;
    });
  }, [searchQuery, activeFilter, shipments, startDate, endDate, delayType]);

  // --- 3. PAGINATION LOGIC ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredShipments.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  const totalPages = Math.ceil(filteredShipments.length / itemsPerPage);

  // --- Helpers ---
  // Get unique delay reasons for the dropdown
  const uniqueDelayReasons = useMemo(() => {
    const reasons = new Set(
      shipments
        .filter((s) => s.status === "DELAYED" && s.delayReason)
        .map((s) => s.delayReason),
    );
    return Array.from(reasons);
  }, [shipments]);

  const selectedShipment = shipments.find((s) => s.id === selectedShipmentId);

  const handleMessageCustomer = (shipment) => {
    const phone = shipment.sender?.phone || shipment.recipient?.phone;
    alert(`Logic to SMS ${phone} for Order ${shipment.trackingNumber}`);
  };

  const handleSuccess = () => {
    fetchShipments();
  };

  useImperativeHandle(ref, () => ({
    openCreateModal: () => setIsNewOrderModalOpen(true),
  }), []);

  return (
    <div className={`min-h-screen font-sans ${isDark ? "bg-slate-950 text-slate-200" : "bg-slate-50 text-slate-900"}`}>
      {/* --- MAIN CONTENT --- */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className={`border rounded-xl overflow-hidden shadow-xl backdrop-blur-sm ${
          isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"
        }`}>
          {/* CARD HEADER: Search & Filters */}
          <div className={`px-4 sm:px-6 py-4 border-b flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 ${
            isDark ? "border-slate-800 bg-slate-950/30" : "border-slate-200 bg-slate-50"
          }`}>
            <h3 className={`font-bold whitespace-nowrap hidden xl:flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
              Recent Orders
              <button
                onClick={fetchShipments}
                disabled={loading}
                className={`transition-colors p-1 rounded ${isDark ? "text-slate-500 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"}`}
                title="Refresh"
              >
                <FontAwesomeIcon icon={faSync} spin={loading} className="text-xs" />
              </button>
            </h3>

            {/* CONTROL GROUP */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full xl:w-auto">
              {/* 1. SEARCH */}
              <div className="relative flex-1 min-w-[200px]">
                <FontAwesomeIcon
                  icon={faSearch}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
                />
                <input
                  type="text"
                  placeholder="Search Tracking..."
                  className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none ${
                    isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                  }`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                {/* 2. DATE FILTERS */}
                <div className={`flex items-center gap-2 border rounded-lg px-2 py-1 flex-1 sm:flex-none justify-center ${
                  isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-300"
                }`}>
                  <input
                    type="date"
                    className={`bg-transparent text-xs outline-none w-24 ${isDark ? "text-white [color-scheme:dark]" : "text-slate-900 [color-scheme:light]"}`}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className={isDark ? "text-slate-600" : "text-slate-400"}>-</span>
                  <input
                    type="date"
                    className={`bg-transparent text-xs outline-none w-24 ${isDark ? "text-white [color-scheme:dark]" : "text-slate-900 [color-scheme:light]"}`}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                {/* NEW: Mode Filter */}
                <div className="relative w-full sm:w-36">
                  <FontAwesomeIcon
                    icon={faTruckFast} // Or faStore / faTruckPickup
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
                  />
                  <select
                    className={`w-full rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none appearance-none cursor-pointer border ${
                      isDark
                        ? "bg-slate-900 border-slate-700 text-white"
                        : "bg-white border-slate-300 text-slate-900"
                    }`}
                    value={modeFilter}
                    onChange={(e) => {
                      setModeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="ALL">All Modes</option>
                    <option value="DROP_OFF">Hub Drop-offs</option>
                    <option value="PICKUP">Home Pickups</option>
                  </select>
                </div>

                {/* 3. MAIN FILTER */}
                <div className="relative w-full sm:w-36">
                  <FontAwesomeIcon
                    icon={faFilter}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
                  />
                  <select
                    className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none appearance-none cursor-pointer ${
                      isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                    }`}
                    value={activeFilter}
                    onChange={(e) => {
                      setActiveFilter(e.target.value);
                      setDelayType("ALL");
                    }}
                  >
                    <option value="ALL">All View</option>
                    <option value="CREATED">Created</option>
                    <option value="ASSIGNED">Assigned</option>
                    <option value="IN_TRANSIT">In Transit</option>
                    <option value="DELAYED">Delayed</option>
                    <option value="DELIVERED">Delivered</option>
                  </select>
                </div>
              </div>

              {/* 4. CONDITIONAL: DELAY TYPE FILTER */}
              {activeFilter === "DELAYED" && (
                <div className="relative w-full sm:w-40 animate-in fade-in slide-in-from-right-2 duration-300">
                  <FontAwesomeIcon
                    icon={faExclamationCircle}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 text-sm"
                  />
                  <select
                    className={`w-full border border-amber-500/50 rounded-lg pl-9 pr-4 py-2 text-sm focus:border-amber-500 focus:outline-none appearance-none cursor-pointer ${
                      isDark ? "bg-slate-900 text-amber-100" : "bg-amber-50 text-amber-900"
                    }`}
                    value={delayType}
                    onChange={(e) => setDelayType(e.target.value)}
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

          {/* TABLE: wrap header + body for horizontal scroll on smaller widths */}
          <div className="md:overflow-x-auto">
            <div className="md:min-w-[900px]">
              {/* TABLE HEADER (Hidden on mobile) */}
              <div
                className={`hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b text-xs font-semibold uppercase tracking-wider ${
                  isDark
                    ? "border-slate-800 bg-slate-950 text-slate-500"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                <div className="col-span-4">Tracking / Customer</div>
                <div className="col-span-2">Route</div>
                <div className="col-span-3">Progress</div>
                <div className="col-span-2">Last Update</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              {/* TABLE BODY */}
              <div className="min-h-[300px]">
                {loading ? (
                  <div
                    className={`p-10 text-center animate-pulse ${
                      isDark ? "text-slate-500" : "text-slate-600"
                    }`}
                  >
                    Loading orders...
                  </div>
                ) : filteredShipments.length === 0 ? (
                  <div
                    className={`p-10 text-center ${
                      isDark ? "text-slate-500" : "text-slate-600"
                    }`}
                  >
                    No orders found matching filters.
                  </div>
                ) : (
                  currentItems.map((s) => (
                    <ShipmentRow
                      key={s.id}
                      s={s}
                      onClick={setSelectedShipmentId}
                      onMessage={() => handleMessageCustomer(s)}
                      isDark={isDark}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 5. PAGINATION FOOTER */}
          {filteredShipments.length > 0 && (
            <div className={`px-4 sm:px-6 py-4 border-t flex justify-between items-center ${
              isDark ? "border-slate-800 bg-slate-950/30" : "border-slate-200 bg-slate-50"
            }`}>
              <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}>
                Showing{" "}
                <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  {indexOfFirstItem + 1}
                </span>{" "}
                of {filteredShipments.length}
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 ${
                    isDark ? "border-slate-700 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800" : "border-slate-300 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 ${
                    isDark ? "border-slate-700 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800" : "border-slate-300 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <ShipmentDrawer
        isOpen={!!selectedShipmentId}
        onClose={() => setSelectedShipmentId(null)}
        data={selectedShipment}
        isDark={isDark}
      />

      <UnifiedShipmentModal
        profile={profile}
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        isDark={isDark}
      />
    </div>
  );
});

export default ShipmentBoard;
