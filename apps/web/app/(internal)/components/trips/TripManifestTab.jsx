import React, { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faPlus,
  faBoxOpen,
  faPrint,
} from "@fortawesome/free-solid-svg-icons";

export default function TripManifestTab({
  shipments,
  loading,
  isLocked,
  onAddShipment,
  onViewPackages, // <--- New Prop to open your future modal
}) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // --- FILTER LOGIC ---
  const filteredData = useMemo(() => {
    return shipments.filter((s) => {
      const matchesSearch =
        (s.trackingNumber || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.recipient?.name || "").toLowerCase().includes(search.toLowerCase());

      const matchesStatus = filterStatus === "ALL" || s.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [shipments, search, filterStatus]);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* HEADER: STATS + CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 bg-slate-800/20 p-3 rounded-lg border border-slate-800">
        <div>
          <div className="text-xs font-bold text-slate-400 uppercase">
            Total Cargo
          </div>
          <div className="text-xl font-bold text-white">
            {shipments.length}{" "}
            <span className="text-sm font-normal text-slate-500">
              shipments
            </span>
          </div>
        </div>

        {/* CONTROLS ROW */}
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-48">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3 top-2.5 text-slate-500 text-xs"
            />
            <input
              type="text"
              placeholder="Search tracking..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Action Buttons Group */}
          <div className="flex gap-2">
            <button
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
              title="Print All Labels"
            >
              <FontAwesomeIcon icon={faPrint} />
              <span className="hidden xl:inline">Labels</span>
            </button>

            <button
              onClick={onAddShipment}
              disabled={isLocked}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 whitespace-nowrap"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Shipments</span>
            </button>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-950 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3 w-10 text-center">#</th>
              <th className="px-4 py-3">Tracking / Customer</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3 text-center">Qty</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/50">
            {loading ? (
              <tr>
                <td
                  colSpan="5"
                  className="px-4 py-8 text-center text-slate-500 animate-pulse"
                >
                  Loading manifest...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  className="px-4 py-8 text-center text-slate-500 italic"
                >
                  No shipments found.
                </td>
              </tr>
            ) : (
              filteredData.map((s, idx) => (
                <tr
                  key={s.id || idx}
                  className="hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-4 py-3 text-center font-mono text-xs text-slate-600">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-white text-xs font-mono">
                      {s.trackingNumber}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                      {s.recipient?.name || "Unknown"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {s.destinationCode || "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-slate-300">
                    {s.totalPackages || 1}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onViewPackages && onViewPackages(s)} // <--- Trigger Modal Here
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 px-3 py-1.5 rounded transition-all flex items-center gap-1 ml-auto"
                    >
                      <FontAwesomeIcon icon={faBoxOpen} />
                      Items
                    </button>
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
