import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarAlt,
  faArrowRight,
  faSearch,
  faFilter,
} from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";
import StatusBadge from "../../components/ui/StatusBadge";

export default function ManagerRecentTable({
  shipments,
  loading,
  viewLimit,
  setViewLimit,
  onViewAll, // <--- Receive it
}) {
  const [searchTerm, setSearchTerm] = useState("");

  // --- CLIENT-SIDE FILTERING ---
  // We filter the *already fetched* shipments based on the search box
  const filteredShipments = shipments.filter((s) => {
    if (!searchTerm) return true;
    const lowerTerm = searchTerm.toLowerCase();
    return (
      s.trackingNumber?.toLowerCase().includes(lowerTerm) ||
      s.status?.toLowerCase().includes(lowerTerm) ||
      s.route?.toLowerCase().includes(lowerTerm) ||
      s.originCode?.toLowerCase().includes(lowerTerm) ||
      s.destinationCode?.toLowerCase().includes(lowerTerm)
    );
  });

  // console.log("recent shipment: ", filteredShipments);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* HEADER: Title + Controls */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-slate-950/50">
        {/* Title */}
        <h3 className="font-bold text-slate-300 text-sm uppercase flex items-center gap-2">
          <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-500" />
          Recent Activity
        </h3>

        {/* ACTIONS: Search + Limit Selector */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* SEARCH BOX */}
          <div className="relative flex-1 sm:flex-none">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3 top-2.5 text-slate-600 text-xs"
            />
            <input
              type="text"
              placeholder="Search activity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-48 bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-blue-500 outline-none transition-colors"
            />
          </div>

          {/* VIEW LIMIT SELECTOR */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
            <span className="text-[10px] uppercase font-bold text-slate-500">
              Rows:
            </span>
            <select
              value={viewLimit}
              onChange={(e) => setViewLimit(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>

          <button
            onClick={onViewAll}
            className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 ml-2"
          >
            All <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-500 font-bold uppercase border-b border-slate-800">
            <tr>
              <th className="p-4">Tracking Number</th>
              <th className="p-4">Route</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Last Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {loading ? (
              <tr>
                <td colSpan="4" className="p-8 text-center text-slate-500">
                  <div className="flex justify-center items-center gap-2 animate-pulse">
                    <div className="w-2 h-2 bg-slate-600 rounded-full"></div>
                    <span>Loading...</span>
                  </div>
                </td>
              </tr>
            ) : filteredShipments.length === 0 ? (
              <tr>
                <td
                  colSpan="4"
                  className="p-8 text-center text-slate-500 italic"
                >
                  {searchTerm
                    ? `No results for "${searchTerm}"`
                    : "No recent activity found."}
                </td>
              </tr>
            ) : (
              filteredShipments.map((shipment) => (
                <tr
                  key={shipment.id}
                  className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                >
                  <td className="p-4 font-mono font-bold text-white">
                    {shipment.trackingNumber || shipment.id}
                  </td>
                  <td className="p-4">
                    <span className="bg-slate-800 px-2 py-1 rounded text-[10px] font-bold text-slate-400">
                      {shipment.originCode || "N/A"}
                      {" -> "}
                      {shipment.destinationCode || "N/A"}
                    </span>
                  </td>
                  <td className="p-4">
                    <StatusBadge
                      status={shipment.status}
                      reason={shipment.delayReason}
                    />
                  </td>
                  <td className="p-4 text-right text-slate-500">
                    {formatFirestoreDate(shipment.updatedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      {!loading && shipments.length > 0 && (
        <div className="p-2 bg-slate-950/30 text-center border-t border-slate-800">
          <span className="text-[10px] text-slate-600">
            Showing {filteredShipments.length} of {shipments.length} fetched
          </span>
        </div>
      )}
    </div>
  );
}
