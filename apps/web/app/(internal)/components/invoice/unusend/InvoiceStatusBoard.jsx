"use client";

import React from "react";
import InvoiceStatusColumn from "./InvoiceStatusColumn";

export default function InvoiceStatusBoard({
  isDark = false,
  groupedInvoices = {},
  statuses = ["DRAFT", "ISSUED", "PAID", "CANCELLED"],
  onViewInvoice,
  onEditInvoice,
  onIssueInvoice,
  onMarkPaid,
  onCancelInvoice,
}) {
  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
        {statuses.map((status) => (
          <InvoiceStatusColumn
            key={status}
            status={status}
            title={status}
            invoices={groupedInvoices?.[status] || []}
            isDark={isDark}
            onViewInvoice={onViewInvoice}
            onEditInvoice={onEditInvoice}
            onIssueInvoice={onIssueInvoice}
            onMarkPaid={onMarkPaid}
            onCancelInvoice={onCancelInvoice}
          />
        ))}
      </div>
    </div>
  );
}
