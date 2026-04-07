"use client";

import React, { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faFilter,
  faTruckFast,
  faCirclePlus,
} from "@fortawesome/free-solid-svg-icons";

export default function InvoiceBoardFilters({
  isDark = false,
  searchQuery = "",
  activeFilter = "ALL",
  onSearchChange,
  onFilterChange,
  eligibleShipments = [],
  onCreateFromShipment,
}) {
  const recentEligibleShipments = useMemo(() => {
    return eligibleShipments.slice(0, 6);
  }, [eligibleShipments]);

  return (
    <div
      className={`border-b px-4 sm:px-6 py-4 space-y-4 ${
        isDark
          ? "border-slate-800 bg-slate-900/40"
          : "border-slate-200 bg-slate-50/70"
      }`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="relative">
          <FontAwesomeIcon
            icon={faSearch}
            className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          />
          <input
            type="text"
            placeholder="Search invoice, shipment, sender, recipient..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className={`w-full rounded-lg border pl-9 pr-4 py-2.5 text-sm outline-none transition-colors ${
              isDark
                ? "bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
                : "bg-white border-slate-300 text-slate-800 placeholder:text-slate-400"
            }`}
          />
        </div>

        <div className="relative">
          <FontAwesomeIcon
            icon={faFilter}
            className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          />
          <select
            value={activeFilter}
            onChange={(e) => onFilterChange?.(e.target.value)}
            className={`w-full appearance-none rounded-lg border pl-9 pr-4 py-2.5 text-sm outline-none cursor-pointer transition-colors ${
              isDark
                ? "bg-slate-950 border-slate-700 text-slate-100"
                : "bg-white border-slate-300 text-slate-800"
            }`}
          >
            <option value="ALL">All Invoices</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div
          className={`rounded-lg border px-4 py-2.5 flex items-center justify-between gap-3 ${
            isDark
              ? "bg-slate-950 border-slate-700 text-slate-300"
              : "bg-white border-slate-300 text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <FontAwesomeIcon
              icon={faTruckFast}
              className={isDark ? "text-blue-300" : "text-blue-600"}
            />
            <span className="text-sm truncate">
              {eligibleShipments.length} shipment
              {eligibleShipments.length === 1 ? "" : "s"} ready for invoicing
            </span>
          </div>
        </div>
      </div>

      {recentEligibleShipments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon
              icon={faTruckFast}
              className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}
            />
            <p
              className={`text-xs font-bold uppercase tracking-widest ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Quick Create from Shipment
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {recentEligibleShipments.map((shipment) => (
              <button
                key={shipment.id}
                type="button"
                onClick={() => onCreateFromShipment?.(shipment)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                  isDark
                    ? "bg-slate-950 border-slate-700 text-slate-200 hover:bg-slate-900"
                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
                title={shipment.trackingNumber || shipment.id}
              >
                <FontAwesomeIcon
                  icon={faCirclePlus}
                  className={isDark ? "text-blue-300" : "text-blue-600"}
                />
                <span className="truncate max-w-[240px]">
                  {shipment.trackingNumber || shipment.id} ·{" "}
                  {shipment.sender?.name || "Unknown Sender"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
