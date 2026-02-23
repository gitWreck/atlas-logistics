"use client";
import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruck,
  faSync,
  faSearch,
  faFilter,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

import TruckRow from "./TruckRow";
import TruckStatus from "./TruckStatus";
import TruckModal from "./TruckModal";

const TruckBoard = forwardRef(function TruckBoard(
  { user, userRole, profile, isDark = false },
  ref,
) {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState(null);

  // Search & Pagination State
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchTrucks = async () => {
    try {
      setLoading(true);
      if (!user) return;
      const token = await user.getIdToken();

      // Change this to your actual API endpoint for trucks
      const res = await fetch("/api/trucks", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch trucks");

      const data = await res.json();
      setTrucks(data.trucks || []);
    } catch (err) {
      console.error("Error fetching trucks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrucks();
  }, []);

  // --- FILTER LOGIC ---
  const filteredTrucks = useMemo(() => {
    return trucks.filter((t) => {
      // 1. Search (Plate, Model, ID)
      const searchContent =
        `${t.plateNumber} ${t.model} ${t.truckId}`.toLowerCase();
      if (!searchContent.includes(searchQuery.toLowerCase())) return false;

      // 2. Status Filter
      if (activeFilter !== "ALL") {
        if (activeFilter === "ACTIVE" && t.status !== "ACTIVE") return false;
        if (activeFilter === "MAINTENANCE" && t.status !== "MAINTENANCE")
          return false;
        if (activeFilter === "OUT_OF_SERVICE" && t.status !== "OUT_OF_SERVICE")
          return false;
      }

      return true;
    });
  }, [searchQuery, activeFilter, trucks]);

  // --- PAGINATION LOGIC ---
  const totalPages = Math.ceil(filteredTrucks.length / itemsPerPage);
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTrucks.slice(start, start + itemsPerPage);
  }, [filteredTrucks, currentPage]);

  const openEditModal = (truck) => {
    setEditingTruck(truck);
    setIsModalOpen(true);
  };

  useImperativeHandle(ref, () => ({
    openRegisterModal: () => {
      setEditingTruck(null);
      setIsModalOpen(true);
    },
  }), []);

  return (
    <div
      className={`min-h-screen font-sans ${
        isDark ? "bg-slate-950 text-slate-200" : "bg-slate-50 text-slate-900"
      }`}
    >
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Statistics Cards */}
        <TruckStatus trucks={trucks} isDark={isDark} />

        <div
          className={`border rounded-xl overflow-hidden shadow-xl backdrop-blur-sm ${
            isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"
          }`}
        >
          {/* CONTROLS */}
          <div
            className={`px-4 sm:px-6 py-4 border-b flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 ${
              isDark
                ? "border-slate-800 bg-slate-950/30"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            {/* Search + Refresh */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-96">
                <FontAwesomeIcon
                  icon={faSearch}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                />
                <input
                  type="text"
                  placeholder="Search plate or model..."
                  className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 outline-none transition-all ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                onClick={fetchTrucks}
                disabled={loading}
                className={`transition-colors p-2 rounded shrink-0 ${
                  isDark
                    ? "text-slate-500 hover:text-white hover:bg-slate-800"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                }`}
                title="Refresh"
              >
                <FontAwesomeIcon
                  icon={faSync}
                  spin={loading}
                  className="text-sm"
                />
              </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-48">
                <FontAwesomeIcon
                  icon={faFilter}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                />
                <select
                  className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 outline-none appearance-none cursor-pointer ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                >
                  <option value="ALL">All Trucks</option>
                  <option value="ACTIVE">Active</option>
                  <option value="MAINTENANCE">In Shop</option>
                  <option value="OUT_OF_SERVICE">Retired</option>
                </select>
              </div>
            </div>
          </div>

          <div
            className={`border-t ${
              isDark ? "border-slate-800/50" : "border-slate-200"
            }`}
          >
            {/* TABLE: wrap header + body for horizontal scroll on smaller widths */}
            <div className="md:overflow-x-auto">
              <div className="md:min-w-[900px]">
                {/* TABLE HEADER (Hidden on Mobile) */}
                <div
                  className={`hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b text-[10px] font-bold uppercase tracking-widest ${
                    isDark
                      ? "border-slate-800 bg-slate-950 text-slate-500"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  <div className="col-span-4">Truck / Model</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-3">PMS Health</div>
                  <div className="col-span-2">Details</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>

                {/* TABLE BODY */}
                <div
                  className={`min-h-[400px] divide-y ${
                    isDark ? "divide-slate-800/50" : "divide-slate-200"
                  }`}
                >
                  {loading ? (
                    <div className="flex flex-col items-center justify-center p-20 space-y-4">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <p
                        className={`text-sm animate-pulse ${
                          isDark ? "text-slate-500" : "text-slate-600"
                        }`}
                      >
                        Fetching fleet data...
                      </p>
                    </div>
                  ) : currentItems.length === 0 ? (
                    <div className="p-20 text-center">
                      <FontAwesomeIcon
                        icon={faTruck}
                        className={`text-4xl mb-4 ${
                          isDark ? "text-slate-800" : "text-slate-200"
                        }`}
                      />
                      <p
                        className={`italic ${
                          isDark ? "text-slate-500" : "text-slate-600"
                        }`}
                      >
                        No trucks found.
                      </p>
                    </div>
                  ) : (
                    currentItems.map((truck) => (
                      <TruckRow
                        key={truck.id}
                        truck={truck}
                        onEdit={() => openEditModal(truck)}
                        isDark={isDark}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* PAGINATION */}
          {filteredTrucks.length > itemsPerPage && (
            <div
              className={`px-4 sm:px-6 py-4 border-t flex justify-between items-center ${
                isDark
                  ? "border-slate-800 bg-slate-950/30"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <span
                className={`text-xs ${
                  isDark ? "text-slate-500" : "text-slate-600"
                }`}
              >
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
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 transition-colors ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="mr-1" /> Prev
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 transition-colors ${
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Next{" "}
                  <FontAwesomeIcon icon={faChevronRight} className="ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <TruckModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editingTruck}
        onRefresh={fetchTrucks}
        isDark={isDark}
      />
    </div>
  );
});

export default TruckBoard;
