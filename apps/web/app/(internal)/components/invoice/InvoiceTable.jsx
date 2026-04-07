"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faFilter,
  faChevronLeft,
  faChevronRight,
  faSync,
  faEye,
  faEdit,
  faPaperPlane,
  faCircleCheck,
  faBan,
} from "@fortawesome/free-solid-svg-icons";
import { getTableTheme } from "@/app/utility/constant/theme";

function getStatusBadgeClass(status, isDark = false) {
  if (status === "PAID") {
    return isDark
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (status === "ISSUED") {
    return isDark
      ? "bg-violet-500/10 text-violet-300 border-violet-500/20"
      : "bg-violet-50 text-violet-700 border-violet-200";
  }

  if (status === "CANCELLED") {
    return isDark
      ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
      : "bg-rose-50 text-rose-700 border-rose-200";
  }

  return isDark
    ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
    : "bg-amber-50 text-amber-700 border-amber-200";
}

function formatAmount(value) {
  return `₱${Number(value || 0).toLocaleString()}`;
}

export default function InvoiceTable({
  invoices = [],
  loading = false,
  onRefresh,
  onViewInvoice,
  onEditInvoice,
  onIssueInvoice,
  onMarkPaid,
  onCancelInvoice,
  isDark = false,
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const itemsPerPage = 10;
  const theme = getTableTheme(isDark);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const keyword = search.toLowerCase();

      const searchContent = `
        ${invoice.invoiceNumber || ""}
        ${invoice.shipmentTrackingNumber || ""}
        ${invoice.shipmentId || ""}
        ${invoice.senderName || ""}
        ${invoice.recipientName || ""}
        ${invoice.routeLabel || ""}
        ${invoice.status || ""}
      `.toLowerCase();

      const matchesSearch = searchContent.includes(keyword);
      const matchesStatus =
        statusFilter === "ALL" || invoice.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredInvoices.length / itemsPerPage),
  );

  const currentPage = Math.min(page, totalPages);

  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const emptyMessage =
    invoices.length === 0
      ? "No invoices found."
      : "No matching invoices found.";

  return (
    <div
      className={`border rounded-xl overflow-hidden shadow-lg ${theme.container}`}
    >
      {/* Header */}
      <div
        className={`px-4 sm:px-6 py-4 border-b flex justify-between items-center ${theme.header}`}
      >
        <h2 className={`font-bold ${theme.headingText}`}>Invoices</h2>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={`transition-colors p-2 rounded ${theme.editButton}`}
          title="Refresh"
        >
          <FontAwesomeIcon icon={faSync} spin={loading} />
        </button>
      </div>

      {/* Filters */}
      <div
        className={`px-4 sm:px-6 py-3 border-b flex flex-col sm:flex-row gap-3 ${theme.filters}`}
      >
        <div className="relative flex-1">
          <FontAwesomeIcon
            icon={faSearch}
            className={`absolute left-3 top-2.5 ${theme.inputIcon}`}
          />
          <input
            type="text"
            placeholder="Search invoice, shipment, sender, recipient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full border rounded-lg pl-8 pr-3 py-1.5 focus:border-blue-500 outline-none transition-colors ${theme.input}`}
          />
        </div>

        <div className="relative w-full sm:w-44">
          <FontAwesomeIcon
            icon={faFilter}
            className={`absolute left-3 top-2.5 ${theme.inputIcon}`}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`w-full border rounded-lg pl-8 pr-3 py-1.5 focus:border-blue-500 outline-none appearance-none cursor-pointer ${theme.input}`}
          >
            <option value="ALL">All Invoices</option>
            <option value="DRAFT">Draft</option>
            <option value="ISSUED">Issued</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
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
              <div className="animate-pulse">Loading invoices...</div>
            </div>
          ) : paginatedInvoices.length === 0 ? (
            <div className={`px-6 py-8 text-center italic ${theme.emptyText}`}>
              {emptyMessage}
            </div>
          ) : (
            paginatedInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className={`p-4 flex flex-col gap-3 transition-colors ${theme.rowHover}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="truncate">
                    <div
                      className={`font-medium truncate ${theme.cellPrimary}`}
                    >
                      {invoice.invoiceNumber || "—"}
                    </div>
                    <div className={`text-xs truncate ${theme.cellSecondary}`}>
                      {invoice.shipmentTrackingNumber ||
                        invoice.shipmentId ||
                        "—"}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadgeClass(
                      invoice.status || "DRAFT",
                      isDark,
                    )}`}
                  >
                    {invoice.status || "DRAFT"}
                  </span>
                </div>

                <div>
                  <div className={`text-sm ${theme.cellPrimary}`}>
                    {invoice.senderName || "Unknown Sender"}
                  </div>
                  <div className={`text-xs ${theme.cellSecondary}`}>
                    {invoice.recipientName || "Unknown Recipient"}
                  </div>
                </div>

                <div className={`text-xs ${theme.cellSecondary}`}>
                  {invoice.routeLabel || "—"}
                </div>

                <div className="flex justify-between items-end mt-1 gap-3">
                  <div>
                    <div className={`font-semibold ${theme.cellPrimary}`}>
                      {formatAmount(invoice.amount)}
                    </div>
                    <div className={`text-xs ${theme.cellSecondary}`}>
                      Due: {invoice.dueDate || "—"}
                    </div>
                  </div>

                  <div className="flex gap-1 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={() => onViewInvoice?.(invoice)}
                      className={`transition-colors p-2 rounded ${theme.editButton}`}
                      title="View Invoice"
                    >
                      <FontAwesomeIcon icon={faEye} />
                    </button>

                    {invoice.status === "DRAFT" && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditInvoice?.(invoice)}
                          className={`transition-colors p-2 rounded ${theme.editButton}`}
                          title="Edit Invoice"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>

                        <button
                          type="button"
                          onClick={() => onIssueInvoice?.(invoice)}
                          className="transition-colors p-2 rounded bg-violet-600 hover:bg-violet-500 text-white"
                          title="Issue Invoice"
                        >
                          <FontAwesomeIcon icon={faPaperPlane} />
                        </button>
                      </>
                    )}

                    {invoice.status === "ISSUED" && (
                      <button
                        type="button"
                        onClick={() => onMarkPaid?.(invoice)}
                        className="transition-colors p-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                        title="Mark Paid"
                      >
                        <FontAwesomeIcon icon={faCircleCheck} />
                      </button>
                    )}

                    {invoice.status !== "PAID" &&
                      invoice.status !== "CANCELLED" && (
                        <button
                          type="button"
                          onClick={() => onCancelInvoice?.(invoice)}
                          className="transition-colors p-2 rounded bg-rose-600 hover:bg-rose-500 text-white"
                          title="Cancel Invoice"
                        >
                          <FontAwesomeIcon icon={faBan} />
                        </button>
                      )}
                  </div>
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
                <th className="px-6 py-3">Invoice / Shipment</th>
                <th className="px-6 py-3">Sender / Recipient</th>
                <th className="px-6 py-3">Route</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Due Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className={`divide-y ${theme.tbodyDivide}`}>
              {loading ? (
                <tr>
                  <td
                    colSpan="7"
                    className={`px-6 py-8 text-center ${theme.emptyText}`}
                  >
                    <div className="animate-pulse">Loading invoices...</div>
                  </td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className={`px-6 py-8 text-center italic ${theme.emptyText}`}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className={`transition-colors ${theme.rowHover}`}
                  >
                    <td className="px-6 py-4">
                      <div className={`font-medium ${theme.cellPrimary}`}>
                        {invoice.invoiceNumber || "—"}
                      </div>
                      <div className={`text-xs ${theme.cellSecondary}`}>
                        {invoice.shipmentTrackingNumber ||
                          invoice.shipmentId ||
                          "—"}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className={`font-medium ${theme.cellPrimary}`}>
                        {invoice.senderName || "Unknown Sender"}
                      </div>
                      <div className={`text-xs ${theme.cellSecondary}`}>
                        {invoice.recipientName || "Unknown Recipient"}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={theme.cellSecondary}>
                        {invoice.routeLabel || "—"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`font-semibold ${theme.cellPrimary}`}>
                        {formatAmount(invoice.amount)}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className={theme.cellSecondary}>
                        {invoice.dueDate || "—"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadgeClass(
                          invoice.status || "DRAFT",
                          isDark,
                        )}`}
                      >
                        {invoice.status || "DRAFT"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onViewInvoice?.(invoice)}
                          className={`transition-colors p-2 rounded ${theme.editButton}`}
                          title="View Invoice"
                        >
                          <FontAwesomeIcon icon={faEye} />
                        </button>

                        {invoice.status === "DRAFT" && (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditInvoice?.(invoice)}
                              className={`transition-colors p-2 rounded ${theme.editButton}`}
                              title="Edit Invoice"
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </button>

                            <button
                              type="button"
                              onClick={() => onIssueInvoice?.(invoice)}
                              className="transition-colors p-2 rounded bg-violet-600 hover:bg-violet-500 text-white"
                              title="Issue Invoice"
                            >
                              <FontAwesomeIcon icon={faPaperPlane} />
                            </button>
                          </>
                        )}

                        {invoice.status === "ISSUED" && (
                          <button
                            type="button"
                            onClick={() => onMarkPaid?.(invoice)}
                            className="transition-colors p-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                            title="Mark Paid"
                          >
                            <FontAwesomeIcon icon={faCircleCheck} />
                          </button>
                        )}

                        {invoice.status !== "PAID" &&
                          invoice.status !== "CANCELLED" && (
                            <button
                              type="button"
                              onClick={() => onCancelInvoice?.(invoice)}
                              className="transition-colors p-2 rounded bg-rose-600 hover:bg-rose-500 text-white"
                              title="Cancel Invoice"
                            >
                              <FontAwesomeIcon icon={faBan} />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && filteredInvoices.length > 0 && (
        <div
          className={`px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row justify-between items-center gap-3 text-xs ${theme.footer}`}
        >
          <span>
            Showing{" "}
            <span className={`font-bold ${theme.footerBold}`}>
              {Math.min(currentPage * itemsPerPage, filteredInvoices.length)}
            </span>{" "}
            of {filteredInvoices.length}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
            >
              <FontAwesomeIcon icon={faChevronLeft} className="mr-1" />
            </button>

            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
            >
              <FontAwesomeIcon icon={faChevronRight} className="ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
