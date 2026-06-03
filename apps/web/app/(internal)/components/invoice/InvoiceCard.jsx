"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileInvoiceDollar,
  faBoxOpen,
  faPesoSign,
  faCalendarDays,
  faRoute,
  faEye,
  faPenToSquare,
  faPaperPlane,
  faCircleCheck,
  faBan,
  faHashtag,
} from "@fortawesome/free-solid-svg-icons";
import { formatAmount } from "./invoiceHelpers";

function getStatusStyles(status, isDark = false) {
  const normalized = String(status || "").toUpperCase();

  const styles = {
    DRAFT: isDark
      ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
      : "bg-amber-50 text-amber-700 border-amber-200",
    ISSUED: isDark
      ? "bg-violet-500/10 text-violet-300 border-violet-500/20"
      : "bg-violet-50 text-violet-700 border-violet-200",
    PAID: isDark
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
      : "bg-emerald-50 text-emerald-700 border-emerald-200",
    CANCELLED: isDark
      ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
      : "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    styles[normalized] ||
    (isDark
      ? "bg-slate-800 text-slate-300 border-slate-700"
      : "bg-slate-100 text-slate-700 border-slate-200")
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  isDark = false,
  tone = "default",
}) {
  const toneMap = {
    default: isDark
      ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
      : "bg-slate-100 hover:bg-slate-200 text-slate-700",
    blue: isDark
      ? "bg-blue-600 hover:bg-blue-500 text-white"
      : "bg-blue-600 hover:bg-blue-700 text-white",
    violet: isDark
      ? "bg-violet-600 hover:bg-violet-500 text-white"
      : "bg-violet-600 hover:bg-violet-700 text-white",
    emerald: isDark
      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
      : "bg-emerald-600 hover:bg-emerald-700 text-white",
    rose: isDark
      ? "bg-rose-600 hover:bg-rose-500 text-white"
      : "bg-rose-600 hover:bg-rose-700 text-white",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition-colors ${toneMap[tone] || toneMap.default}`}
    >
      <FontAwesomeIcon icon={icon} />
      <span>{label}</span>
    </button>
  );
}

function InfoLine({ icon, label, value, isDark = false }) {
  return (
    <div className="flex items-start gap-2">
      <FontAwesomeIcon
        icon={icon}
        className={`mt-0.5 text-xs ${
          isDark ? "text-slate-500" : "text-slate-400"
        }`}
      />
      <div className="min-w-0">
        <p
          className={`text-[10px] uppercase tracking-widest font-bold ${
            isDark ? "text-slate-500" : "text-slate-400"
          }`}
        >
          {label}
        </p>
        <p
          className={`text-sm break-words ${
            isDark ? "text-slate-100" : "text-slate-800"
          }`}
        >
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

export default function InvoiceCard({
  invoice,
  isDark = false,
  onView,
  onEdit,
  onIssue,
  onMarkPaid,
  onCancel,
}) {
  if (!invoice) return null;

  const status = invoice.status || "DRAFT";
  const cardShell = isDark
    ? "bg-slate-900 border-slate-800 hover:border-slate-700"
    : "bg-white border-slate-200 hover:border-slate-300";

  return (
    <article
      className={`rounded-2xl border shadow-sm p-4 transition-colors ${cardShell}`}
    >
      {/* Top */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div
              className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                isDark
                  ? "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}
            >
              <FontAwesomeIcon icon={faFileInvoiceDollar} />
            </div>

            <div className="min-w-0">
              <p
                className={`text-[10px] uppercase tracking-widest font-bold ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Invoice
              </p>
              <h4
                className={`text-sm font-bold truncate ${
                  isDark ? "text-slate-100" : "text-slate-800"
                }`}
              >
                {invoice.invoiceNumber || "Untitled Invoice"}
              </h4>
            </div>
          </div>
        </div>

        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${getStatusStyles(
            status,
            isDark,
          )}`}
        >
          {status}
        </span>
      </div>

      {/* Main */}
      <div className="mt-4 space-y-3">
        <InfoLine
          icon={faHashtag}
          label="Shipment"
          value={invoice.shipmentTrackingNumber || invoice.shipmentId}
          isDark={isDark}
        />

        <InfoLine
          icon={faRoute}
          label="Route"
          value={invoice.routeLabel}
          isDark={isDark}
        />

        <div className="grid grid-cols-1 gap-3">
          <InfoLine
            icon={faFileInvoiceDollar}
            label="Sender → Recipient"
            value={`${invoice.senderName || "Unknown Sender"} → ${
              invoice.recipientName || "Unknown Recipient"
            }`}
            isDark={isDark}
          />

          <div className="grid grid-cols-2 gap-3">
            <InfoLine
              icon={faBoxOpen}
              label="Packages"
              value={invoice.totalPackages}
              isDark={isDark}
            />
            <InfoLine
              icon={faBoxOpen}
              label="Items"
              value={invoice.totalItems}
              isDark={isDark}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoLine
              icon={faPesoSign}
              label="Amount"
              value={formatAmount(invoice.amount)}
              isDark={isDark}
            />
            <InfoLine
              icon={faCalendarDays}
              label="Due Date"
              value={invoice.dueDate}
              isDark={isDark}
            />
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div
        className={`mt-4 pt-4 border-t flex flex-wrap gap-2 ${
          isDark ? "border-slate-800" : "border-slate-200"
        }`}
      >
        <ActionButton
          icon={faEye}
          label="View"
          onClick={onView}
          isDark={isDark}
          tone="default"
        />

        {status === "DRAFT" && (
          <>
            <ActionButton
              icon={faPenToSquare}
              label="Edit"
              onClick={onEdit}
              isDark={isDark}
              tone="blue"
            />
            <ActionButton
              icon={faPaperPlane}
              label="Issue"
              onClick={onIssue}
              isDark={isDark}
              tone="violet"
            />
            <ActionButton
              icon={faBan}
              label="Cancel"
              onClick={onCancel}
              isDark={isDark}
              tone="rose"
            />
          </>
        )}

        {status === "ISSUED" && (
          <>
            <ActionButton
              icon={faCircleCheck}
              label="Mark Paid"
              onClick={onMarkPaid}
              isDark={isDark}
              tone="emerald"
            />
            <ActionButton
              icon={faBan}
              label="Cancel"
              onClick={onCancel}
              isDark={isDark}
              tone="rose"
            />
          </>
        )}
      </div>
    </article>
  );
}
