"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faFileInvoiceDollar,
  faFloppyDisk,
  faCircleNotch,
} from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";
import {
  buildInitialForm,
  buildInvoiceRouteLabel,
  formatInvoiceContactAddress,
} from "./invoiceHelpers";
import {
  getShipmentTripIds,
  getShipmentTripIdsLabel,
} from "../shipments/shipmentHelpers";

function clearSelectedShipment(form, truckTripId = "") {
  return {
    ...form,
    shipmentId: "",
    shipmentTrackingNumber: "",
    shipmentStatus: "",
    truckTripId,
    senderName: "",
    senderPhone: "",
    recipientName: "",
    recipientPhone: "",
    origin: "",
    destination: "",
    routeLabel: "",
    billingName: "",
    billingAddress: "",
    totalPackages: 0,
    totalItems: 0,
    shipmentSnapshot: null,
  };
}

function getShipmentPackageTotals(shipment = {}) {
  const totalPackages = Array.isArray(shipment.packages)
    ? shipment.packages.length
    : Number(
        shipment.totals?.totalPackages ??
          shipment.metrics?.totalPackages ??
          0,
      );

  const totalItems = Number(
    shipment.totals?.totalContentQty ??
      shipment.totals?.totalItems ??
      shipment.items?.reduce?.(
        (total, item) => total + Number(item.quantity || 1),
        0,
      ) ??
      0,
  );

  return { totalPackages, totalItems };
}

function shipmentCanBeInvoiced(shipment = {}, invoicedShipmentIds = new Set()) {
  if (shipment.archived) return false;
  if (String(shipment.status || "").toUpperCase() === "CANCELLED") {
    return false;
  }
  if (invoicedShipmentIds.has(shipment.id)) return false;

  const invoiceStatus = String(shipment.invoiceStatus || "").toUpperCase();
  if (shipment.hasInvoice === true && invoiceStatus !== "CANCELLED") {
    return false;
  }
  if (shipment.invoiceId && invoiceStatus !== "CANCELLED") return false;

  return true;
}

