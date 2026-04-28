"use client";

import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faFileInvoiceDollar,
  faFloppyDisk,
  faCircleNotch,
} from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";
import { buildInitialForm } from "./utils";

export default function InvoiceFormModal({
  isOpen = false,
  loading = false,
  mode = "create",
  shipment = null,
  invoice = null,
  eligibleShipments = [],
  onClose,
  onSubmit,
  isDark = false,
}) {
  const [form, setForm] = useState(buildInitialForm(shipment, invoice, mode));
  const [shipmentQuery, setShipmentQuery] = useState("");
  const [showShipmentDropdown, setShowShipmentDropdown] = useState(false);

  const modalTheme = getModalThemeClasses(isDark);
  const actionTheme = getModalActionClasses();

  useEffect(() => {
    if (isOpen) {
      setForm(buildInitialForm(shipment, invoice, mode));
    }
  }, [isOpen, shipment, invoice, mode]);

  if (!isOpen) return null;

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const filteredShipments = eligibleShipments.filter((item) => {
    const keyword = shipmentQuery.toLowerCase();

    return `
    ${item.id || ""}
    ${item.sender?.name || ""}
    ${item.recipient?.name || ""}
    ${item.origin || ""}
    ${item.destination || ""}
    ${item.currentTripId || ""}
  `
      .toLowerCase()
      .includes(keyword);
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.({
      ...form,
      amount: Number(form.amount || 0),
      totalPackages: Number(form.totalPackages || 0),
      totalItems: Number(form.totalItems || 0),
    });
  };

  return (
    <div className={`fixed inset-0 z-[100] ${modalTheme.overlay}`}>
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-4">
          <div
            className={`w-full max-w-4xl border shadow-2xl ${modalTheme.modal}`}
          >
            <div
              className={`px-5 sm:px-6 py-4 border-b flex items-center justify-between ${modalTheme.header}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center border ${isDark ? "bg-blue-500/10 text-blue-300 border-blue-500/20" : "bg-blue-50 text-blue-700 border-blue-200"}`}
                >
                  <FontAwesomeIcon icon={faFileInvoiceDollar} />
                </div>

                <div>
                  <h2 className={`text-lg font-bold ${modalTheme.title}`}>
                    {mode === "edit" ? "Edit Invoice" : "Create Invoice"}
                  </h2>
                  <p className={`text-sm ${modalTheme.bodyText}`}>
                    {form.shipmentTrackingNumber || "No shipment selected"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={modalTheme.closeButton}
              >
                <FontAwesomeIcon icon={faTimes} className="text-lg" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                <section className="space-y-3">
                  <div>
                    <h3
                      className={`text-sm font-bold uppercase tracking-widest ${modalTheme.title}`}
                    >
                      Shipment Reference
                    </h3>
                    <p className={`text-xs mt-1 ${modalTheme.helperText}`}>
                      Auto-filled from the connected shipment
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    <div className="relative">
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Shipment
                      </label>
                      {/* {JSON.stringify(form, null, 2)} */}
                      <input
                        type="text"
                        value={
                          mode === "edit" || form.shipmentId !== ""
                            ? form.shipmentId || ""
                            : shipmentQuery
                        }
                        placeholder="Search shipment ID, sender, recipient..."
                        disabled={mode === "edit"}
                        onChange={(e) => {
                          setShipmentQuery(e.target.value);
                          setShowShipmentDropdown(true);
                        }}
                        onFocus={() => {
                          if (mode !== "edit") setShowShipmentDropdown(true);
                        }}
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />

                      {mode !== "edit" &&
                        showShipmentDropdown &&
                        filteredShipments.length > 0 && (
                          <div
                            className={`absolute z-50 w-full mt-1 rounded-lg border shadow-xl overflow-hidden max-h-64 overflow-y-auto ${
                              isDark
                                ? "bg-slate-900 border-slate-700"
                                : "bg-white border-slate-200"
                            }`}
                          >
                            {filteredShipments.slice(0, 10).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setShipmentQuery(
                                    `${item.id} — ${item.sender?.name || "Unknown Sender"} → ${item.recipient?.name || "Unknown Recipient"}`,
                                  );

                                  setForm((prev) => ({
                                    ...prev,
                                    shipmentId: item.id || "",
                                    shipmentTrackingNumber:
                                      item.trackingNumber || item.id || "",
                                    shipmentStatus: item.status || "",
                                    truckTripId: item.currentTripId || "",
                                    senderName: item.sender?.name || "",
                                    senderPhone: item.sender?.phone || "",
                                    recipientName: item.recipient?.name || "",
                                    recipientPhone: item.recipient?.phone || "",
                                    origin: item.origin || "",
                                    destination: item.destination || "",
                                    routeLabel: `${item.origin || "Unknown"} → ${item.destination || "Unknown"}`,
                                    billingName: item.sender?.name || "",
                                    billingAddress:
                                      item.sender?.formattedAddress || "",
                                    totalPackages: item.packages?.length || 0,
                                    totalItems: item.totals?.totalItems || 0,
                                    shipmentSnapshot: item,
                                  }));

                                  setShowShipmentDropdown(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                                  isDark
                                    ? "hover:bg-slate-800 text-slate-300"
                                    : "hover:bg-slate-100 text-slate-700"
                                }`}
                              >
                                <div className="font-bold">{item.id}</div>
                                <div className="opacity-70">
                                  {item.sender?.name || "Unknown Sender"} →{" "}
                                  {item.recipient?.name || "Unknown Recipient"}
                                </div>
                                <div className="opacity-50 text-[10px]">
                                  {item.origin || "Unknown"} →{" "}
                                  {item.destination || "Unknown"}
                                  {item.currentTripId
                                    ? ` • ${item.currentTripId}`
                                    : ""}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                    </div>

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Shipment Status
                      </label>
                      <input
                        type="text"
                        value={form.shipmentStatus}
                        readOnly
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Trip ID
                      </label>
                      <input
                        type="text"
                        value={form.truckTripId}
                        readOnly
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3
                    className={`text-sm font-bold uppercase tracking-widest ${modalTheme.title}`}
                  >
                    Invoice Details
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {/* <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Invoice Number
                      </label>
                      <input
                        type="text"
                        value={form.invoiceNumber}
                        onChange={(e) =>
                          updateField("invoiceNumber", e.target.value)
                        }
                        placeholder="e.g. INV-202604-0001"
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div> */}

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Invoice Date
                      </label>
                      <input
                        type="date"
                        value={form.invoiceDate}
                        onChange={(e) =>
                          updateField("invoiceDate", e.target.value)
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={form.dueDate}
                        onChange={(e) => updateField("dueDate", e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Amount
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.amount}
                        onChange={(e) => updateField("amount", e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3
                    className={`text-sm font-bold uppercase tracking-widest ${modalTheme.title}`}
                  >
                    Billing Information
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Billing Name
                      </label>
                      <input
                        type="text"
                        value={form.billingName}
                        onChange={(e) =>
                          updateField("billingName", e.target.value)
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Route
                      </label>
                      <input
                        type="text"
                        value={form.routeLabel}
                        readOnly
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Billing Address
                      </label>
                      <textarea
                        rows={3}
                        value={form.billingAddress}
                        onChange={(e) =>
                          updateField("billingAddress", e.target.value)
                        }
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 resize-none ${modalTheme.input}`}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3
                    className={`text-sm font-bold uppercase tracking-widest ${modalTheme.title}`}
                  >
                    Package Summary
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Sender
                      </label>
                      <input
                        type="text"
                        value={form.senderName}
                        readOnly
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Recipient
                      </label>
                      <input
                        type="text"
                        value={form.recipientName}
                        readOnly
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Total Packages
                      </label>
                      <input
                        type="number"
                        value={form.totalPackages}
                        readOnly
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Total Items
                      </label>
                      <input
                        type="number"
                        value={form.totalItems}
                        readOnly
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3
                    className={`text-sm font-bold uppercase tracking-widest ${modalTheme.title}`}
                  >
                    Notes
                  </h3>

                  <textarea
                    rows={4}
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    placeholder="Optional notes or billing remarks..."
                    className={`w-full rounded-lg border px-3 py-2 text-sm resize-none ${modalTheme.input}`}
                  />
                </section>
              </div>

              <div
                className={`px-5 sm:px-6 py-4 border-t flex justify-end gap-2 ${modalTheme.divider}`}
              >
                <button
                  type="button"
                  onClick={onClose}
                  className={actionTheme.secondary}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={`${actionTheme.primaryInlineCompact} px-4`}
                >
                  {loading ? (
                    <FontAwesomeIcon icon={faCircleNotch} spin />
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <FontAwesomeIcon icon={faFloppyDisk} />
                      {mode === "edit" ? "Save Changes" : "Save Invoice"}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
