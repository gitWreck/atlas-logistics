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
} from "@fortawesome/free-solid-svg-icons";
import ShipmentRow from "../ShipmentRow";
import ShipmentDrawer from "../ShipmentDrawer";
import ReceivePackageForm from "../ReceivePackageForm"; // This replaces ShipmentNewModal

import { auth } from "@/lib/firebase";
import { calculateProgress } from "@/app/utility/utilities";

export default function ShipmentBoard({ userRole }) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & Drawer State
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState(null);

  // Search & Filter State
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

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

      // 1. Call your new Next.js API
      const res = await fetch("/api/shipments", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // <--- THIS WAS MISSING
        },
        cache: "no-store", // Ensure we always get fresh data
      });

      if (!res.ok) {
        const errorData = await res.json(); // Read the JSON response
        console.error("SERVER ERROR DETAILS:", errorData); // Log object to console
        throw new Error(errorData.details || errorData.error || "Server Error");
      }

      const data = await res.json();
      console.log("data: ", data);

      // 2. Final UI Formatting
      const formatted = data.shipments.map((s) => ({
        ...s,
        progress: calculateProgress(s.status),
      }));

      setShipments(formatted);
    } catch (err) {
      console.error("FULL ERROR:", err); // Now this prints the real reason
      alert(`Error: ${err.message}`); // Optional: Show user
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  // --- 2. LOGIC ---
  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      // Search Logic: Tracking, Sender Name, Recipient Name
      const searchContent = [
        s.trackingNumber,
        s.sender?.name,
        s.recipient?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchContent.includes(searchQuery.toLowerCase())) return false;

      // Filter Logic
      if (activeFilter === "ALL") return true;
      if (activeFilter === "ACTIVE") return s.status !== "DELIVERED";
      if (activeFilter === "DELAYED") return s.status === "DELAYED"; // Or check delay flags
      if (activeFilter === "DELIVERED") return s.status === "DELIVERED";

      return true;
    });
  }, [searchQuery, activeFilter, shipments]);

  const selectedShipment = shipments.find((s) => s.id === selectedShipmentId);

  // --- 3. ACTIONS ---
  const handleMessageCustomer = (shipment) => {
    const phone = shipment.sender?.phone || shipment.recipient?.phone;
    alert(`Logic to SMS ${phone} for Order ${shipment.trackingNumber}`);
  };

  const handleSuccess = () => {
    fetchShipments();
  };

  console.log("selected shipments: ", selectedShipment);

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
            {/* Admin Actions */}
            {userRole === "admin" && (
              <button className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white">
                <FontAwesomeIcon icon={faFileCsv} />
              </button>
            )}

            {/* NEW ORDER BUTTON */}
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
        {/* TABLE CARD */}
        <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden shadow-xl backdrop-blur-sm">
          {/* CARD HEADER: Search & Filters (Aligned like PackageTable) */}
          <div className="px-6 py-4 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-950/30">
            <h3 className="font-bold text-white whitespace-nowrap hidden md:block">
              Recent Orders
            </h3>

            <div className="flex gap-2 w-full md:w-auto">
              {/* Search */}
              <div className="relative flex-1 md:w-64">
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

              {/* Filter Dropdown */}
              <div className="relative w-40">
                <FontAwesomeIcon
                  icon={faFilter}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
                />
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-blue-500 focus:outline-none appearance-none"
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                >
                  <option value="ALL">All View</option>
                  <option value="ACTIVE">Active</option>
                  <option value="DELAYED">Delayed</option>
                  <option value="DELIVERED">Delivered</option>
                </select>
              </div>
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

          {/* TABLE BODY */}
          <div>
            {loading ? (
              <div className="p-10 text-center text-slate-500 animate-pulse">
                Loading orders...
              </div>
            ) : filteredShipments.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                No orders found.
              </div>
            ) : (
              filteredShipments.map((s) => (
                <ShipmentRow
                  key={s.id}
                  s={s}
                  onClick={setSelectedShipmentId}
                  onMessage={() => handleMessageCustomer(s)}
                />
              ))
            )}
          </div>
        </div>
      </main>

      {/* --- DRAWER --- */}
      <ShipmentDrawer
        isOpen={!!selectedShipmentId}
        onClose={() => setSelectedShipmentId(null)}
        data={selectedShipment}
      />

      {/* --- NEW ORDER MODAL (Reusing ReceiveForm) --- */}
      <ReceivePackageForm
        isOpen={isNewOrderModalOpen}
        onClose={setIsNewOrderModalOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
