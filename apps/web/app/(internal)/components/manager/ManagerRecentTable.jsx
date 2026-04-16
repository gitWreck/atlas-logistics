"use client";

import React, { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarAlt,
  faArrowRight,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";
import { getTableTheme } from "@/app/utility/constant/theme";
import StatusBadge from "../../components/ui/StatusBadge";

export default function ManagerRecentTable({
  shipments = [],
  loading = false,
  viewLimit,
  setViewLimit,
  onViewAll,
  isDark = false,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const theme = getTableTheme(isDark);

  const filteredShipments = useMemo(() => {
    if (!searchTerm) return shipments;

    const lowerTerm = searchTerm.toLowerCase();

    return shipments.filter((shipment) => {
      return (
        shipment.shipmentId?.toLowerCase().includes(lowerTerm) ||
        shipment.status?.toLowerCase().includes(lowerTerm) ||
        shipment.route?.toLowerCase().includes(lowerTerm) ||
        shipment.originCode?.toLowerCase().includes(lowerTerm) ||
        shipment.destinationCode?.toLowerCase().includes(lowerTerm)
      );
    });
  }, [shipments, searchTerm]);

  const emptyMessage = searchTerm
    ? `No results for "${searchTerm}"`
    : "No recent activity found.";

  return (
    <div className={`border rounded-xl overflow-hidden ${theme.container}`}>
      {/* Header */}
      <div
        className={`px-4 sm:px-6 py-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${theme.header}`}
      >
        <h3
          className={`font-bold text-sm uppercase flex items-center gap-2 ${theme.headingText}`}
        >
          <FontAwesomeIcon icon={faCalendarAlt} className={theme.inputIcon} />
          Recent Activity
        </h3>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <FontAwesomeIcon
              icon={faSearch}
              className={`absolute left-3 top-2.5 text-xs ${theme.inputIcon}`}
            />
            <input
              type="text"
              placeholder="Search activity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full sm:w-48 border rounded-lg pl-8 pr-3 py-1.5 text-sm focus:border-blue-500 outline-none transition-colors ${theme.input}`}
            />
          </div>

          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border ${theme.selectWrap}`}
          >
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${theme.miniLabel}`}
            >
              Rows
            </span>
            <select
              value={viewLimit}
              onChange={(e) => setViewLimit(Number(e.target.value))}
              className={`bg-transparent text-sm font-medium outline-none cursor-pointer ${theme.selectText}`}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full">
        {/* Mobile */}
        <div
          className={`md:hidden flex flex-col divide-y ${theme.tbodyDivide}`}
        >
          {loading ? (
            <div className={`px-6 py-8 text-center ${theme.emptyText}`}>
              <div className="animate-pulse">Loading activity...</div>
            </div>
          ) : filteredShipments.length === 0 ? (
            <div className={`px-6 py-8 text-center italic ${theme.emptyText}`}>
              {emptyMessage}
            </div>
          ) : (
            filteredShipments.map((shipment) => (
              <div
                key={shipment.id}
                className={`p-4 flex flex-col gap-3 transition-colors ${theme.rowHover}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="truncate">
                    <div
                      className={`font-mono font-bold truncate ${theme.cellPrimary}`}
                    >
                      {shipment.id}
                    </div>
                    <div className={`text-xs truncate ${theme.cellSecondary}`}>
                      {formatFirestoreDate(shipment.updatedAt)}
                    </div>
                  </div>

                  <StatusBadge
                    status={shipment.status}
                    reason={shipment.delayReason}
                    size="xs"
                    isDark={isDark}
                  />
                </div>

                <div className="flex justify-between items-end gap-2">
                  <span
                    className={`px-2 py-1 rounded text-[10px] border font-mono uppercase ${theme.roleBadge}`}
                  >
                    {shipment.originCode || "N/A"} {" -> "}{" "}
                    {shipment.destinationCode || "N/A"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className={`w-full text-left text-sm ${theme.tableText}`}>
            <thead className={`uppercase font-semibold text-xs ${theme.thead}`}>
              <tr>
                <th className="px-6 py-3">Tracking Number</th>
                <th className="px-6 py-3">Route</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Last Update</th>
              </tr>
            </thead>

            <tbody className={`divide-y ${theme.tbodyDivide}`}>
              {loading ? (
                <tr>
                  <td
                    colSpan="4"
                    className={`px-6 py-8 text-center ${theme.emptyText}`}
                  >
                    <div className="animate-pulse">Loading activity...</div>
                  </td>
                </tr>
              ) : filteredShipments.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    className={`px-6 py-8 text-center italic ${theme.emptyText}`}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                filteredShipments.map((shipment) => (
                  <tr
                    key={shipment.id}
                    className={`transition-colors ${theme.rowHover}`}
                  >
                    <td
                      className={`px-6 py-4 font-mono font-bold ${theme.cellPrimary}`}
                    >
                      {shipment.id}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs border font-mono uppercase ${theme.roleBadge}`}
                      >
                        {shipment.originCode || "N/A"} {" -> "}{" "}
                        {shipment.destinationCode || "N/A"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge
                        status={shipment.status}
                        reason={shipment.delayReason}
                        isDark={isDark}
                      />
                    </td>

                    <td
                      className={`px-6 py-4 text-right ${theme.cellSecondary}`}
                    >
                      {formatFirestoreDate(shipment.updatedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      {!loading && shipments.length > 0 && (
        <div
          className={`px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row justify-between items-center gap-3 text-xs ${theme.footer}`}
        >
          <span>
            Showing{" "}
            <span className={`font-bold ${theme.footerBold}`}>
              {filteredShipments.length}
            </span>{" "}
            of {shipments.length} fetched
          </span>

          <button
            type="button"
            onClick={onViewAll}
            className={`px-3 py-1.5 rounded-lg border transition-all ${theme.paginationButton}`}
          >
            All <FontAwesomeIcon icon={faArrowRight} className="ml-1" />
          </button>
        </div>
      )}
    </div>
  );
}
