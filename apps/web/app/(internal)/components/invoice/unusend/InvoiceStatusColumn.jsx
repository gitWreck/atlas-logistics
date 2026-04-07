"use client";

import React from "react";
import InvoiceCard from "../InvoiceCard";

function getStatusMeta(status, isDark = false) {
  const normalized = String(status || "").toUpperCase();

  const map = {
    DRAFT: {
      title: "Draft",
      badge: isDark
        ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
        : "bg-amber-50 text-amber-700 border-amber-200",
      column: isDark
        ? "bg-slate-950/50 border-slate-800"
        : "bg-slate-50 border-slate-200",
    },
    ISSUED: {
      title: "Issued",
      badge: isDark
        ? "bg-violet-500/10 text-violet-300 border-violet-500/20"
        : "bg-violet-50 text-violet-700 border-violet-200",
      column: isDark
        ? "bg-slate-950/50 border-slate-800"
        : "bg-slate-50 border-slate-200",
    },
    PAID: {
      title: "Paid",
      badge: isDark
        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
        : "bg-emerald-50 text-emerald-700 border-emerald-200",
      column: isDark
        ? "bg-slate-950/50 border-slate-800"
        : "bg-slate-50 border-slate-200",
    },
    CANCELLED: {
      title: "Cancelled",
      badge: isDark
        ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
        : "bg-rose-50 text-rose-700 border-rose-200",
      column: isDark
        ? "bg-slate-950/50 border-slate-800"
        : "bg-slate-50 border-slate-200",
    },
  };

  return (
    map[normalized] || {
      title: normalized || "Unknown",
      badge: isDark
        ? "bg-slate-800 text-slate-300 border-slate-700"
        : "bg-slate-100 text-slate-700 border-slate-200",
      column: isDark
        ? "bg-slate-950/50 border-slate-800"
        : "bg-slate-50 border-slate-200",
    }
  );
}

export default function InvoiceStatusColumn({
  status = "DRAFT",
  title,
  invoices = [],
  isDark = false,
  onViewInvoice,
  onEditInvoice,
  onIssueInvoice,
  onMarkPaid,
  onCancelInvoice,
}) {
  const meta = getStatusMeta(status, isDark);

  return (
    <div
      className={`rounded-2xl border min-h-[500px] flex flex-col ${meta.column}`}
    >
      <div
        className={`px-4 py-4 border-b flex items-center justify-between ${
          isDark ? "border-slate-800" : "border-slate-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <h3
            className={`text-sm font-bold uppercase tracking-widest ${
              isDark ? "text-slate-200" : "text-slate-700"
            }`}
          >
            {title || meta.title}
          </h3>

          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.badge}`}
          >
            {invoices.length}
          </span>
        </div>
      </div>

      <div className="flex-1 p-3 space-y-3">
        {invoices.length === 0 ? (
          <div
            className={`rounded-xl border border-dashed p-6 text-center ${
              isDark
                ? "border-slate-800 text-slate-500"
                : "border-slate-300 text-slate-400"
            }`}
          >
            <p className="text-sm italic">No invoices in this column.</p>
          </div>
        ) : (
          invoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id || invoice.invoiceNumber}
              invoice={invoice}
              isDark={isDark}
              onView={() => onViewInvoice?.(invoice)}
              onEdit={() => onEditInvoice?.(invoice)}
              onIssue={() => onIssueInvoice?.(invoice)}
              onMarkPaid={() => onMarkPaid?.(invoice)}
              onCancel={() => onCancelInvoice?.(invoice)}
            />
          ))
        )}
      </div>
    </div>
  );
}
