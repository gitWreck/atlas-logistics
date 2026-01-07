"use client";
import React, { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faPlus,
  faFileCsv,
  faCommentSms,
  faTimes,
  faTruck,
  faShip,
  faExclamationTriangle,
  faCheckCircle,
  faEllipsisV,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

// --- MOCK DATA ---
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
    progress: 45, // % complete
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

export default function AtlasLoadBoard() {
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  // Derived Data
  const filteredShipments = useMemo(() => {
    return SHIPMENTS.filter((s) => {
      // 1. Text Search
      const searchContent = (s.tracking + s.route + s.owner).toLowerCase();
      if (!searchContent.includes(searchQuery.toLowerCase())) return false;

      // 2. Tab Filter
      if (activeFilter === "ALL") return true;
      if (activeFilter === "ACTIVE") return s.status !== "DELIVERED";
      if (activeFilter === "DELAYED") return s.delayReason && !s.delayCleared;
      if (activeFilter === "DELIVERED") return s.status === "DELIVERED";
      return true;
    });
  }, [searchQuery, activeFilter]);

  const selectedShipment = SHIPMENTS.find((s) => s.id === selectedId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      {/* --- TOP BAR --- */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Brand */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="font-bold text-white text-lg">A</span>
            </div>
            <div>
              <h1 className="font-bold text-white tracking-wide text-sm uppercase">
                Atlas Ops
              </h1>
              <p className="text-xs text-slate-500">Logistics Command</p>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex flex-1 w-full md:w-auto gap-3 justify-end">
            <div className="relative flex-1 md:max-w-md group">
              <span className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-blue-400 transition-colors">
                <FontAwesomeIcon icon={faSearch} />
              </span>
              <input
                type="text"
                placeholder="Search tracking, route, or driver..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <ActionButton icon={faFileCsv} label="CSV" />
              <ActionButton icon={faCommentSms} label="SMS" />
              <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2">
                <FontAwesomeIcon icon={faPlus} />
                <span className="hidden sm:inline">New Shipment</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="max-w-7xl mx-auto mt-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`
                px-4 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap
                ${
                  activeFilter === f.key
                    ? "bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }
              `}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {/* --- MAIN BOARD --- */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-4">Tracking / Signal</div>
            <div className="col-span-2">Route</div>
            <div className="col-span-3">Status Flow</div>
            <div className="col-span-2">Delay Info</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-slate-800/50">
            {filteredShipments.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No shipments found.
              </div>
            ) : (
              filteredShipments.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-800/30 transition-colors cursor-pointer group"
                >
                  {/* Col 1: ID & Pulse */}
                  <div className="col-span-4 flex items-center gap-4">
                    <StatusDot
                      status={s.status}
                      isDelayed={!!s.delayReason && !s.delayCleared}
                    />
                    <div>
                      <div className="font-mono text-sm font-medium text-slate-200 group-hover:text-blue-400 transition-colors">
                        {s.tracking}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={s.status} />
                        <span className="text-xs text-slate-500">
                          {s.owner}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Col 2: Route */}
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-slate-300">
                      {s.route}
                    </div>
                    <div className="text-xs text-slate-600 font-mono mt-0.5">
                      {s.routeCode}
                    </div>
                  </div>

                  {/* Col 3: Timeline (Mini) */}
                  <div className="col-span-3 pr-4">
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          s.status === "DELIVERED"
                            ? "bg-emerald-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${s.progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] text-blue-400 font-medium">
                        {s.status.replace("_", " ")}
                      </span>
                      <span className="text-[10px] text-slate-600">
                        {s.progress}%
                      </span>
                    </div>
                  </div>

                  {/* Col 4: Delay/Time */}
                  <div className="col-span-2">
                    {s.delayReason && !s.delayCleared ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                        <FontAwesomeIcon
                          icon={
                            s.delayReason === "WEATHER"
                              ? faExclamationTriangle
                              : faShip
                          }
                        />
                        {s.delayReason}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">
                        <span className="block text-slate-400">Updated</span>
                        {s.lastUpdate}
                      </div>
                    )}
                  </div>

                  {/* Col 5: Actions */}
                  <div className="col-span-1 text-right">
                    <button className="text-slate-500 hover:text-white p-2">
                      <FontAwesomeIcon icon={faEllipsisV} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* --- DRAWER (SLIDE OVER) --- */}
      <Drawer
        isOpen={!!selectedId}
        onClose={() => setSelectedId(null)}
        data={selectedShipment}
      />
    </div>
  );
}

// --- SUB-COMPONENTS ---

function ActionButton({ icon, label }) {
  return (
    <button className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700 transition-all flex items-center gap-2 text-xs font-medium">
      <FontAwesomeIcon icon={icon} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function StatusDot({ status, isDelayed }) {
  let color = "bg-blue-500";
  if (status === "DELIVERED") color = "bg-emerald-500";
  if (isDelayed) color = "bg-amber-500";

  return (
    <div className="relative flex items-center justify-center w-3 h-3">
      <span
        className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`}
      ></span>
      <span
        className={`relative inline-flex rounded-full h-2 w-2 ${color}`}
      ></span>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    IN_TRANSIT: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    DELIVERED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    DELAYED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    ARRIVED_PORT: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    OUT_FOR_DELIVERY: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };

  const defaultStyle = "bg-slate-800 text-slate-400 border-slate-700";

  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
        styles[status] || defaultStyle
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Drawer({ isOpen, onClose, data }) {
  if (!data) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={`
          fixed top-0 right-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 shadow-2xl transform transition-transform duration-300
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex justify-between items-start">
            <div>
              <h2 className="text-xl font-mono text-white font-bold">
                {data.tracking}
              </h2>
              <div className="flex gap-2 mt-2">
                <StatusBadge status={data.status} />
                <span className="text-xs text-slate-500 py-1">
                  {data.route}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <FontAwesomeIcon icon={faTimes} size="lg" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  Trip ID
                </div>
                <div className="text-slate-200 font-mono font-medium">
                  {data.trip || "—"}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  Driver
                </div>
                <div className="text-slate-200 font-medium truncate">
                  {data.owner}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  Owner
                </div>
                <div className="text-slate-200 font-medium truncate">
                  {data.owner}
                </div>
              </div>
            </div>

            {/* Timeline Section */}
            <div>
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faTruck} className="text-blue-500" />
                Shipment Progress
              </h3>
              <div className="space-y-6 relative pl-2">
                {/* Vertical Line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-800"></div>

                {/* Steps */}
                {[
                  "RECEIVED",
                  "LOADED",
                  "IN_TRANSIT",
                  "ARRIVED_PORT",
                  "DELIVERED",
                ].map((step, idx) => {
                  const isDone = idx * 25 <= data.progress; // crude logic for mock
                  return (
                    <div
                      key={step}
                      className="relative flex gap-4 items-center"
                    >
                      <div
                        className={`
                        relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px]
                        ${
                          isDone
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-slate-900 border-slate-700 text-slate-600"
                        }
                      `}
                      >
                        {isDone && <FontAwesomeIcon icon={faCheckCircle} />}
                      </div>
                      <div>
                        <div
                          className={`text-xs font-bold ${
                            isDone ? "text-slate-200" : "text-slate-600"
                          }`}
                        >
                          {step.replace("_", " ")}
                        </div>
                        {isDone && (
                          <div className="text-[10px] text-slate-500">
                            Completed
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delay Alert */}
            {data.delayReason && !data.delayCleared && (
              <div className="p-4 rounded-lg bg-amber-900/20 border border-amber-500/20 flex gap-3">
                <FontAwesomeIcon
                  icon={faExclamationTriangle}
                  className="text-amber-500 mt-1"
                />
                <div>
                  <h4 className="text-sm font-bold text-amber-500">
                    Delay Reported
                  </h4>
                  <p className="text-xs text-amber-200/70 mt-1">
                    Shipment is currently held due to{" "}
                    <strong>{data.delayReason}</strong>. Please contact the
                    driver for updates.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex flex-col gap-3">
            <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-900/20 transition-all">
              Send Manual SMS
            </button>
            <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-all">
              Edit Shipment Details
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
