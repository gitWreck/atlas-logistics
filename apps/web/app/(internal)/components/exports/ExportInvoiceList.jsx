"use client";

import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileExcel,
  faRoute,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";

const FILTER_DEFAULTS = {
  tripId: "ALL",
  startDate: "",
  endDate: "",
  status: "ALL",
  minAmount: "",
  maxAmount: "",
};

const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PAID", "CANCELLED"];

function getInvoiceTripId(invoice = {}) {
  return (
    invoice.tripId ||
    invoice.truckTripId ||
    invoice.currentTripId ||
    invoice.shipment?.currentTripId ||
    invoice.shipmentSnapshot?.currentTripId ||
    ""
  );
}

function parseDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (value?.seconds || value?._seconds) {
    const seconds = value.seconds || value._seconds;
    const date = new Date(seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const stringValue = String(value).trim();
  if (!stringValue) return null;

  if (!/\b\d{4}\b/.test(stringValue)) {
    const assumedYearDate = new Date(
      `${stringValue} ${new Date().getFullYear()}`,
    );
    if (!Number.isNaN(assumedYearDate.getTime())) return assumedYearDate;
  }

  const date = new Date(stringValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getInvoiceDate(invoice = {}) {
  return parseDateValue(invoice.invoiceDate || invoice.createdAt);
}

function formatDate(value) {
  const date = parseDateValue(value);
  if (!date) return value || "-";
  return date.toLocaleDateString();
}

function getShipmentDisplayId(invoice = {}) {
  return invoice.shipmentTrackingNumber || invoice.shipmentId || "-";
}

function getRouteLabel(invoice = {}) {
  return (
    invoice.routeLabel ||
    `${invoice.origin || invoice.shipment?.origin || "-"} -> ${
      invoice.destination || invoice.shipment?.destination || "-"
    }`
  );
}

function getTripFilterLabel(filters, tripQuery = "") {
  if (filters.tripId === "ALL" && tripQuery.trim()) {
    return `Matching "${tripQuery.trim()}"`;
  }

  return filters.tripId === "ALL" ? "All Trips" : filters.tripId;
}

function getDateRangeLabel(filters) {
  if (!filters.startDate && !filters.endDate) return "All Dates";
  return `${filters.startDate || "Start"} to ${filters.endDate || "End"}`;
}

function getAmountRangeLabel(filters) {
  if (!filters.minAmount && !filters.maxAmount) return "All Amounts";
  return `${filters.minAmount || "0"} to ${filters.maxAmount || "No limit"}`;
}

export default function ExportInvoiceList({
  invoices = [],
  loading = false,
  isDark = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState(FILTER_DEFAULTS);
  const [tripQuery, setTripQuery] = useState("");
  const [showTripSuggestions, setShowTripSuggestions] = useState(false);
  const [error, setError] = useState("");

  const modalTheme = getModalThemeClasses(isDark);

  const tripOptions = useMemo(() => {
    const trips = new Map();

    invoices.forEach((invoice) => {
      const tripId = getInvoiceTripId(invoice);
      if (!tripId) return;

      if (!trips.has(tripId)) {
        trips.set(tripId, {
          id: tripId,
          label: `${tripId}${invoice.routeLabel ? ` - ${invoice.routeLabel}` : ""}`,
        });
      }
    });

    return Array.from(trips.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const tripId = getInvoiceTripId(invoice);
      const tripSearch = `${tripId} ${invoice.routeLabel || ""}`.toLowerCase();
      const invoiceDate = getInvoiceDate(invoice);
      const amount = Number(invoice.amount || 0);
      const tripKeyword = tripQuery.trim().toLowerCase();
      const minAmount =
        filters.minAmount === "" ? null : Number(filters.minAmount);
      const maxAmount =
        filters.maxAmount === "" ? null : Number(filters.maxAmount);

      if (filters.tripId !== "ALL" && tripId !== filters.tripId) {
        return false;
      }

      if (filters.tripId === "ALL" && tripKeyword) {
        return tripSearch.includes(tripKeyword);
      }

      if (
        filters.status !== "ALL" &&
        (invoice.status || "DRAFT") !== filters.status
      ) {
        return false;
      }

      if (filters.startDate || filters.endDate) {
        if (!invoiceDate) return false;

        if (filters.startDate) {
          const start = new Date(`${filters.startDate}T00:00:00`);
          if (invoiceDate < start) return false;
        }

        if (filters.endDate) {
          const end = new Date(`${filters.endDate}T23:59:59`);
          if (invoiceDate > end) return false;
        }
      }

      if (minAmount !== null && amount < minAmount) return false;
      if (maxAmount !== null && amount > maxAmount) return false;

      return true;
    });
  }, [invoices, filters, tripQuery]);

  const filteredTripOptions = useMemo(() => {
    const keyword = tripQuery.trim().toLowerCase();
    if (!keyword) return tripOptions;

    return tripOptions.filter((trip) =>
      `${trip.id} ${trip.label}`.toLowerCase().includes(keyword),
    );
  }, [tripOptions, tripQuery]);

  const totalAmount = useMemo(() => {
    return filteredInvoices.reduce(
      (sum, invoice) => sum + (Number(invoice.amount) || 0),
      0,
    );
  }, [filteredInvoices]);

  const updateFilter = (key, value) => {
    setError("");
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setError("");
    setTripQuery("");
    setFilters(FILTER_DEFAULTS);
  };

  const handleTripType = (text) => {
    setError("");
    setTripQuery(text);
    setShowTripSuggestions(true);

    const exactMatch = tripOptions.find(
      (trip) =>
        trip.id.toLowerCase() === text.trim().toLowerCase() ||
        trip.label.toLowerCase() === text.trim().toLowerCase(),
    );

    setFilters((prev) => ({
      ...prev,
      tripId: exactMatch?.id || "ALL",
    }));
  };

  const handleTripSelect = (trip) => {
    setError("");
    setFilters((prev) => ({
      ...prev,
      tripId: trip?.id || "ALL",
    }));
    setTripQuery(trip?.label || "");
    setShowTripSuggestions(false);
  };

  const validateFilters = () => {
    if (filters.startDate && filters.endDate) {
      const start = new Date(`${filters.startDate}T00:00:00`);
      const end = new Date(`${filters.endDate}T23:59:59`);
      if (start > end) {
        return "Start date must be before the end date.";
      }
    }

    if (
      filters.minAmount !== "" &&
      filters.maxAmount !== "" &&
      Number(filters.minAmount) > Number(filters.maxAmount)
    ) {
      return "Minimum amount must be less than maximum amount.";
    }

    if (filteredInvoices.length === 0) {
      return "No invoices match the selected export filters.";
    }

    return "";
  };

  const handleExport = () => {
    const validationError = validateFilters();
    if (validationError) {
      setError(validationError);
      return;
    }

    setExporting(true);

    try {
      const exportInfo = [
        ["INVOICE LIST"],
        [""],
        ["Trip:", getTripFilterLabel(filters, tripQuery)],
        ["Status:", filters.status === "ALL" ? "All Statuses" : filters.status],
        ["Date Range:", getDateRangeLabel(filters)],
        ["Amount Range:", getAmountRangeLabel(filters)],
        ["Exported At:", new Date().toLocaleString()],
        ["Total Invoices:", filteredInvoices.length],
        ["Total Amount:", totalAmount],
        [""],
      ];

      const tableHeaders = [
        "Invoice Number",
        "Shipment ID",
        "Trip ID",
        "Sender",
        "Recipient",
        "Route",
        "Status",
        "Invoice Date",
        "Due Date",
        "Amount",
        "Packages",
        "Items",
        "Notes",
      ];

      const rows = filteredInvoices.map((invoice) => [
        invoice.invoiceNumber || invoice.id || "-",
        getShipmentDisplayId(invoice),
        getInvoiceTripId(invoice) || "-",
        invoice.senderName || "-",
        invoice.recipientName || "-",
        getRouteLabel(invoice),
        invoice.status || "DRAFT",
        formatDate(invoice.invoiceDate || invoice.createdAt),
        formatDate(invoice.dueDate),
        Number(invoice.amount || 0),
        Number(invoice.totalPackages || 0),
        Number(invoice.totalItems || 0),
        invoice.notes || "",
      ]);

      const totalsRow = [
        "TOTAL",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        totalAmount,
        "",
        "",
        "",
      ];

      const finalData = [...exportInfo, tableHeaders, ...rows, totalsRow];
      const worksheet = XLSX.utils.aoa_to_sheet(finalData);

      worksheet["!cols"] = [
        { wch: 24 },
        { wch: 24 },
        { wch: 18 },
        { wch: 24 },
        { wch: 24 },
        { wch: 34 },
        { wch: 14 },
        { wch: 16 },
        { wch: 16 },
        { wch: 14 },
        { wch: 12 },
        { wch: 10 },
        { wch: 45 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");

      XLSX.writeFile(
        workbook,
        `Invoices_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );

      setIsOpen(false);
    } catch (err) {
      console.error("Invoice export error:", err);
      setError(err.message || "Failed to export invoices.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={loading || invoices.length === 0}
        className="bg-green-600 hover:bg-green-500 disabled:opacity-60 disabled:cursor-not-allowed text-white px-3 sm:px-4 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors"
        title="Download invoice Excel"
      >
        <FontAwesomeIcon icon={faFileExcel} />
        <span className="hidden sm:inline">Export Excel</span>
      </button>

      {isOpen && (
        <div className={`fixed inset-0 z-[120] ${modalTheme.overlay}`}>
          <div className="absolute inset-0 overflow-y-auto">
            <div className="min-h-full flex items-center justify-center p-4">
              <div
                className={`w-full max-w-2xl border shadow-2xl ${modalTheme.modal}`}
              >
                <div
                  className={`px-5 sm:px-6 py-4 border-b flex items-center justify-between gap-3 ${modalTheme.header}`}
                >
                  <div>
                    <h3 className={`text-lg font-bold ${modalTheme.title}`}>
                      Generate Invoice Excel
                    </h3>
                    <p className={`text-sm mt-1 ${modalTheme.bodyText}`}>
                      {filteredInvoices.length} invoice
                      {filteredInvoices.length === 1 ? "" : "s"} match the
                      selected filters.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className={modalTheme.closeButton}
                    aria-label="Close export modal"
                  >
                    <FontAwesomeIcon icon={faTimes} className="text-lg" />
                  </button>
                </div>

                <div className="p-5 sm:p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Trip
                      </label>
                      <div className="relative mt-1">
                        <input
                          type="text"
                          value={tripQuery}
                          autoComplete="off"
                          placeholder="Type to search trip..."
                          onChange={(e) => handleTripType(e.target.value)}
                          onFocus={() => setShowTripSuggestions(true)}
                          onBlur={() =>
                            setTimeout(() => setShowTripSuggestions(false), 200)
                          }
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 ${modalTheme.input}`}
                        />

                        {showTripSuggestions && (
                          <div
                            className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 max-h-56 overflow-y-auto ${modalTheme.modal}`}
                          >
                            <button
                              type="button"
                              onMouseDown={() => handleTripSelect(null)}
                              className={`w-full text-left px-3 py-2 border-b transition-colors ${modalTheme.divider} ${
                                isDark ? "hover:bg-slate-800" : "hover:bg-slate-50"
                              }`}
                            >
                              <div
                                className={`text-sm font-semibold ${modalTheme.title}`}
                              >
                                All Trips
                              </div>
                              <div
                                className={`text-[11px] ${modalTheme.helperText}`}
                              >
                                Export invoices from every trip
                              </div>
                            </button>

                            {filteredTripOptions.length > 0 ? (
                              filteredTripOptions.map((trip) => (
                                <button
                                  key={trip.id}
                                  type="button"
                                  onMouseDown={() => handleTripSelect(trip)}
                                  className={`w-full text-left px-3 py-2 border-b last:border-b-0 transition-colors ${modalTheme.divider} ${
                                    isDark
                                      ? "hover:bg-slate-800"
                                      : "hover:bg-slate-50"
                                  }`}
                                >
                                  <div
                                    className={`text-sm font-semibold flex items-center gap-2 ${modalTheme.title}`}
                                  >
                                    <FontAwesomeIcon icon={faRoute} />
                                    {trip.id}
                                  </div>
                                  <div
                                    className={`text-[11px] mt-0.5 ${modalTheme.helperText}`}
                                  >
                                    {trip.label}
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div
                                className={`p-3 text-center text-xs italic ${modalTheme.helperText}`}
                              >
                                No matching trips found
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Status
                      </label>
                      <select
                        value={filters.status}
                        onChange={(e) => updateFilter("status", e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      >
                        <option value="ALL">All Statuses</option>
                        {INVOICE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Invoice Date From
                      </label>
                      <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) =>
                          updateFilter("startDate", e.target.value)
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Invoice Date To
                      </label>
                      <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => updateFilter("endDate", e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Minimum Amount
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={filters.minAmount}
                        onChange={(e) =>
                          updateFilter("minAmount", e.target.value)
                        }
                        placeholder="0.00"
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Maximum Amount
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={filters.maxAmount}
                        onChange={(e) =>
                          updateFilter("maxAmount", e.target.value)
                        }
                        placeholder="No limit"
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>
                  </div>

                  <div
                    className={`rounded-lg border px-4 py-3 text-sm ${isDark ? "border-slate-800 bg-slate-950 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                  >
                    <span className="font-semibold">
                      {filteredInvoices.length}
                    </span>{" "}
                    of {invoices.length} loaded invoices will be exported.
                  </div>

                  {error && <div className={modalTheme.errorBox}>{error}</div>}
                </div>

                <div
                  className={`px-5 sm:px-6 py-4 border-t flex flex-col sm:flex-row justify-end gap-2 ${modalTheme.divider}`}
                >
                  <button
                    type="button"
                    onClick={resetFilters}
                    className={
                      isDark
                        ? "px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                        : "px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    }
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className={
                      isDark
                        ? "px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
                        : "px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={exporting || filteredInvoices.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FontAwesomeIcon icon={faFileExcel} />
                    {exporting ? "Exporting..." : "Export Excel"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
