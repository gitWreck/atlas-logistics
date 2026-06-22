"use client";

import React, { useState, useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPrint,
  faSearch,
  faFilter,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import PackageTableRow from "./PackagesTableRow";
import PackageMobileCard from "./PackageMobileCard";
import { getBoardThemeClasses } from "@/app/utility/constant/theme";
import {
  manifestUrl,
  packageLabelUrl,
  shipmentLabelUrl,
} from "@/app/utility/constant/templates";

const ITEMS_PER_PAGE = 5;

export default function PackagesTable({ data, onRefresh, isDark = false }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const theme = getBoardThemeClasses(isDark);
  const packages = data?.packages || [];

  const filteredPackages = useMemo(() => {
    const term = search.toLowerCase();

    return packages.filter((pkg) => {
      const matchesSearch =
        pkg.packageId?.toLowerCase().includes(term) ||
        pkg.description?.toLowerCase().includes(term) ||
        pkg.sequence?.toString().includes(term);

      const matchesFilter = filter === "ALL" || pkg.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [packages, search, filter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter]);

  const totalPages = Math.ceil(filteredPackages.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentPackages = filteredPackages.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  const uniqueStatuses = ["ALL", ...new Set(packages.map((pkg) => pkg.status))];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Controls */}
      <div
        className={`flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center p-3 rounded-xl border ${theme.header}`}
      >
        <div className="flex flex-col sm:flex-row flex-1 gap-2 w-full md:w-auto">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <FontAwesomeIcon icon={faSearch} className={theme.iconMuted} />
            </div>

            <input
              type="text"
              placeholder="Search tracking, item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${theme.input}`}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <FontAwesomeIcon icon={faFilter} className={theme.iconMuted} />
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={`w-full sm:w-auto border rounded-lg pl-9 pr-8 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none appearance-none cursor-pointer ${theme.input}`}
            >
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>
                  {status === "ALL" ? "All Statuses" : status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row">
          <button
            type="button"
            // onClick={() => window.open(shipmentLabelUrl(data.id), "_blank")}
            onClick={() => {
              const url = manifestUrl(data.id);
              window.open(url, "_blank");
            }}
            className={`flex min-w-0 justify-center items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs font-bold ${theme.actionButton}`}
          >
            <FontAwesomeIcon icon={faPrint} />
            <span className="truncate">Shipment Label</span>
          </button>

          <button
            type="button"
            onClick={() => window.open(packageLabelUrl(data.id), "_blank")}
            className={`flex min-w-0 justify-center items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs font-bold ${theme.actionButton}`}
          >
            <FontAwesomeIcon icon={faPrint} />
            <span className="truncate">Package Label/s</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className={`border rounded-xl overflow-hidden ${theme.contentBoard}`}
      >
        {/* Desktop */}
        <div className="hidden md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className={`border-b text-xs uppercase tracking-wider ${theme.tableHeadSoft}`}
              >
                <th className="p-4 w-16 text-center">#</th>
                <th className="p-4">Item Details</th>
                <th className="p-4">Tracking No.</th>
                <th className="p-4">Status</th>
                <th className="p-4">Route</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody
              className={`divide-y ${isDark ? "divide-slate-800" : "divide-slate-200"}`}
            >
              {currentPackages.length > 0 ? (
                currentPackages.map((pkg, idx) => (
                  <PackageTableRow
                    key={pkg.packageId || idx}
                    pkg={pkg}
                    idx={startIndex + idx}
                    shipmentData={data}
                    isDark={isDark}
                    onRefresh={onRefresh}
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    className={`p-8 text-center italic ${theme.emptyText}`}
                  >
                    No packages found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div
          className={`md:hidden divide-y ${isDark ? "divide-slate-800" : "divide-slate-200"}`}
        >
          {currentPackages.length > 0 ? (
            currentPackages.map((pkg, idx) => (
              <PackageMobileCard
                key={pkg.packageId || idx}
                pkg={pkg}
                idx={startIndex + idx}
                shipmentData={data}
                isDark={isDark}
              />
            ))
          ) : (
            <div className={`p-8 text-center italic ${theme.emptyText}`}>
              No packages found.
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className={`px-4 sm:px-6 py-4 border rounded-xl flex flex-col sm:flex-row justify-between items-center gap-3 text-xs ${theme.footer}`}
        >
          <span className={theme.footerText}>
            Showing{" "}
            <span className={`font-bold ${theme.footerStrong}`}>
              {startIndex + 1}
            </span>
            -
            <span className={`font-bold ${theme.footerStrong}`}>
              {Math.min(startIndex + ITEMS_PER_PAGE, filteredPackages.length)}
            </span>{" "}
            of {filteredPackages.length}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed ${theme.paginationButton}`}
            >
              <FontAwesomeIcon icon={faChevronLeft} size="xs" />
            </button>

            <div
              className={`flex items-center px-3 h-8 border rounded-lg text-xs font-bold ${theme.pageBadge}`}
            >
              Page {currentPage} of {totalPages}
            </div>

            <button
              type="button"
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              disabled={currentPage === totalPages}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed ${theme.paginationButton}`}
            >
              <FontAwesomeIcon icon={faChevronRight} size="xs" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
