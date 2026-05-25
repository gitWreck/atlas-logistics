"use client";

import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faEnvelope,
  faFileInvoice,
  faIdBadge,
  faLocationDot,
  faPhone,
  faTimes,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";
import { getDrawerThemeClasses } from "@/app/utility/constant/theme";

function getCustomerStatus(customer) {
  return String(
    customer?.status || (customer?.active === false ? "inactive" : "active"),
  ).toLowerCase();
}

function getCustomerId(customer) {
  return (
    customer?.publicId ||
    customer?.userCode ||
    customer?.customerCode ||
    customer?.uid ||
    customer?.id ||
    "N/A"
  );
}

function getAddressLine(address = {}) {
  return [
    address.street,
    address.barangay,
    address.city,
    address.province,
    address.zipCode || address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function DetailItem({ icon, label, value, theme }) {
  return (
    <div className={`border rounded-lg p-4 ${theme.reasonBox}`}>
      <div className={`text-[10px] font-bold uppercase mb-2 ${theme.mutedText}`}>
        {label}
      </div>
      <div className={`flex items-start gap-3 text-sm ${theme.title}`}>
        <FontAwesomeIcon icon={icon} className={`mt-0.5 ${theme.mutedText}`} />
        <span className="break-words">{value || "N/A"}</span>
      </div>
    </div>
  );
}

function EmptyPanel({ message, theme }) {
  return (
    <div className={`border rounded-lg p-10 text-center ${theme.reasonBox}`}>
      <FontAwesomeIcon
        icon={faBoxOpen}
        className={`text-3xl mb-3 ${theme.mutedText}`}
      />
      <p className={`text-sm italic ${theme.mutedText}`}>{message}</p>
    </div>
  );
}

function CustomerDetailsTab({
  customer,
  addressLine,
  createdAt,
  updatedAt,
  lastAuthAt,
  theme,
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DetailItem
          icon={faIdBadge}
          label="Customer ID"
          value={getCustomerId(customer)}
          theme={theme}
        />
        <DetailItem
          icon={faUser}
          label="Name"
          value={customer.name}
          theme={theme}
        />
        <DetailItem
          icon={faEnvelope}
          label="Email"
          value={customer.email}
          theme={theme}
        />
        <DetailItem
          icon={faPhone}
          label="Phone"
          value={customer.phoneNumber || customer.phone}
          theme={theme}
        />
        <div className="sm:col-span-2">
          <DetailItem
            icon={faLocationDot}
            label="Address"
            value={addressLine}
            theme={theme}
          />
        </div>
      </div>

      <div className="mt-6">
        <h3
          className={`text-xs font-bold uppercase tracking-wider mb-3 ${theme.mutedText}`}
        >
          Account Activity
        </h3>
        <div className={`border rounded-lg overflow-hidden ${theme.reasonBox}`}>
          {[
            ["Created", createdAt],
            ["Last login", lastAuthAt],
            ["Updated", updatedAt],
          ].map(([label, value]) => (
            <div
              key={label}
              className={`flex items-center justify-between gap-4 px-4 py-3 border-b last:border-b-0 ${theme.divider}`}
            >
              <span className={`text-xs font-medium ${theme.mutedText}`}>
                {label}
              </span>
              <span className={`text-sm text-right ${theme.title}`}>
                {value || "N/A"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function CustomerShipmentsTab({ shipments = [], theme }) {
  if (!shipments.length) {
    return <EmptyPanel message="No shipments found." theme={theme} />;
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${theme.reasonBox}`}>
      {shipments.map((shipment, index) => (
        <div
          key={shipment.id || shipment.shipmentId || index}
          className={`px-4 py-3 border-b last:border-b-0 ${theme.divider}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className={`font-mono text-sm font-bold ${theme.title}`}>
                {shipment.trackingNumber || shipment.shipmentId || "Shipment"}
              </div>
              <div className={`text-xs mt-1 truncate ${theme.mutedText}`}>
                {shipment.route || shipment.destination || "No route"}
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-500">
              {shipment.status || "N/A"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomerInvoicesTab({ invoices = [], theme }) {
  if (!invoices.length) {
    return <EmptyPanel message="No invoices found." theme={theme} />;
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${theme.reasonBox}`}>
      {invoices.map((invoice, index) => (
        <div
          key={invoice.id || invoice.invoiceId || index}
          className={`px-4 py-3 border-b last:border-b-0 ${theme.divider}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className={`font-mono text-sm font-bold ${theme.title}`}>
                {invoice.invoiceNumber || invoice.invoiceId || "Invoice"}
              </div>
              <div className={`text-xs mt-1 ${theme.mutedText}`}>
                {invoice.dueDate
                  ? `Due ${formatFirestoreDate(invoice.dueDate)}`
                  : "No due date"}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className={`text-sm font-bold ${theme.title}`}>
                {invoice.amount || invoice.totalAmount || "N/A"}
              </div>
              <div className="mt-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-500">
                {invoice.status || "N/A"}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TabButton({ active, icon, label, onClick, theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-2 uppercase tracking-wide ${
        active ? theme.tabActive : theme.tabIdle
      }`}
    >
      <FontAwesomeIcon icon={icon} />
      {label}
    </button>
  );
}

export default function CustomerDrawer({
  isOpen,
  onClose,
  customer,
  isDark = false,
}) {
  const [activeTab, setActiveTab] = useState("DETAILS");
  const theme = getDrawerThemeClasses(isDark);

  useEffect(() => {
    if (isOpen) setActiveTab("DETAILS");
  }, [customer?.id, customer?.uid, isOpen]);

  if (!customer) return null;

  const status = getCustomerStatus(customer);
  const addressLine = getAddressLine(customer.address);
  const createdAt = formatFirestoreDate(customer.createdAt);
  const updatedAt = formatFirestoreDate(customer.updatedAt);
  const lastAuthAt = formatFirestoreDate(customer.lastAuthAt);
  const statusClass =
    status === "active"
      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
      : status === "suspended"
        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
        : "bg-slate-500/10 text-slate-500 border-slate-500/20";

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${theme.overlay} ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <aside
        style={{ width: "min(100%, 640px)" }}
        className={`fixed top-0 right-0 h-full z-50 shadow-2xl transform transition-transform duration-300 flex flex-col ${theme.drawer} ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div
          className={`p-6 border-b flex justify-between items-start gap-4 ${theme.header}`}
        >
          <div className="min-w-0">
            <div
              className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${theme.eyebrow}`}
            >
              Customer Details
            </div>
            <h2
              className={`text-xl font-bold tracking-tight break-words ${theme.title}`}
            >
              {customer.name || "Unnamed customer"}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusClass}`}
              >
                {status}
              </span>
              <span
                className={`text-xs border-l pl-2 ml-1 ${theme.mutedText} ${theme.divider}`}
              >
                {getCustomerId(customer)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${theme.closeButton}`}
            aria-label="Close drawer"
          >
            <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
          </button>
        </div>

        <div className={`flex border-b ${theme.tabsWrap}`}>
          <TabButton
            active={activeTab === "DETAILS"}
            icon={faUser}
            label="Details"
            onClick={() => setActiveTab("DETAILS")}
            theme={theme}
          />
          <TabButton
            active={activeTab === "SHIPMENTS"}
            icon={faBoxOpen}
            label="Shipments"
            onClick={() => setActiveTab("SHIPMENTS")}
            theme={theme}
          />
          <TabButton
            active={activeTab === "INVOICES"}
            icon={faFileInvoice}
            label="Invoices"
            onClick={() => setActiveTab("INVOICES")}
            theme={theme}
          />
        </div>

        <div className={`flex-1 overflow-y-auto p-6 ${theme.content}`}>
          {activeTab === "DETAILS" && (
            <CustomerDetailsTab
              customer={customer}
              addressLine={addressLine}
              createdAt={createdAt}
              updatedAt={updatedAt}
              lastAuthAt={lastAuthAt}
              theme={theme}
            />
          )}

          {activeTab === "SHIPMENTS" && (
            <CustomerShipmentsTab
              shipments={customer.shipments || []}
              theme={theme}
            />
          )}

          {activeTab === "INVOICES" && (
            <CustomerInvoicesTab
              invoices={customer.invoices || []}
              theme={theme}
            />
          )}
        </div>
      </aside>
    </>
  );
}
