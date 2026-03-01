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
  onViewAll,
  isDark = false,
}) {
  const [searchTerm, setSearchTerm] = useState("");

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

  return (
    <div
      className={`rounded-xl overflow-hidden shadow-xl border ${
        isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      }`}
    >
      {/* HEADER: Title + Controls */}
      <div
        className={`p-4 border-b flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 ${
          isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50"
        }`}
      >
        <h3
          className={`font-bold text-sm uppercase flex items-center gap-2 ${
            isDark ? "text-slate-300" : "text-slate-700"
          }`}
        >
          <FontAwesomeIcon
            icon={faCalendarAlt}
            className={isDark ? "text-slate-500" : "text-slate-500"}
          />
          Recent Activity
        </h3>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <FontAwesomeIcon
              icon={faSearch}
              className={`absolute left-3 top-2.5 text-xs ${
                isDark ? "text-slate-600" : "text-slate-500"
              }`}
            />
            <input
              type="text"
              placeholder="Search activity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full sm:w-48 rounded-lg pl-8 pr-3 py-1.5 text-xs border focus:border-blue-500 outline-none transition-colors ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-slate-200 placeholder-slate-600"
                  : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div
              className={`flex items-center gap-2 rounded-lg px-2 py-1 flex-1 sm:flex-none border ${
                isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-300"
              }`}
            >
              <span
                className={`text-[10px] uppercase font-bold ${
                  isDark ? "text-slate-500" : "text-slate-600"
                }`}
              >
                Rows:
              </span>
              <select
                value={viewLimit}
                onChange={(e) => setViewLimit(Number(e.target.value))}
                className={`bg-transparent text-xs font-bold outline-none cursor-pointer w-full ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>

            <button
              onClick={onViewAll}
              className="text-xs text-blue-500 hover:text-blue-600 font-bold flex items-center gap-1 px-2 py-1"
            >
              All <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </div>
        </div>
      </div>

      <div className={isDark ? "border-t border-slate-800/50" : "border-t border-slate-200"}>
        {loading && (
          <div className={`p-8 text-center ${isDark ? "text-slate-500" : "text-slate-500"}`}>
            <div className="flex justify-center items-center gap-2 animate-pulse">
              <div
                className={`w-2 h-2 rounded-full ${
                  isDark ? "bg-slate-600" : "bg-slate-400"
                }`}
              />
              <span>Loading...</span>
            </div>
          </div>
        )}

        {!loading && filteredShipments.length === 0 && (
          <div
            className={`p-8 text-center italic ${
              isDark ? "text-slate-500" : "text-slate-500"
            }`}
          >
            {searchTerm
              ? `No results for "${searchTerm}"`
              : "No recent activity found."}
          </div>
        )}

        {!loading && filteredShipments.length > 0 && (
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className={`font-bold uppercase border-b ${
                  isDark ? "bg-slate-950 text-slate-500 border-slate-800" : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                <tr>
                  <th className="p-4">Tracking Number</th>
                  <th className="p-4">Route</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Last Update</th>
                </tr>
              </thead>
              <tbody
                className={`divide-y ${
                  isDark ? "divide-slate-800 text-slate-300" : "divide-slate-200 text-slate-700"
                }`}
              >
                {filteredShipments.map((shipment) => (
                  <tr
                    key={shipment.id}
                    className={`transition-colors group cursor-pointer ${
                      isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-50"
                    }`}
                  >
                    <td
                      className={`p-4 font-mono font-bold ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {shipment.trackingNumber || shipment.id}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-bold ${
                          isDark
                            ? "bg-slate-800 text-slate-400"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {shipment.originCode || "N/A"}
                        {" -> "}
                        {shipment.destinationCode || "N/A"}
                      </span>
                    </td>
                    <td className="p-4">
                      <StatusBadge
                        status={shipment.status}
                        reason={shipment.delayReason}
                        isDark={isDark}
                      />
                    </td>
                    <td
                      className={`p-4 text-right ${
                        isDark ? "text-slate-500" : "text-slate-500"
                      }`}
                    >
                      {formatFirestoreDate(shipment.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredShipments.length > 0 && (
          <div className={isDark ? "sm:hidden divide-y divide-slate-800" : "sm:hidden divide-y divide-slate-200"}>
            {filteredShipments.map((shipment) => (
              <div
                key={shipment.id}
                className={`p-4 transition-colors cursor-pointer space-y-2 ${
                  isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span
                    className={`font-mono font-bold text-sm ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {shipment.trackingNumber || shipment.id}
                  </span>
                  <span
                    className={`text-[10px] ${
                      isDark ? "text-slate-500" : "text-slate-500"
                    }`}
                  >
                    {formatFirestoreDate(shipment.updatedAt)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-1 rounded text-[10px] font-bold ${
                      isDark
                        ? "bg-slate-800 text-slate-400"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {shipment.originCode || "N/A"}
                    {" -> "}
                    {shipment.destinationCode || "N/A"}
                  </span>
                  <StatusBadge
                    status={shipment.status}
                    reason={shipment.delayReason}
                    size="xs"
                    isDark={isDark}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && shipments.length > 0 && (
        <div
          className={`p-2 text-center border-t ${
            isDark ? "bg-slate-950/30 border-slate-800" : "bg-slate-50 border-slate-200"
          }`}
        >
          <span
            className={`text-[10px] ${
              isDark ? "text-slate-600" : "text-slate-500"
            }`}
          >
            Showing {filteredShipments.length} of {shipments.length} fetched
          </span>
        </div>
      )}
    </div>
  );
}
