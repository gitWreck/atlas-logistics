"use client";
import React, { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruck,
  faPlus,
  faSync,
  faSearch,
  faFilter,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

// Components
import TruckRow from "./TruckRow";
import TruckStatus from "./TruckStatus"; // This uses your StatusCard internally
import TruckModal from "./TruckModal";

export default function TruckBoard({ user, userRole, profile }) {
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Title Section */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="h-10 w-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500 shadow-inner shrink-0">
              <FontAwesomeIcon icon={faTruck} size="lg" />
            </div>
            <div className="flex-1">
              <h1 className="flex text-xl font-bold text-white tracking-tight gap-2 items-center">
                Truck Board
                <button
                  onClick={fetchTrucks}
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
                Manage fleet health and availability.
              </p>
            </div>

            {/* Mobile Add Button */}
            <button
              onClick={() => {
                setEditingTruck(null);
                setIsModalOpen(true);
              }}
              className="sm:hidden bg-blue-600 text-white h-10 w-10 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20"
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </div>

          {/* Desktop Add Button */}
          <button
            onClick={() => {
              setEditingTruck(null);
              setIsModalOpen(true);
            }}
            className="hidden sm:flex bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold items-center gap-2 shadow-lg shadow-blue-500/20 transition-all"
          >
            <FontAwesomeIcon icon={faPlus} /> Register Truck
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Statistics Cards */}
        <TruckStatus trucks={trucks} />

        <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden shadow-xl backdrop-blur-sm">
          {/* CONTROLS */}
          <div className="px-4 sm:px-6 py-4 border-b border-slate-800 bg-slate-950/30 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            {/* Search */}
            <div className="relative w-full md:w-96">
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
              />
              <input
                type="text"
                placeholder="Search plate or model..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-blue-500 outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-48">
                <FontAwesomeIcon
                  icon={faFilter}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
                />
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-blue-500 outline-none appearance-none cursor-pointer"
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

          <div className="border-t border-slate-800/50">
            {/* TABLE HEADER (Hidden on Mobile) */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800 bg-slate-950 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <div className="col-span-4">Truck / Model</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3">PMS Health</div>
              <div className="col-span-2">Details</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            {/* TABLE BODY */}
            <div className="min-h-[400px] divide-y divide-slate-800/50">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-20 space-y-4">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-500 text-sm animate-pulse">
                    Fetching fleet data...
                  </p>
                </div>
              ) : currentItems.length === 0 ? (
                <div className="p-20 text-center">
                  <FontAwesomeIcon
                    icon={faTruck}
                    className="text-slate-800 text-4xl mb-4"
                  />
                  <p className="text-slate-500 italic">No trucks found.</p>
                </div>
              ) : (
                currentItems.map((truck) => (
                  <TruckRow
                    key={truck.id}
                    truck={truck}
                    onEdit={() => openEditModal(truck)}
                  />
                ))
              )}
            </div>
          </div>

          {/* PAGINATION */}
          {filteredTrucks.length > itemsPerPage && (
            <div className="px-4 sm:px-6 py-4 border-t border-slate-800 bg-slate-950/30 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Page <span className="text-white font-bold">{currentPage}</span>{" "}
                of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 text-xs hover:text-white disabled:opacity-50 transition-colors"
                >
                  <FontAwesomeIcon icon={faChevronLeft} className="mr-1" /> Prev
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 text-xs hover:text-white disabled:opacity-50 transition-colors"
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
      />
    </div>
  );
}
