import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPrint,
  faSearch,
  faFilter,
  faQrcode,
  faChevronLeft,
  faChevronRight,
  faBoxOpen,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../../ui/StatusBadge";
import ShipmentLabel from "../ShipmentLabel";

const ITEMS_PER_PAGE = 5;

export default function PackagesTable({ data }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);

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
      <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
        {/* Search & Filter Group */}
        <div className="flex flex-col sm:flex-row flex-1 gap-2 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <FontAwesomeIcon icon={faSearch} className="text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search tracking, item..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1); // Reset to page 1 on search
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <FontAwesomeIcon icon={faFilter} className="text-slate-500" />
            </div>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
            >
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>
                  {status === "ALL" ? "All Statuses" : status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Print Button */}
        <button
          onClick={() =>
            window.open(
              `/components/print/labels?id=${encodeURIComponent(data.id)}`,
              "_blank",
            )
          }
          className="flex justify-center items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors text-xs font-bold whitespace-nowrap"
        >
          <FontAwesomeIcon icon={faPrint} />
          <span>Print {filteredPackages.length} Labels</span>
        </button>
      </div>

      {/* --- CONTENT AREA (Responsive Switch) --- */}
      <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900/50">
        {/* DESKTOP: TABLE VIEW */}
        <div className="hidden md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-700 text-xs uppercase tracking-wider text-slate-400">
                <th className="p-4 w-16 text-center">#</th>
                <th className="p-4">Item Details</th>
                <th className="p-4">Tracking No.</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {currentPackages.length > 0 ? (
                currentPackages.map((pkg, idx) => (
                  <PackageTableRow
                    key={pkg.trackingNumber || idx}
                    pkg={pkg}
                    idx={startIndex + idx}
                    shipmentData={data}
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    className="p-8 text-center text-slate-500 italic"
                  >
                    No packages found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE: CARD LIST VIEW */}
        <div className="md:hidden divide-y divide-slate-800">
          {currentPackages.length > 0 ? (
            currentPackages.map((pkg, idx) => (
              <PackageMobileCard
                key={pkg.trackingNumber || idx}
                pkg={pkg}
                idx={startIndex + idx}
                shipmentData={data}
              />
            ))
          ) : (
            <div className="p-8 text-center text-slate-500 italic">
              No packages found.
            </div>
          )}
        </div>
      </div>

      {/* --- PAGINATION --- */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center px-2">
          <span className="text-xs text-slate-500">
            Showing {startIndex + 1}-
            {Math.min(startIndex + ITEMS_PER_PAGE, filteredPackages.length)} of{" "}
            {filteredPackages.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FontAwesomeIcon icon={faChevronLeft} size="xs" />
            </button>

            {/* Simple Page Indicator */}
            <div className="flex items-center px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-slate-300">
              Page {currentPage} of {totalPages}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FontAwesomeIcon icon={faChevronRight} size="xs" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SUB-COMPONENT: DESKTOP TABLE ROW ---
function PackageTableRow({ pkg, idx, shipmentData }) {
  const [showQR, setShowQR] = useState(false);

  return (
    <>
      <tr className="hover:bg-slate-800/50 transition-colors group">
        {/* Sequence */}
        <td className="p-4 text-center">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-slate-800 border border-slate-700 text-slate-500 text-xs font-mono font-bold group-hover:bg-slate-700 group-hover:text-white transition-colors">
            {pkg.sequence || idx + 1}
          </span>
        </td>

        {/* Description */}
        <td className="p-4">
          <div className="text-slate-200 font-medium text-sm">
            {pkg.description || "No Description"}
          </div>
          <div className="text-xs text-slate-500">
            {pkg.packagingType || "Package"} •{" "}
            {pkg.weight ? `${pkg.weight}kg` : "N/A"}
          </div>
        </td>

        {/* Tracking */}
        <td className="p-4">
          <div className="font-mono text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded w-fit border border-amber-500/20">
            {pkg.trackingNumber}
          </div>
        </td>

        {/* Status */}
        <td className="p-4">
          <StatusBadge status={pkg.status} size="xs" />
        </td>

        {/* Actions */}
        <td className="p-4 text-right">
          <button
            onClick={() => setShowQR(!showQR)}
            className={`w-8 h-8 rounded inline-flex items-center justify-center transition-all ${
              showQR
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700"
            }`}
            title="Toggle QR Code"
          >
            <FontAwesomeIcon icon={faQrcode} />
          </button>
        </td>
      </tr>

      {/* EXPANDABLE ROW FOR QR CODE */}
      {showQR && (
        <tr className="bg-slate-900/50 animate-in fade-in zoom-in-95 duration-200">
          <td colSpan="5" className="p-4">
            <div className="flex items-center gap-6 bg-slate-950 border border-slate-800 rounded-xl p-4 max-w-lg mx-auto shadow-inner">
              <ShipmentLabel
                shipment={shipmentData}
                packages={pkg}
                index={idx}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// --- SUB-COMPONENT: MOBILE CARD ROW ---
function PackageMobileCard({ pkg, idx, shipmentData }) {
  const [showQR, setShowQR] = useState(false);

  return (
    <div className="p-4 space-y-3 bg-slate-900/50 hover:bg-slate-800/30 transition-colors">
      {/* Header: Sequence + Tracking + Action */}
      <div className="flex justify-between items-start">
        <div className="flex gap-3 items-center">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-slate-800 border border-slate-700 text-slate-400 text-xs font-mono font-bold">
            {pkg.sequence || idx + 1}
          </span>
          <div className="font-mono text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded w-fit border border-amber-500/20">
            {pkg.trackingNumber}
          </div>
        </div>

        <button
          onClick={() => setShowQR(!showQR)}
          className={`w-8 h-8 rounded inline-flex items-center justify-center transition-all ${
            showQR
              ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
              : "bg-slate-800 text-slate-400 border border-slate-700"
          }`}
        >
          <FontAwesomeIcon icon={faQrcode} />
        </button>
      </div>

      {/* Body: Description + Details */}
      <div className="pl-11">
        <div className="text-slate-200 font-medium text-sm">
          {pkg.description || "No Description"}
        </div>
        <div className="text-xs text-slate-500 mt-1 flex gap-2 items-center">
          <FontAwesomeIcon icon={faBoxOpen} className="text-slate-600" />
          {pkg.packagingType || "Package"}
          <span className="text-slate-700">|</span>
          {pkg.weight ? `${pkg.weight}kg` : "N/A"}
        </div>

        <div className="mt-3">
          <StatusBadge status={pkg.status} size="xs" />
        </div>
      </div>

      {/* Expandable QR (Mobile Optimized) */}
      {showQR && (
        <div className="mt-4 pt-4 border-t border-slate-800 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex justify-center shadow-inner">
            {/* Scale down label slightly on mobile if needed via CSS in ShipmentLabel */}
            <ShipmentLabel shipment={shipmentData} packages={pkg} index={idx} />
          </div>
        </div>
      )}
    </div>
  );
}
