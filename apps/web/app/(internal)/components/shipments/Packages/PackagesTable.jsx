import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPrint,
  faSearch,
  faFilter,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import PackageTableRow from "./PackageTableRow";
import PackageMobileCard from "./PackageMobileCard";

const ITEMS_PER_PAGE = 5;

export default function PackagesTable({ data, isDark = false }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  console.log("packages table data: ", data);

  // 1. FILTER & SEARCH LOGIC
  const filteredPackages = data.packages.filter((pkg) => {
    const term = search.toLowerCase();
    const matchesSearch =
      pkg.trackingNumber?.toLowerCase().includes(term) ||
      pkg.description?.toLowerCase().includes(term) ||
      pkg.sequence?.toString().includes(term);

    const matchesFilter = filter === "ALL" || pkg.status === filter;

    return matchesSearch && matchesFilter;
  });

  // 2. PAGINATION LOGIC
  const totalPages = Math.ceil(filteredPackages.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentPackages = filteredPackages.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  // Get unique statuses for the dropdown
  const uniqueStatuses = [
    "ALL",
    ...new Set(data.packages.map((p) => p.status)),
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* --- CONTROLS BAR --- */}
      <div
        className={`flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center p-3 rounded-xl border ${
          isDark
            ? "bg-slate-800/40 border-slate-700/50"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        <div className="flex flex-col sm:flex-row flex-1 gap-2 w-full md:w-auto">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <FontAwesomeIcon
                icon={faSearch}
                className={isDark ? "text-slate-500" : "text-slate-400"}
              />
            </div>
            <input
              type="text"
              placeholder="Search tracking, item..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-white"
                  : "bg-white border-slate-300 text-slate-900"
              }`}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <FontAwesomeIcon
                icon={faFilter}
                className={isDark ? "text-slate-500" : "text-slate-400"}
              />
            </div>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full sm:w-auto border rounded-lg pl-9 pr-8 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none appearance-none cursor-pointer ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-white"
                  : "bg-white border-slate-300 text-slate-900"
              }`}
            >
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>
                  {status === "ALL" ? "All Statuses" : status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() =>
            window.open(
              `/components/print/labels?id=${encodeURIComponent(data.id)}&mode=shipment`,
              "_blank",
            )
          }
          className={`flex justify-center items-center gap-2 px-4 py-2 rounded-lg transition-colors text-xs font-bold whitespace-nowrap ${
            isDark
              ? "bg-slate-700 hover:bg-slate-600 text-white"
              : "bg-slate-200 hover:bg-slate-300 text-slate-800"
          }`}
        >
          <FontAwesomeIcon icon={faPrint} />
          <span>Shipment Label</span>
        </button>
        <button
          onClick={() =>
            window.open(
              `/components/print/labels?id=${encodeURIComponent(data.id)}&mode=individual`,
              "_blank",
            )
          }
          className={`flex justify-center items-center gap-2 px-4 py-2 rounded-lg transition-colors text-xs font-bold whitespace-nowrap ${
            isDark
              ? "bg-slate-700 hover:bg-slate-600 text-white"
              : "bg-slate-200 hover:bg-slate-300 text-slate-800"
          }`}
        >
          <FontAwesomeIcon icon={faPrint} />
          <span>Package Label/s</span>
        </button>
      </div>

      {/* --- CONTENT AREA --- */}
      <div
        className={`border rounded-xl overflow-hidden ${
          isDark
            ? "border-slate-700 bg-slate-900/50"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="hidden md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className={`border-b text-xs uppercase tracking-wider ${
                  isDark
                    ? "bg-slate-900 border-slate-700 text-slate-400"
                    : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                <th className="p-4 w-16 text-center">#</th>
                <th className="p-4">Item Details</th>
                <th className="p-4">Tracking No.</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${isDark ? "divide-slate-800" : "divide-slate-200"}`}
            >
              {currentPackages.length > 0 ? (
                currentPackages.map((pkg, idx) => (
                  <PackageTableRow
                    key={pkg.trackingNumber || idx}
                    pkg={pkg}
                    idx={startIndex + idx}
                    shipmentData={data}
                    isDark={isDark}
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    className={`p-8 text-center italic ${isDark ? "text-slate-500" : "text-slate-600"}`}
                  >
                    No packages found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE: CARD LIST VIEW */}
        <div
          className={`md:hidden divide-y ${isDark ? "divide-slate-800" : "divide-slate-200"}`}
        >
          {currentPackages.length > 0 ? (
            currentPackages.map((pkg, idx) => (
              <PackageMobileCard
                key={pkg.trackingNumber || idx}
                pkg={pkg}
                idx={startIndex + idx}
                shipmentData={data}
                isDark={isDark}
              />
            ))
          ) : (
            <div
              className={`p-8 text-center italic ${isDark ? "text-slate-500" : "text-slate-600"}`}
            >
              No packages found.
            </div>
          )}
        </div>
      </div>

      {/* --- PAGINATION --- */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center px-2">
          <span
            className={`text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}
          >
            Showing {startIndex + 1}-
            {Math.min(startIndex + ITEMS_PER_PAGE, filteredPackages.length)} of{" "}
            {filteredPackages.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                  : "bg-white border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <FontAwesomeIcon icon={faChevronLeft} size="xs" />
            </button>

            <div
              className={`flex items-center px-3 border rounded-lg text-xs font-bold ${
                isDark
                  ? "bg-slate-900 border-slate-700 text-slate-300"
                  : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              Page {currentPage} of {totalPages}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                  : "bg-white border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <FontAwesomeIcon icon={faChevronRight} size="xs" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
