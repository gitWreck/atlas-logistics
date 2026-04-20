"use client";

export const dynamic = "force-dynamic"; // Keep this for safety

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPrint,
  faPhone,
  faLocationDot,
  faUser,
  faTruckFast,
  faBoxOpen,
} from "@fortawesome/free-solid-svg-icons";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatAmount, InfoRow } from "../../../components/invoice/utils";

function InvoicePrintView() {
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("id");

  const [invoice, setInvoice] = useState(null);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);

  console.log("InvoicePrintView rendered with invoiceId:", invoiceId);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setLoading(true);

        if (!invoiceId) return;

        const invoiceSnap = await getDoc(doc(db, "invoices", invoiceId));

        if (!invoiceSnap.exists()) {
          setInvoice(null);
          setShipment(null);
          return;
        }

        const invoiceData = { id: invoiceSnap.id, ...invoiceSnap.data() };
        setInvoice(invoiceData);

        const shipmentId = invoiceData.shipmentId;

        if (shipmentId) {
          const shipmentSnap = await getDoc(doc(db, "shipments", shipmentId));
          if (shipmentSnap.exists()) {
            setShipment({ id: shipmentSnap.id, ...shipmentSnap.data() });
          } else {
            setShipment(invoiceData.shipmentSnapshot || null);
          }
        } else {
          setShipment(invoiceData.shipmentSnapshot || null);
        }
      } catch (err) {
        console.error("Error fetching invoice print data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center print:bg-white">
        <div className="text-center animate-pulse text-slate-600">
          Generating invoice...
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center print:bg-white">
        <div className="text-center text-red-500 font-medium">
          Invoice not found.
        </div>
      </div>
    );
  }

  const connectedShipment =
    shipment || invoice.shipment || invoice.shipmentSnapshot || null;

  const packages = connectedShipment?.packages || [];
  const senderName = invoice.senderName || connectedShipment?.sender?.name;
  const recipientName =
    invoice.recipientName || connectedShipment?.recipient?.name;

  const senderPhone = invoice.senderPhone || connectedShipment?.sender?.phone;
  const recipientPhone =
    invoice.recipientPhone || connectedShipment?.recipient?.phone;

  const senderAddress = connectedShipment?.sender?.formattedAddress;
  const recipientAddress = connectedShipment?.recipient?.formattedAddress;

  const routeLabel =
    invoice.routeLabel ||
    `${connectedShipment?.origin || "Unknown"} → ${connectedShipment?.destination || "Unknown"}`;

  return (
    <div className="bg-slate-100 min-h-screen p-6 print:p-0 print:bg-white text-black font-sans">
      {/* TOP ACTIONS */}
      <div className="max-w-4xl mx-auto mb-6 print:hidden text-center space-y-4">
        {/* <h1 className="text-2xl font-bold text-slate-800">Printable Invoice</h1> */}

        {/* <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            <div>
              <div className="text-xs text-slate-500 uppercase font-bold">
                Invoice No.
              </div>
              <div className="text-sm font-bold break-words">
                {invoice.invoiceNumber || invoice.id}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 uppercase font-bold">
                Shipment
              </div>
              <div className="text-sm font-bold">
                {invoice.shipmentId || "—"}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 uppercase font-bold">
                Status
              </div>
              <div className="text-sm font-bold text-blue-600">
                {invoice.status || "DRAFT"}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 uppercase font-bold">
                Total
              </div>
              <div className="text-sm font-bold">
                {formatAmount(invoice.amount)}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-400 border-t pt-2">
            Format: A4 Portrait
          </p>
        </div> */}

        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-xl hover:bg-blue-500 hover:scale-105 transition-all inline-flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faPrint} />
          <span>Print Invoice</span>
        </button>
      </div>

      {/* PRINT SHEET */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border border-slate-200 shadow-2xl print:shadow-none print:border-0">
          <div className="p-8">
            {/* HEADER */}
            <div className="border-b-4 border-slate-900 pb-5 mb-6">
              <div className="flex justify-between items-start gap-6">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <img
                        src="/atlas-logo.png"
                        alt="Atlas"
                        className="h-12 w-auto object-contain"
                      />
                    </div>
                    <div>
                      <div className="text-3xl font-bold uppercase tracking-tight">
                        Invoice
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        Fast & Easy Shipping
                      </div>
                    </div>
                  </div>
                </div>

                {/* <div className="text-right">
                  <div className="text-xl font-bold uppercase">ATLAS</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Unit 615, 619 Asuncion St, San Nicolas, Manila, 1000
                  </div>
                  <div className="text-sm text-slate-600">09757427941</div>
                </div> */}
              </div>
            </div>

            {/* TOP INFO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                  Invoice Details
                </div>
                <InfoRow
                  label="Invoice No."
                  value={invoice.invoiceNumber || invoice.id}
                />
                <InfoRow label="Invoice Date" value={invoice.invoiceDate} />
                <InfoRow label="Due Date" value={invoice.dueDate} />
                <InfoRow label="Status" value={invoice.status || "DRAFT"} />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                  Shipment Reference
                </div>
                <InfoRow label="Shipment ID" value={invoice.shipmentId} />
                <InfoRow label="Route" value={routeLabel} />
                {/* <InfoRow
                  label="Shipment Status"
                  value={invoice.shipmentStatus || connectedShipment?.status}
                /> */}
                <InfoRow
                  label="Trip ID"
                  value={
                    invoice.tripId ||
                    invoice.truckTripId ||
                    connectedShipment?.currentTruckTripId
                  }
                />
              </div>
            </div>

            {/* BILL TO */}
            <div className="mb-8 rounded-xl border border-slate-200 p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                Bill To
              </div>
              <div className="text-lg font-bold text-slate-900">
                {invoice.billingName || "—"}
              </div>
              <div className="text-sm text-slate-700 mt-2 whitespace-pre-line">
                {invoice.billingAddress || "—"}
              </div>
            </div>

            {/* SENDER / RECIPIENT */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FontAwesomeIcon icon={faUser} className="text-blue-600" />
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Sender
                  </div>
                </div>
                <div className="font-bold text-slate-900">
                  {senderName || "—"}
                </div>
                <div className="flex items-start gap-2 mt-2 text-sm text-slate-700">
                  <FontAwesomeIcon icon={faPhone} className="mt-0.5" />
                  <span>{senderPhone || "—"}</span>
                </div>
                <div className="flex items-start gap-2 mt-2 text-sm text-slate-700">
                  <FontAwesomeIcon icon={faLocationDot} className="mt-0.5" />
                  <span>{senderAddress || "—"}</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FontAwesomeIcon
                    icon={faTruckFast}
                    className="text-blue-600"
                  />
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Recipient
                  </div>
                </div>
                <div className="font-bold text-slate-900">
                  {recipientName || "—"}
                </div>
                <div className="flex items-start gap-2 mt-2 text-sm text-slate-700">
                  <FontAwesomeIcon icon={faPhone} className="mt-0.5" />
                  <span>{recipientPhone || "—"}</span>
                </div>
                <div className="flex items-start gap-2 mt-2 text-sm text-slate-700">
                  <FontAwesomeIcon icon={faLocationDot} className="mt-0.5" />
                  <span>{recipientAddress || "—"}</span>
                </div>
              </div>
            </div>

            {/* CHARGES TABLE */}
            <div className="mb-8">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                Charges
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-slate-600">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left font-bold text-slate-600 w-28">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right font-bold text-slate-600 w-40">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-200">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">
                          Shipment Service
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {senderName || "Sender"} →{" "}
                          {recipientName || "Recipient"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {routeLabel}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-900">
                        {invoice.totalItems ||
                          connectedShipment?.totals?.totalItems ||
                          1}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-slate-900">
                        {formatAmount(invoice.amount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* PACKAGE SUMMARY */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <FontAwesomeIcon icon={faBoxOpen} className="text-blue-600" />
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Package Summary
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase font-bold tracking-widest text-slate-500">
                    Total Packages
                  </div>
                  <div className="mt-2 text-xl font-bold text-slate-900">
                    {invoice.totalPackages || packages.length || 0}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase font-bold tracking-widest text-slate-500">
                    Total Items
                  </div>
                  <div className="mt-2 text-xl font-bold text-slate-900">
                    {invoice.totalItems ||
                      connectedShipment?.totals?.totalItems ||
                      0}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase font-bold tracking-widest text-slate-500">
                    Origin
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {connectedShipment?.origin || "—"}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase font-bold tracking-widest text-slate-500">
                    Destination
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {connectedShipment?.destination || "—"}
                  </div>
                </div>
              </div>

              {packages.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-slate-600">
                          Package
                        </th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600">
                          Description
                        </th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left font-bold text-slate-600">
                          Qty
                        </th>
                        {/* <th className="px-4 py-3 text-left font-bold text-slate-600">
                          Status
                        </th> */}
                      </tr>
                    </thead>
                    <tbody>
                      {packages.map((pkg, index) => (
                        <tr
                          key={pkg.packageId || `${pkg.description}-${index}`}
                          className="border-t border-slate-200"
                        >
                          <td className="px-4 py-3 text-slate-900">
                            {pkg.packageId || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-900">
                            {pkg.description || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-900">
                            {pkg.packagingType || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-900">
                            {pkg.quantity || 0}
                          </td>
                          {/* <td className="px-4 py-3 text-slate-900">
                            {pkg.status || "—"}
                          </td> */}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* NOTES + TOTAL */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                  Notes
                </div>
                <div className="min-h-[96px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-line">
                  {invoice.notes || "—"}
                </div>
              </div>

              <div>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <span className="text-sm font-semibold text-slate-600">
                      Subtotal
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatAmount(invoice.amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-4 py-4">
                    <span className="text-base font-bold text-slate-900">
                      Total
                    </span>
                    <span className="text-xl font-bold text-slate-900">
                      {formatAmount(invoice.amount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SIGNATURES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-16 pt-8">
              <div>
                <div className="border-t border-slate-400 pt-2 text-sm text-slate-700">
                  Prepared by
                </div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-2 text-sm text-slate-700">
                  Received by
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 16mm;
          }

          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function InvoicePrintPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-800">
          <div className="text-center p-10">Loading Invoice...</div>
        </div>
      }
    >
      <InvoicePrintView />
    </Suspense>
  );
}