export default function InvoiceFormModal({
  isOpen = false,
  loading = false,
  mode = "create",
  shipment = null,
  invoice = null,
  trips = [],
  eligibleShipments = [],
  invoicedShipmentIds = [],
  user = null,
  onClose,
  onSubmit,
  isDark = false,
}) {
  const [form, setForm] = useState(buildInitialForm(shipment, invoice, mode));
  const [tripQuery, setTripQuery] = useState("");
  const [shipmentQuery, setShipmentQuery] = useState("");
  const [showTripDropdown, setShowTripDropdown] = useState(false);
  const [showShipmentDropdown, setShowShipmentDropdown] = useState(false);
  const [formError, setFormError] = useState("");
  const [tripShipments, setTripShipments] = useState(
    shipment ? [shipment] : [],
  );
  const [loadingTripShipments, setLoadingTripShipments] = useState(false);
  const [tripShipmentsError, setTripShipmentsError] = useState("");
  const tripRequestId = useRef(0);

  const modalTheme = getModalThemeClasses(isDark);
  const actionTheme = getModalActionClasses();

  useEffect(() => {
    if (isOpen) {
      const initialForm = buildInitialForm(shipment, invoice, mode);
      setForm(initialForm);
      setTripQuery(initialForm.truckTripId || "");
      setShipmentQuery(initialForm.shipmentId || "");
      setShowTripDropdown(false);
      setShowShipmentDropdown(false);
      setFormError("");
      setTripShipments(shipment ? [shipment] : []);
      setLoadingTripShipments(false);
      setTripShipmentsError("");
      tripRequestId.current += 1;
    }
  }, [isOpen, shipment, invoice, mode]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const tripOptions = useMemo(() => {
    const tripsById = new Map();

    if (trips.length > 0) {
      trips.forEach((trip) => {
        const displayId = trip.tripId || trip.id;
        const docId = trip.id || trip.tripId;
        const status = String(trip.status || "").toUpperCase();
        if (!displayId || !docId || trip.archived || status === "CANCELLED") {
          return;
        }

        tripsById.set(docId, {
          id: displayId,
          docId,
          routeLabel:
            trip.route || buildInvoiceRouteLabel(trip, "Unknown"),
          status,
          driverName: trip.driverName || "",
          truckPlateNumber: trip.truckPlateNumber || "",
        });
      });
    } else {
      eligibleShipments.forEach((item) => {
        getShipmentTripIds(item).forEach((tripId) => {
          if (tripsById.has(tripId)) return;

          tripsById.set(tripId, {
            id: tripId,
            docId: tripId,
            routeLabel: buildInvoiceRouteLabel(item, "Unknown"),
            status: item.truckDetails?.status || "",
            driverName: item.truckDetails?.driverName || "",
            truckPlateNumber: item.truckDetails?.truckPlate || "",
          });
        });
      });
    }

    return Array.from(tripsById.values());
  }, [eligibleShipments, trips]);

  const filteredTrips = useMemo(() => {
    const keyword = tripQuery.trim().toLowerCase();
    if (!keyword || form.truckTripId) return tripOptions;

    return tripOptions.filter((trip) =>
      `${trip.id} ${trip.routeLabel} ${trip.status} ${trip.driverName} ${trip.truckPlateNumber}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [form.truckTripId, tripOptions, tripQuery]);

  const invoicedShipmentIdSet = useMemo(
    () => new Set(invoicedShipmentIds.filter(Boolean)),
    [invoicedShipmentIds],
  );

  const filteredShipments = tripShipments.filter((item) => {
    const keyword = shipmentQuery.trim().toLowerCase();

    return `
    ${item.id || ""}
    ${item.sender?.name || ""}
    ${item.recipient?.name || ""}
    ${item.origin || ""}
    ${item.destination || ""}
    ${getShipmentTripIdsLabel(item) || item.currentTripId || ""}
    ${(item.currentTripIds || []).join(" ")}
  `
      .toLowerCase()
      .includes(keyword);
  });

  const handleSelectTrip = async (trip) => {
    const requestId = tripRequestId.current + 1;
    tripRequestId.current = requestId;

    setTripQuery(trip.id);
    setShipmentQuery("");
    setForm((prev) => clearSelectedShipment(prev, trip.id));
    setTripShipments([]);
    setShowTripDropdown(false);
    setShowShipmentDropdown(true);
    setFormError("");
    setTripShipmentsError("");
    setLoadingTripShipments(true);

    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("You must be signed in to load shipments.");

      const response = await fetch(
        `/api/trips/${encodeURIComponent(trip.docId)}/shipments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.details || payload.error || "Failed to load trip shipments.",
        );
      }

      if (tripRequestId.current !== requestId) return;

      setTripShipments(
        (payload.shipments || []).filter((item) =>
          shipmentCanBeInvoiced(item, invoicedShipmentIdSet),
        ),
      );
    } catch (error) {
      if (tripRequestId.current !== requestId) return;
      setTripShipments([]);
      setTripShipmentsError(error.message || "Failed to load trip shipments.");
    } finally {
      if (tripRequestId.current === requestId) {
        setLoadingTripShipments(false);
      }
    }
  };

  const handleSelectShipment = (item) => {
    const { totalPackages, totalItems } = getShipmentPackageTotals(item);

    setShipmentQuery(item.id || item.trackingNumber || "");
    setForm((prev) => ({
      ...prev,
      shipmentId: item.id || "",
      shipmentTrackingNumber: item.trackingNumber || item.id || "",
      shipmentStatus: item.status || "",
      senderName: item.sender?.name || "",
      senderPhone: item.sender?.phone || "",
      recipientName: item.recipient?.name || "",
      recipientPhone: item.recipient?.phone || "",
      origin: item.origin || "",
      destination: item.destination || "",
      routeLabel: buildInvoiceRouteLabel(item, "Unknown"),
      billingName: item.sender?.name || "",
      billingAddress: formatInvoiceContactAddress(item.sender),
      totalPackages,
      totalItems,
      shipmentSnapshot: item,
    }));
    setShowShipmentDropdown(false);
    setFormError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (mode !== "edit" && !form.truckTripId) {
      setFormError("Please select a trip from the dropdown first.");
      return;
    }

    if (mode !== "edit" && !form.shipmentId) {
      setFormError("Please select a shipment from the selected trip.");
      return;
    }

    setFormError("");
    onSubmit?.({
      ...form,
      amount: Number(form.amount || 0),
      totalPackages: Number(form.totalPackages || 0),
      totalItems: Number(form.totalItems || 0),
    });
  };

  if (!isOpen) return null;

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
                      Select a trip first, then choose one of its shipments.
                    </p>
                    {formError && (
                      <p className="text-xs mt-2 font-semibold text-red-500">
                        {formError}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    <div className="relative">
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Trip
                      </label>
                      <input
                        type="text"
                        value={tripQuery}
                        placeholder="Search trip ID, route, status..."
                        disabled={mode === "edit"}
                        onChange={(e) => {
                          tripRequestId.current += 1;
                          setTripQuery(e.target.value);
                          setShipmentQuery("");
                          setForm((prev) => clearSelectedShipment(prev));
                          setTripShipments([]);
                          setLoadingTripShipments(false);
                          setTripShipmentsError("");
                          setShowTripDropdown(true);
                          setShowShipmentDropdown(false);
                          setFormError("");
                        }}
                        onFocus={() => {
                          if (mode !== "edit") setShowTripDropdown(true);
                        }}
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />

                      {mode !== "edit" &&
                        showTripDropdown && (
                          <div
                            className={`absolute z-50 w-full mt-1 rounded-lg border shadow-xl overflow-hidden max-h-64 overflow-y-auto ${
                              isDark
                                ? "bg-slate-900 border-slate-700"
                                : "bg-white border-slate-200"
                            }`}
                          >
                            {filteredTrips.length === 0 ? (
                              <div
                                className={`px-3 py-3 text-xs ${modalTheme.helperText}`}
                              >
                                No matching trips found.
                              </div>
                            ) : (
                              filteredTrips.slice(0, 20).map((trip) => (
                                <button
                                  key={trip.docId}
                                  type="button"
                                  onClick={() => handleSelectTrip(trip)}
                                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                                    isDark
                                      ? "hover:bg-slate-800 text-slate-300"
                                      : "hover:bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  <div className="font-bold">{trip.id}</div>
                                  <div className="opacity-70">
                                    {trip.routeLabel}
                                  </div>
                                  {trip.status && (
                                    <div className="opacity-50 text-[10px]">
                                      {trip.status.replaceAll("_", " ")}
                                    </div>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                    </div>

                    <div className="relative">
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Shipment
                      </label>
                      <input
                        type="text"
                        value={shipmentQuery}
                        placeholder={
                          loadingTripShipments
                            ? "Loading shipments..."
                            : form.truckTripId
                            ? "Search shipment ID, sender, recipient..."
                            : "Select a trip first"
                        }
                        disabled={
                          mode === "edit" ||
                          !form.truckTripId ||
                          loadingTripShipments
                        }
                        onChange={(e) => {
                          setShipmentQuery(e.target.value);
                          setForm((prev) =>
                            clearSelectedShipment(prev, prev.truckTripId),
                          );
                          setShowShipmentDropdown(true);
                          setFormError("");
                        }}
                        onFocus={() => {
                          if (mode !== "edit" && form.truckTripId) {
                            setShowShipmentDropdown(true);
                          }
                        }}
                        className={`w-full rounded-lg border px-3 py-2 text-sm mt-1 ${modalTheme.input}`}
                      />

                      {mode !== "edit" &&
                        form.truckTripId &&
                        showShipmentDropdown && (
                          <div
                            className={`absolute z-50 w-full mt-1 rounded-lg border shadow-xl overflow-hidden max-h-64 overflow-y-auto ${
                              isDark
                                ? "bg-slate-900 border-slate-700"
                                : "bg-white border-slate-200"
                            }`}
                          >
                            {loadingTripShipments ? (
                              <div
                                className={`px-3 py-3 text-xs ${modalTheme.helperText}`}
                              >
                                Loading shipments from this trip...
                              </div>
                            ) : tripShipmentsError ? (
                              <div className="px-3 py-3 text-xs text-red-500">
                                {tripShipmentsError}
                              </div>
                            ) : filteredShipments.length === 0 ? (
                              <div
                                className={`px-3 py-3 text-xs ${modalTheme.helperText}`}
                              >
                                No eligible shipments found in this trip.
                              </div>
                            ) : (
                              filteredShipments.slice(0, 20).map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleSelectShipment(item)}
                                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                                    isDark
                                      ? "hover:bg-slate-800 text-slate-300"
                                      : "hover:bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  <div className="font-bold">{item.id}</div>
                                  <div className="opacity-70">
                                    {item.sender?.name || "Unknown Sender"} -{" "}
                                    {item.recipient?.name ||
                                      "Unknown Recipient"}
                                  </div>
                                  <div className="opacity-50 text-[10px]">
                                    {buildInvoiceRouteLabel(item, "Unknown")}
                                  </div>
                                </button>
                              ))
                            )}
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
