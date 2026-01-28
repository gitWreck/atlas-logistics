"use client";
import React, { useState, useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faPlus,
  faSync,
  faFilter,
  faTruckFast,
  faFileCsv,
  faCalendarAlt, // Added
  faChevronLeft, // Added
  faChevronRight, // Added
  faExclamationCircle, // Added
} from "@fortawesome/free-solid-svg-icons";
import ShipmentRow from "./ShipmentRow";
import ShipmentDrawer from "./ShipmentDrawer";
import ReceivePackageForm from "./ReceivePackageForm";
import { auth } from "@/lib/firebase";
import {
  calculateProgress,
  formatFirestoreDate,
} from "@/app/utility/utilities";

export default function ShipmentBoard({ userRole }) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & Drawer State
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState(null);

  // Search & Filter State
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // --- NEW STATES ---
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [delayType, setDelayType] = useState("ALL"); // For specific delay reasons
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Change this number to show more/less rows

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* --- PAGE HEADER --- */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex gap-3">
              <div className="h-10 w-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500">
                <FontAwesomeIcon icon={faTruckFast} size="lg" />
              </div>
              <div>
                <h1 className="flex text-xl font-bold text-white tracking-tight gap-2">
                  Shipments / Orders
                  <button
                    onClick={fetchShipments}
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
                  Manage shipments and orders.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {userRole === "admin" && (
              <button className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white">
                <FontAwesomeIcon icon={faFileCsv} />
              </button>
            )}

            <button
              onClick={() => setIsNewOrderModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>New Order</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden shadow-xl backdrop-blur-sm">
          {/* CARD HEADER: Search & Filters */}
          <div className="px-6 py-4 border-b border-slate-800 flex flex-col xl:flex-row justify-between items-center gap-4 bg-slate-950/30">
            <h3 className="font-bold text-white whitespace-nowrap hidden xl:block">
              Recent Orders
            </h3>

            {/* CONTROL GROUP */}
            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
              {/* 1. SEARCH */}
              <div className="relative flex-1 min-w-[200px]">
                <FontAwesomeIcon
                  icon={faSearch}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
                />
                <input
                  type="text"
                  placeholder="Search Tracking, Name..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* 2. DATE FILTERS */}
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

              {/* 3. MAIN FILTER */}
              <div className="relative w-36">
                <FontAwesomeIcon
                  icon={faFilter}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
                />
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-blue-500 focus:outline-none appearance-none cursor-pointer"
                  value={activeFilter}
                  onChange={(e) => {
                    setActiveFilter(e.target.value);
                    setDelayType("ALL"); // Reset specific delay type if main filter changes
                  }}
                >
                  <option value="ALL">All View</option>
                  <option value="ACTIVE">Active</option>
                  <option value="DELAYED">Delayed</option>
                  <option value="DELIVERED">Delivered</option>
                </select>
              </div>

              {/* 4. CONDITIONAL: DELAY TYPE FILTER */}
              {activeFilter === "DELAYED" && (
                <div className="relative w-40 animate-in fade-in slide-in-from-right-2 duration-300">
                  <FontAwesomeIcon
                    icon={faExclamationCircle}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 text-sm"
                  />
                  <select
                    className="w-full bg-slate-900 border border-amber-500/50 rounded-lg pl-9 pr-4 py-2 text-sm text-amber-100 focus:border-amber-500 focus:outline-none appearance-none cursor-pointer"
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

          {/* TABLE HEADER */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800 bg-slate-950 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-4">Tracking / Customer</div>
            <div className="col-span-2">Route</div>
            <div className="col-span-3">Progress</div>
            <div className="col-span-2">Last Update</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          {/* TABLE BODY (Uses currentItems slice) */}
          <div className="min-h-[300px]">
            {loading ? (
              <div className="p-10 text-center text-slate-500 animate-pulse">
                Loading orders...
              </div>
            ) : filteredShipments.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                No orders found matching filters.
              </div>
            ) : (
              currentItems.map((s) => (
                <ShipmentRow
                  key={s.id}
                  s={s}
                  onClick={setSelectedShipmentId}
                  onMessage={() => handleMessageCustomer(s)}
                />
              ))
            )}
          </div>

          {/* 5. PAGINATION FOOTER */}
          {filteredShipments.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/30 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Showing{" "}
                <span className="text-white font-bold">
                  {indexOfFirstItem + 1}
                </span>{" "}
                to{" "}
                <span className="text-white font-bold">
                  {Math.min(indexOfLastItem, filteredShipments.length)}
                </span>{" "}
                of {filteredShipments.length}
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 text-xs hover:text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="mr-1" /> Prev
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 text-xs hover:text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next{" "}
                  <FontAwesomeIcon icon={faChevronRight} className="ml-1" />
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
      />

      <ReceivePackageForm
        isOpen={isNewOrderModalOpen}
        onClose={setIsNewOrderModalOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
