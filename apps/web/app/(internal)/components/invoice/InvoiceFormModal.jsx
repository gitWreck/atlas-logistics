"use client";

import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faFileInvoiceDollar,
  faFloppyDisk,
} from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";

function buildInitialForm(shipment, invoice, mode) {
  if (mode === "edit" && invoice) {
    return {
      shipmentId: invoice.shipmentId || shipment?.id || "",
      shipmentTrackingNumber:
        invoice.shipmentTrackingNumber ||
        shipment?.trackingNumber ||
        shipment?.id ||
        "",
      invoiceNumber: invoice.invoiceNumber || "",
      invoiceDate: invoice.invoiceDate || "",
      dueDate: invoice.dueDate || "",
      billingName: invoice.billingName || shipment?.sender?.name || "",
      billingAddress:
        invoice.billingAddress || shipment?.sender?.formattedAddress || "",
      senderName: invoice.senderName || shipment?.sender?.name || "",
      senderPhone: invoice.senderPhone || shipment?.sender?.phone || "",
      recipientName: invoice.recipientName || shipment?.recipient?.name || "",
      recipientPhone:
        invoice.recipientPhone || shipment?.recipient?.phone || "",
      origin: invoice.origin || shipment?.origin || "",
      destination: invoice.destination || shipment?.destination || "",
      routeLabel:
        invoice.routeLabel ||
        `${shipment?.origin || "Unknown"} → ${shipment?.destination || "Unknown"}`,
      shipmentStatus: invoice.shipmentStatus || shipment?.status || "",
      truckTripId: invoice.truckTripId || shipment?.currentTruckTripId || "",
      totalPackages: invoice.totalPackages || shipment?.packages?.length || 0,
      totalItems: invoice.totalItems || shipment?.totals?.totalItems || 0,
      amount: invoice.amount ?? 0,
      notes: invoice.notes || "",
      status: invoice.status || "DRAFT",
      shipmentSnapshot: invoice.shipmentSnapshot || shipment || null,
    };
  }

  return {
    shipmentId: shipment?.id || "",
    shipmentTrackingNumber: shipment?.trackingNumber || shipment?.id || "",
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    billingName: shipment?.sender?.name || "",
    billingAddress: shipment?.sender?.formattedAddress || "",
    senderName: shipment?.sender?.name || "",
    senderPhone: shipment?.sender?.phone || "",
    recipientName: shipment?.recipient?.name || "",
    recipientPhone: shipment?.recipient?.phone || "",
    origin: shipment?.origin || "",
    destination: shipment?.destination || "",
    routeLabel: `${shipment?.origin || "Unknown"} → ${shipment?.destination || "Unknown"}`,
    shipmentStatus: shipment?.status || "",
    truckTripId: shipment?.currentTruckTripId || "",
    totalPackages: shipment?.packages?.length || 0,
    totalItems: shipment?.totals?.totalItems || 0,
    amount: 0,
    notes: "",
    status: "DRAFT",
    shipmentSnapshot: shipment || null,
  };
}

export default function InvoiceFormModal({
  isOpen = false,
  mode = "create",
  shipment = null,
  invoice = null,
  onClose,
  onSubmit,
  isDark = false,
}) {
  const [form, setForm] = useState(buildInitialForm(shipment, invoice, mode));

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

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Shipment ID
                      </label>
                      <input
                        type="text"
                        value={form.shipmentId}
                        readOnly
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
                    </div>

                    <div>
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Tracking Number
                      </label>
                      <input
                        type="text"
                        value={form.shipmentTrackingNumber}
                        readOnly
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />
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

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div>
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
                    </div>

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
                  <span className="inline-flex items-center gap-2">
                    <FontAwesomeIcon icon={faFloppyDisk} />
                    {mode === "edit" ? "Save Changes" : "Save Invoice"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
