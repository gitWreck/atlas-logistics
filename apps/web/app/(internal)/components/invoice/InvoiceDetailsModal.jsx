"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faFileInvoiceDollar,
  faPenToSquare,
  faCircleCheck,
  faBan,
  faPaperPlane,
  faBoxOpen,
  faLocationDot,
  faUser,
  faPhone,
  faTruckFast,
  faPrint,
} from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";
import { formatAmount, StatusBadge, InfoBlock } from "./utils";
import StatusButton from "../ui/StatusButton";
import { invoiceUrl } from "@/app/utility/constant/templates";

export default function InvoiceDetailsModal({
  isOpen = false,
  invoice = null,
  shipment = null,
  onClose,
  onEdit,
  onIssue,
  onMarkPaid,
  onCancel,
  isDark = false,
}) {
  const modalTheme = getModalThemeClasses(isDark);
  const actionTheme = getModalActionClasses();

  if (!isOpen || !invoice) return null;

  const connectedShipment =
    shipment || invoice.shipment || invoice.shipmentSnapshot;
  const packages = connectedShipment?.packages || [];
  const status = invoice.status || "DRAFT";

  return (
    <div className={`fixed inset-0 z-[110] ${modalTheme.overlay}`}>
      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-4">
          <div
            className={`w-full max-w-5xl rounded-2xl border shadow-2xl ${modalTheme.modal}`}
          >
            <div
              className={`px-5 sm:px-6 py-4 border-b flex items-center justify-between ${modalTheme.header}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center border ${
                    isDark
                      ? "bg-blue-500/10 text-blue-300 border-blue-500/20"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}
                >
                  <FontAwesomeIcon icon={faFileInvoiceDollar} />
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className={`text-lg font-bold ${modalTheme.title}`}>
                      {invoice.invoiceNumber || "Untitled Invoice"}
                    </h2>
                    <StatusBadge status={status} isDark={isDark} />
                  </div>
                  <p className={`text-sm mt-1 ${modalTheme.bodyText}`}>
                    Shipment:{" "}
                    {invoice.shipmentId ||
                      connectedShipment?.shipmentId ||
                      connectedShipment?.id ||
                      "—"}
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

            <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <section className="grid grid-cols-2 lg:flex lg:flex-wrap gap-2">
                <StatusButton
                  onClick={onEdit}
                  icon={faPenToSquare}
                  loadingLabel="Loading..."
                  successLabel="Saved"
                  errorLabel="Error"
                  label="Edit"
                  variant="blue"
                  isDark={isDark}
                  className="w-full lg:w-auto px-3 sm:px-4 py-2 text-sm"
                />

                {status === "DRAFT" && (
                  <StatusButton
                    onClick={onIssue}
                    icon={faPaperPlane}
                    loadingLabel="Loading..."
                    successLabel="Saved"
                    errorLabel="Error"
                    label="Issue Invoice"
                    variant="amber"
                    isDark={isDark}
                    className="w-full lg:w-auto px-3 sm:px-4 py-2 text-sm"
                  />
                )}

                {status === "ISSUED" && (
                  <StatusButton
                    onClick={onMarkPaid}
                    icon={faCircleCheck}
                    loadingLabel="Loading..."
                    successLabel="Saved"
                    errorLabel="Error"
                    label="Mark as Paid"
                    variant="emerald"
                    isDark={isDark}
                    className="w-full lg:w-auto px-3 sm:px-4 py-2 text-sm"
                  />
                )}

                {status !== "CANCELLED" && status !== "PAID" && (
                  <StatusButton
                    onClick={onCancel}
                    icon={faBan}
                    loadingLabel="Loading..."
                    successLabel="Saved"
                    errorLabel="Error"
                    label="Cancel Invoice"
                    variant="red"
                    isDark={isDark}
                    className="w-full lg:w-auto px-3 sm:px-4 py-2 text-sm"
                  />
                )}

                <StatusButton
                  onClick={() =>
                    window.open(
                      invoiceUrl(
                        invoice.id ||
                          invoice.invoiceNumber ||
                          invoice.invoiceId,
                      ),
                      "_blank",
                    )
                  }
                  icon={faPrint}
                  label="Print Invoice"
                  variant="blue"
                  isDark={isDark}
                  className="w-full lg:w-auto px-3 sm:px-4 py-2 text-sm"
                />
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div
                  className={`rounded-xl border p-4 ${modalTheme.panelSurface}`}
                >
                  <h3 className={`font-bold mb-4 ${modalTheme.title}`}>
                    Invoice Info
                  </h3>
                  <div className="space-y-4">
                    <InfoBlock
                      label="Invoice Number"
                      value={invoice.invoiceNumber}
                      isDark={isDark}
                    />
                    <InfoBlock
                      label="Invoice Date"
                      value={invoice.invoiceDate}
                      isDark={isDark}
                    />
                    <InfoBlock
                      label="Due Date"
                      value={invoice.dueDate}
                      isDark={isDark}
                    />
                    <InfoBlock
                      label="Amount"
                      value={formatAmount(invoice.amount)}
                      isDark={isDark}
                    />
                    <InfoBlock
                      label="Notes"
                      value={invoice.notes}
                      isDark={isDark}
                    />
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-4 ${modalTheme.panelSurface}`}
                >
                  <h3 className={`font-bold mb-4 ${modalTheme.title}`}>
                    Shipment Reference
                  </h3>
                  <div className="space-y-4">
                    <InfoBlock
                      label="Shipment ID"
                      value={invoice.shipmentId || connectedShipment?.id}
                      isDark={isDark}
                    />
                    <InfoBlock
                      label="Tracking Number"
                      value={
                        invoice.shipmentId || connectedShipment?.shipmentId
                      }
                      isDark={isDark}
                    />
                    <InfoBlock
                      label="Route"
                      value={
                        invoice.routeLabel ||
                        `${connectedShipment?.origin || "Unknown"} → ${connectedShipment?.destination || "Unknown"}`
                      }
                      isDark={isDark}
                    />
                    {/* <InfoBlock
                      label="Shipment Status"
                      value={
                        invoice.shipmentStatus || connectedShipment?.status
                      }
                      isDark={isDark}
                    /> */}
                    <InfoBlock
                      label="Trip ID"
                      value={
                        invoice.truckTripId || connectedShipment?.currentTripId
                      }
                      isDark={isDark}
                    />
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-4 ${modalTheme.panelSurface}`}
                >
                  <h3 className={`font-bold mb-4 ${modalTheme.title}`}>
                    Billing Info
                  </h3>
                  <div className="space-y-4">
                    <InfoBlock
                      label="Billing Name"
                      value={invoice.billingName}
                      isDark={isDark}
                    />
                    <InfoBlock
                      label="Billing Address"
                      value={invoice.billingAddress}
                      isDark={isDark}
                    />
                    <InfoBlock
                      label="Sender"
                      value={
                        invoice.senderName || connectedShipment?.sender?.name
                      }
                      isDark={isDark}
                    />
                    <InfoBlock
                      label="Recipient"
                      value={
                        invoice.recipientName ||
                        connectedShipment?.recipient?.name
                      }
                      isDark={isDark}
                    />
                  </div>
                </div>
              </section>

              <section
                className={`rounded-xl border p-4 ${modalTheme.panelSurface}`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <FontAwesomeIcon
                    icon={faBoxOpen}
                    className={modalTheme.accentText}
                  />
                  <h3 className={`font-bold ${modalTheme.title}`}>
                    Package Summary
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
                  <div>
                    <p
                      className={`text-[11px] uppercase tracking-widest font-bold ${modalTheme.label}`}
                    >
                      Total Packages
                    </p>
                    <p className={`text-lg font-bold mt-1 ${modalTheme.title}`}>
                      {invoice.totalPackages || packages.length || 0}
                    </p>
                  </div>

                  <div>
                    <p
                      className={`text-[11px] uppercase tracking-widest font-bold ${modalTheme.label}`}
                    >
                      Total Items
                    </p>
                    <p className={`text-lg font-bold mt-1 ${modalTheme.title}`}>
                      {invoice.totalItems ||
                        connectedShipment?.totals?.totalItems ||
                        0}
                    </p>
                  </div>

                  <div>
                    <p
                      className={`text-[11px] uppercase tracking-widest font-bold ${modalTheme.label}`}
                    >
                      Origin
                    </p>
                    <p className={`text-sm mt-1 ${modalTheme.title}`}>
                      {connectedShipment?.origin || "—"}
                    </p>
                  </div>

                  <div>
                    <p
                      className={`text-[11px] uppercase tracking-widest font-bold ${modalTheme.label}`}
                    >
                      Destination
                    </p>
                    <p className={`text-sm mt-1 ${modalTheme.title}`}>
                      {connectedShipment?.destination || "—"}
                    </p>
                  </div>
                </div>

                {packages.length > 0 ? (
                  <div className="space-y-3">
                    {packages.map((pkg, index) => (
                      <div
                        key={pkg.packageId || `${pkg.description}-${index}`}
                        className={`rounded-lg border p-3 ${modalTheme.statsCard}`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <InfoBlock
                            label="Package Tracking"
                            value={pkg.packageId}
                            isDark={isDark}
                          />
                          <InfoBlock
                            label="Description"
                            value={pkg.description}
                            isDark={isDark}
                          />
                          <InfoBlock
                            label="Packaging"
                            value={pkg.packagingType}
                            isDark={isDark}
                          />
                          <InfoBlock
                            label="Quantity"
                            value={pkg.quantity}
                            isDark={isDark}
                          />
                          {/* <InfoBlock
                            label="Status"
                            value={pkg.status}
                            isDark={isDark}
                          /> */}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-sm italic ${modalTheme.bodyText}`}>
                    No package details available.
                  </p>
                )}
              </section>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={`rounded-xl border p-4 ${modalTheme.panelSurface}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <FontAwesomeIcon
                      icon={faUser}
                      className={modalTheme.accentText}
                    />
                    <h3 className={`font-bold ${modalTheme.title}`}>Sender</h3>
                  </div>

                  <div className="space-y-3">
                    <InfoBlock
                      label="Name"
                      value={connectedShipment?.sender?.name}
                      isDark={isDark}
                    />
                    <div className="flex items-start gap-2">
                      <FontAwesomeIcon
                        icon={faPhone}
                        className={`mt-0.5 ${modalTheme.label}`}
                      />
                      <p className={`text-sm ${modalTheme.title}`}>
                        {connectedShipment?.sender?.phone || "—"}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <FontAwesomeIcon
                        icon={faLocationDot}
                        className={`mt-0.5 ${modalTheme.label}`}
                      />
                      <p className={`text-sm ${modalTheme.title}`}>
                        {connectedShipment?.sender?.formattedAddress || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-xl border p-4 ${modalTheme.panelSurface}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <FontAwesomeIcon
                      icon={faTruckFast}
                      className={modalTheme.accentText}
                    />
                    <h3 className={`font-bold ${modalTheme.title}`}>
                      Recipient
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <InfoBlock
                      label="Name"
                      value={connectedShipment?.recipient?.name}
                      isDark={isDark}
                    />
                    <div className="flex items-start gap-2">
                      <FontAwesomeIcon
                        icon={faPhone}
                        className={`mt-0.5 ${modalTheme.label}`}
                      />
                      <p className={`text-sm ${modalTheme.title}`}>
                        {connectedShipment?.recipient?.phone || "—"}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <FontAwesomeIcon
                        icon={faLocationDot}
                        className={`mt-0.5 ${modalTheme.label}`}
                      />
                      <p className={`text-sm ${modalTheme.title}`}>
                        {connectedShipment?.recipient?.formattedAddress || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div
              className={`px-5 sm:px-6 py-4 border-t flex justify-end ${modalTheme.divider}`}
            >
              <button
                type="button"
                onClick={onClose}
                className={actionTheme.secondary}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
