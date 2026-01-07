"use client";
import React, { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faPlus,
  faFileCsv,
  faCommentSms,
} from "@fortawesome/free-solid-svg-icons";
import ShipmentRow from "./ShipmentRow";
import ShipmentDrawer from "./ShipmentDrawer";

// Mock Data (Move to a separate data file later if you want)
const SHIPMENTS = [
  {
    id: "m1",
    tracking: "AT-20251212-DIVI-CAL-0001",
    route: "DIVI → CAL",
    routeCode: "DIVI-CAL",
    status: "IN_TRANSIT",
    delayReason: "WEATHER",
    delayCleared: false,
    trip: "T-18",
    owner: "Checker: Lean",
    lastUpdate: "20m ago",
    progress: 45,
  },
  {
    id: "m2",
    tracking: "AT-20251213-DIVI-TAB-0002",
    route: "DIVI → TAB",
    routeCode: "DIVI-TAB",
    status: "IN_TRANSIT",
    delayReason: null,
    trip: null,
    owner: "Manager: Rose",
    lastUpdate: "1h ago",
    progress: 30,
  },
  {
    id: "m3",
    tracking: "AT-20251214-DIVI-CAL-0004",
    route: "DIVI → CAL",
    routeCode: "DIVI-CAL",
    status: "ARRIVED_PORT",
    delayReason: "RORO",
    delayCleared: false,
    trip: "T-12",
    owner: "Checker: Rose",
    lastUpdate: "5m ago",
    progress: 60,
  },
  {
    id: "m4",
    tracking: "AT-20251215-DIVI-ODI-0011",
    route: "DIVI → ODI",
    routeCode: "DIVI-ODI",
    status: "OUT_FOR_DELIVERY",
    delayReason: null,
    trip: "T-07",
    owner: "Driver: Joven",
    lastUpdate: "Just now",
    progress: 90,
  },
  {
    id: "m5",
    tracking: "AT-20251210-DIVI-CAL-0009",
    route: "DIVI → CAL",
    routeCode: "DIVI-CAL",
    status: "DELIVERED",
    delayReason: null,
    trip: "T-03",
    owner: "Checker: Lean",
    lastUpdate: "1d ago",
    progress: 100,
  },
];

const FILTERS = [
  { key: "ALL", label: "All View" },
  { key: "ACTIVE", label: "Active" },
  { key: "DELAYED", label: "Delayed" },
  { key: "DELIVERED", label: "Delivered" },
];

export default function ShipmentBoard({ userRole = "ADMIN" }) {
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const filteredShipments = useMemo(() => {
    return SHIPMENTS.filter((s) => {
      const searchContent = (s.tracking + s.route + s.owner).toLowerCase();
      if (!searchContent.includes(searchQuery.toLowerCase())) return false;
      if (activeFilter === "ALL") return true;
      if (activeFilter === "ACTIVE") return s.status !== "DELIVERED";
      if (activeFilter === "DELAYED") return s.delayReason && !s.delayCleared;
      if (activeFilter === "DELIVERED") return s.status === "DELIVERED";
      return true;
    });
  }, [searchQuery, activeFilter]);

  const selectedShipment = SHIPMENTS.find((s) => s.id === selectedId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <h1 className="font-bold text-white tracking-wide text-lg">
              Shipments
            </h1>
          </div>

          <div className="flex flex-1 w-full md:w-auto gap-3 justify-end">
            <div className="relative flex-1 md:max-w-md">
              <span className="absolute left-3 top-2.5 text-slate-500">
                <FontAwesomeIcon icon={faSearch} />
              </span>
              <input
                type="text"
                placeholder="Search..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {/* Only Admins see CSV/SMS buttons */}
            {userRole === "ADMIN" && (
              <>
                <button className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white">
                  <FontAwesomeIcon icon={faFileCsv} />
                </button>
                <button className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white">
                  <FontAwesomeIcon icon={faCommentSms} />
                </button>
              </>
            )}
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <FontAwesomeIcon icon={faPlus} /> <span>New</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="max-w-7xl mx-auto mt-6 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
                activeFilter === f.key
                  ? "bg-blue-500/10 border-blue-500/50 text-blue-400"
                  : "bg-slate-900 border-slate-800 text-slate-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-4">Tracking / Signal</div>
            <div className="col-span-2">Route</div>
            <div className="col-span-3">Status Flow</div>
            <div className="col-span-2">Delay Info</div>
            <div className="col-span-1 text-right">Action</div>
          </div>
          <div>
            {filteredShipments.map((s) => (
              <ShipmentRow key={s.id} s={s} onClick={setSelectedId} />
            ))}
          </div>
        </div>
      </main>

      <ShipmentDrawer
        isOpen={!!selectedId}
        onClose={() => setSelectedId(null)}
        data={selectedShipment}
      />
    </div>
  );
}
