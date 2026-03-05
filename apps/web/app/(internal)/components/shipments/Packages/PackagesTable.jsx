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
  faWineGlass,
  faSnowflake,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../../ui/StatusBadge";
import ShipmentLabel from "../ShipmentLabel";

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
              `/components/print/labels?id=${encodeURIComponent(data.id)}`,
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
          <span>Print {filteredPackages.length} Label/s</span>
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
                {/* <th className="p-4 text-right">Actions</th> */}
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

// --- SUB-COMPONENT: DESKTOP TABLE ROW ---
function PackageTableRow({ pkg, idx, shipmentData, isDark = false }) {
  const [showQR, setShowQR] = useState(false);

  return (
    <>
      <tr
        className={`transition-colors group ${isDark ? "hover:bg-slate-800/50" : "hover:bg-slate-50"}`}
      >
        <td className="p-4 text-center">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded border text-xs font-mono font-bold transition-colors ${
              isDark
                ? "bg-slate-800 border-slate-700 text-slate-500 group-hover:bg-slate-700 group-hover:text-white"
                : "bg-slate-100 border-slate-200 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900"
            }`}
          >
            {pkg.sequence || idx + 1}
          </span>
        </td>

        <td className="p-4">
          <div
            className={`font-medium text-sm ${isDark ? "text-slate-200" : "text-slate-900"}`}
          >
            {pkg.description || "No Description"}
          </div>
          <div
            className={`text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}
          >
            {pkg.packagingType || "Package"} •{" "}
            {pkg.quantity ? `${pkg.quantity} qty` : "N/A"}
          </div>
          {(pkg.isFragile || pkg.isPerishable) && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {pkg.isFragile && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    isDark
                      ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                      : "bg-amber-50 border border-amber-200 text-amber-700"
                  }`}
                >
                  <FontAwesomeIcon icon={faWineGlass} className="text-[8px]" />{" "}
                  Fragile
                </span>
              )}
              {pkg.isPerishable && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    isDark
                      ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
                      : "bg-cyan-50 border border-cyan-200 text-cyan-700"
                  }`}
                >
                  <FontAwesomeIcon icon={faSnowflake} className="text-[8px]" />{" "}
                  Perishable
                </span>
              )}
            </div>
          )}
        </td>

        <td className="p-4">
          <div className="font-mono text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded w-fit border border-amber-500/20">
            {pkg.trackingNumber}
          </div>
        </td>

        <td className="p-4">
          <StatusBadge status={pkg.status} size="xs" isDark={isDark} />
        </td>

        <td className="p-4 text-right">
          <button
            onClick={() => setShowQR(!showQR)}
            className={`w-8 h-8 rounded inline-flex items-center justify-center transition-all ${
              showQR
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
                : isDark
                  ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700"
                  : "bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-slate-900 border border-slate-300"
            }`}
            title="Toggle QR Code"
          >
            <FontAwesomeIcon icon={faQrcode} />
          </button>
        </td>
      </tr>

      {showQR && (
        <tr
          className={`animate-in fade-in zoom-in-95 duration-200 ${isDark ? "bg-slate-900/50" : "bg-slate-50"}`}
        >
          <td colSpan="5" className="p-4">
            <div
              className={`flex items-center gap-6 border rounded-xl p-4 max-w-lg mx-auto shadow-inner ${
                isDark
                  ? "bg-slate-950 border-slate-800"
                  : "bg-white border-slate-200"
              }`}
            >
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
function PackageMobileCard({ pkg, idx, shipmentData, isDark = false }) {
  const [showQR, setShowQR] = useState(false);

  return (
    <div
      className={`p-4 space-y-3 transition-colors ${
        isDark
          ? "bg-slate-900/50 hover:bg-slate-800/30"
          : "bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex gap-3 items-center">
          <span
            className={`inline-flex items-center justify-center w-8 h-8 rounded border text-xs font-mono font-bold ${
              isDark
                ? "bg-slate-800 border-slate-700 text-slate-400"
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}
          >
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
              : isDark
                ? "bg-slate-800 text-slate-400 border border-slate-700"
                : "bg-slate-200 text-slate-600 border border-slate-300"
          }`}
        >
          <FontAwesomeIcon icon={faQrcode} />
        </button>
      </div>

      <div className="pl-11">
        <div
          className={`font-medium text-sm ${isDark ? "text-slate-200" : "text-slate-900"}`}
        >
          {pkg.description || "No Description"}
        </div>
        <div
          className={`text-xs mt-1 flex gap-2 items-center ${isDark ? "text-slate-500" : "text-slate-600"}`}
        >
          <FontAwesomeIcon
            icon={faBoxOpen}
            className={isDark ? "text-slate-600" : "text-slate-500"}
          />
          {pkg.packagingType || "Package"}
          <span className={isDark ? "text-slate-700" : "text-slate-400"}>
            |
          </span>
          {pkg.weight ? `${pkg.weight}kg` : "N/A"}
        </div>

        {(pkg.isFragile || pkg.isPerishable) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {pkg.isFragile && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isDark
                    ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                    : "bg-amber-50 border border-amber-200 text-amber-700"
                }`}
              >
                <FontAwesomeIcon icon={faWineGlass} className="text-[8px]" />{" "}
                Fragile
              </span>
            )}
            {pkg.isPerishable && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isDark
                    ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
                    : "bg-cyan-50 border border-cyan-200 text-cyan-700"
                }`}
              >
                <FontAwesomeIcon icon={faSnowflake} className="text-[8px]" />{" "}
                Perishable
              </span>
            )}
          </div>
        )}

        <div className="mt-3">
          <StatusBadge status={pkg.status} size="xs" isDark={isDark} />
        </div>
      </div>

      {showQR && (
        <div
          className={`mt-4 pt-4 border-t animate-in fade-in zoom-in-95 duration-200 ${isDark ? "border-slate-800" : "border-slate-200"}`}
        >
          <div
            className={`border rounded-xl p-4 flex justify-center shadow-inner ${
              isDark
                ? "bg-slate-950 border-slate-800"
                : "bg-white border-slate-200"
            }`}
          >
            {/* Scale down label slightly on mobile if needed via CSS in ShipmentLabel */}
            <ShipmentLabel shipment={shipmentData} packages={pkg} index={idx} />
          </div>
        </div>
      )}
    </div>
  );
}
