import React, { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCut,
  faMinus,
  faPlus,
  faSearch,
  faFilter,
} from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";
import StatusBadge from "../../(internal)/components/ui/StatusBadge";

export default function TripManifestTable({
  shipments,
  loading,
  isLocked,
  onSplit,
  onUnassign,
  onBulkAssign,
}) {
  // --- 1. NEW STATE ---
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL"); // 'ALL', 'PENDING', 'LOADED'

  // --- 2. FILTER LOGIC ---
  const filteredShipments = useMemo(() => {
    if (!shipments) return [];

    return shipments.filter((p) => {
      // Search Logic (Tracking or Route)
      const matchesSearch =
        p.packageId.toLowerCase().includes(search.toLowerCase()) ||
        p.route?.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      // Filter Logic
      if (filter === "PENDING") return (p.pendingCount || 0) > 0;
      if (filter === "LOADED") return (p.pendingCount || 0) === 0;

      return true;
    });
  }, [shipments, search, filter]);

  // Recalculate totals based on VIEW (optional, or keep generic)
  const totalItems =
    shipments?.reduce((sum, p) => sum + (p.totalItems || 0), 0) || 0;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-xl min-h-[300px] flex flex-col">
      {/* --- HEADER SECTION --- */}
      <div className="p-4 bg-slate-950/50 border-b border-slate-800 space-y-3">
        {/* Top Row: Title & Actions */}
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-400 text-sm uppercase">
            Cargo Manifest{" "}
            <span className="text-slate-600 ml-1">
              ({filteredShipments.length})
            </span>
          </h3>
          <div className="flex items-center gap-3">
            <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs font-mono hidden sm:inline-block">
              Total Package/s: {totalItems}
            </span>
            <button
              onClick={onBulkAssign}
              disabled={isLocked}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span className="hidden sm:inline">Add Shipments</span>
            </button>
          </div>
        </div>

        {/* --- NEW: FILTERS ROW --- */}
        <div className="flex gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3 top-2.5 text-slate-500 text-xs"
            />
            <input
              type="text"
              placeholder="Search Tracking ID or Route..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <FontAwesomeIcon
              icon={faFilter}
              className="absolute left-3 top-2.5 text-slate-500 text-xs"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-200 focus:border-blue-500 outline-none appearance-none cursor-pointer hover:bg-slate-800 transition-colors"
            >
              <option value="ALL">Show All</option>
              <option value="PENDING">Pending Only</option>
              <option value="LOADED">Fully Loaded</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- MOBILE LIST --- */}
      <div className="md:hidden flex-1 divide-y divide-slate-800">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-500">
            Loading Cargo...
          </div>
        ) : filteredShipments.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500 italic">
            {shipments?.length === 0
              ? "Truck is empty."
              : "No matching shipments found."}
          </div>
        ) : (
          filteredShipments.map((p) => (
            <div key={p.id} className="p-4 text-slate-300">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-bold text-white">
                    {p.packageId}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-xs text-slate-500">
                    {p.id}
                  </div>
                </div>

                <div className="flex shrink-0 justify-end gap-1">
                  <button
                    onClick={() => onSplit(p)}
                    className="p-2 text-slate-500 hover:text-amber-400"
                    disabled={isLocked || (p.totalItems || 0) <= 1}
                  >
                    <FontAwesomeIcon icon={faCut} />
                  </button>
                  <button
                    onClick={() => onUnassign(p)}
                    className="p-2 text-slate-500 hover:text-red-400"
                    disabled={isLocked}
                  >
                    <FontAwesomeIcon icon={faMinus} />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate rounded bg-slate-800 px-2 py-1 text-sm font-semibold text-slate-200">
                  {p.route}
                </span>
                <StatusBadge status={p.status} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs font-bold uppercase text-slate-500">
                    Loaded
                  </div>
                  <div className="font-mono text-slate-200">
                    {p.loadedCount}/{p.totalItems}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold uppercase text-slate-500">
                    Updated
                  </div>
                  <div className="truncate font-mono text-xs text-slate-400">
                    {formatFirestoreDate(p.updatedAt)}
                  </div>
                </div>
              </div>

              {p.pendingCount > 0 && (
                <div className="mt-2 text-sm font-bold text-red-400">
                  Pending: {p.pendingCount}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* --- TABLE SECTION --- */}
      <div className="hidden md:block overflow-x-auto flex-1">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-slate-500 font-bold uppercase border-b border-slate-800">
            <tr>
              <th className="p-3">Tracking / ID</th>
              <th className="p-3">Stats</th>
              <th className="p-3">Status</th>
              <th className="p-3">Route</th>
              <th className="p-3">Updated</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {loading ? (
              <tr>
                <td colSpan="6" className="p-6 text-center text-slate-500">
                  Loading Cargo...
                </td>
              </tr>
            ) : filteredShipments.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  className="p-6 text-center text-slate-500 italic"
                >
                  {shipments?.length === 0
                    ? "Truck is empty."
                    : "No matching shipments found."}
                </td>
              </tr>
            ) : (
              // --- 3. USE FILTERED SHIPMENTS HERE ---
              filteredShipments.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-800/30 transition-colors"
                >
                  <td className="p-3">
                    <div className="font-bold text-white">{p.packageId}</div>
                    <div className="font-mono text-[10px] text-slate-500">
                      {p.id}
                    </div>
                  </td>
                  <td className="p-3">
                    <div>
                      Loaded: {p.loadedCount}/{p.totalItems}
                    </div>
                    {p.pendingCount > 0 && (
                      <div className="text-red-400 font-bold">
                        Pending: {p.pendingCount}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="p-3">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                      {p.route}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                      {formatFirestoreDate(p.updatedAt)}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => onSplit(p)}
                        className="text-slate-500 hover:text-amber-400 p-2"
                        disabled={isLocked || (p.totalItems || 0) <= 1}
                      >
                        <FontAwesomeIcon icon={faCut} />
                      </button>
                      <button
                        onClick={() => onUnassign(p)}
                        className="text-slate-500 hover:text-red-400 p-2"
                        disabled={isLocked}
                      >
                        <FontAwesomeIcon icon={faMinus} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
