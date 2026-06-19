"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPrint, faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";
import { fetchPrintApi } from "@/lib/printFetch";
import { onAuthStateChanged } from "firebase/auth";
import QRCode from "react-qr-code";
import Image from "next/image";

const PrintSheet = ({ children }) => (
  <div
    className="
    bg-white text-slate-900
    w-[215.9mm] min-h-[279.4mm]
    mx-auto my-8
    p-[12mm]
    shadow-2xl border border-gray-300
    print:shadow-none print:w-full print:h-full print:m-0 print:p-0 print:border-none print:rounded-none
    overflow-hidden relative
  "
  >
    {children}
  </div>
);

const MetaItem = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
      {label}
    </span>
    <span className="text-sm font-bold text-slate-900">{value || "—"}</span>
  </div>
);

const TotalItem = ({ label, value }) => (
  <div className="p-4 border-r border-slate-900/10 last:border-r-0 text-center bg-slate-50">
    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">
      {label}
    </div>
    <div className="text-xl font-black text-slate-900">{value ?? "—"}</div>
  </div>
);

function DeliveryDestinationCard({ group }) {
  const items = group.items || [];

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden break-inside-avoid">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex justify-between items-center">
        <div>
          <div className="font-bold text-sm text-slate-900">
            DESTINATION: {group.destination}
          </div>
          <div className="text-[10px] text-slate-500 font-bold">
            Route: {group.routeCode || "—"}
          </div>
        </div>
        <div className="text-[10px] font-bold bg-white border border-slate-200 px-2 py-1 rounded">
          {items.length} Tracking #
        </div>
      </div>
      <table className="w-full text-xs text-left">
        <thead className="text-[10px] text-slate-400 uppercase bg-white border-b border-slate-100">
          <tr>
            <th className="px-4 py-2 font-semibold">Tracking Number</th>
            <th className="px-4 py-2 font-semibold text-right">Packages</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item, index) => (
            <tr key={`${item.shipmentId}-${index}`}>
              <td className="px-4 py-2 font-mono text-slate-700 font-medium">
                {item.shipmentId}
                {item.receiverName ? (
                  <span className="block text-[9px] text-slate-400 font-sans mt-0.5">
                    Receiver: {item.receiverName}
                  </span>
                ) : null}
                {(item.failedCount > 0 || item.returnedCount > 0) && (
                  <span className="block text-[9px] text-slate-400 font-sans mt-0.5">
                    {item.deliveredCount > 0 ? `${item.deliveredCount} delivered` : ""}
                    {item.failedCount > 0 ? ` · ${item.failedCount} failed` : ""}
                    {item.returnedCount > 0 ? ` · ${item.returnedCount} returned` : ""}
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-right font-bold text-slate-900">
                {item.descriptionBreakdown?.length > 0 ? (
                  <div className="flex flex-col items-end gap-0.5">
                    {item.descriptionBreakdown.map((line, idx) => (
                      <div key={idx} className="text-[10px] whitespace-nowrap">
                        <span className="text-slate-500 font-medium">{line.desc}: </span>
                        <span className="text-slate-900">{line.count}</span>
                      </div>
                    ))}
                    {item.pieces?.length > 1 && (
                      <div className="border-t border-slate-200 mt-1 pt-1 text-[10px]">
                        Total: {item.packageCount}
                      </div>
                    )}
                  </div>
                ) : (
                  item.packageCount || 0
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeliveryManifestContent() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId");
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState("");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => setAuthReady(true));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !tripId) return;

    fetchPrintApi(`/api/trips/${tripId}/print-delivery-manifest`)
      .then(setManifest)
      .catch((err) => setError(err.message));
  }, [authReady, tripId]);

  if (!tripId) return <p className="p-8 text-center">Missing tripId</p>;
  if (error) return <p className="p-8 text-center text-red-600">{error}</p>;
  if (!manifest) return <p className="p-8 text-center animate-pulse">Loading...</p>;

  const totals = manifest.totals || {};
  const destinations = manifest.destinations || [];

  return (
    <PrintSheet>
      <div className="grid grid-cols-[1.4fr_0.6fr] gap-8 mb-6">
        <div className="flex gap-4">
          <div className="w-16 h-16 flex items-center justify-center bg-white rounded-xl overflow-hidden relative">
            <Image
              src="/atlas-logo.png"
              alt="Atlas Logistics"
              width={64}
              height={64}
              className="object-contain"
            />
          </div>
          <div>
            <h1 className="text-lg font-black leading-tight uppercase">
              Atlas Official Delivery Manifest
              <br />& Completion Record
            </h1>
            <p className="text-[10px] text-slate-500 mt-1 leading-snug max-w-sm">
              Atlas Logistics Platform — digitally sealed delivery completion
              ledger for Odiongan hub accountability and audit.
            </p>
            <div className="flex gap-2 mt-2">
              {(manifest.stamps || []).map((stamp) => (
                <span
                  key={stamp}
                  className="px-2 py-0.5 rounded-full border border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wide"
                >
                  {stamp.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="border border-dashed border-slate-300 rounded-xl p-3 flex gap-3 items-center bg-slate-50/50">
          <div className="w-20 h-20 bg-white border border-slate-200 rounded-lg p-1 flex items-center justify-center">
            <QRCode
              value={manifest.verifyUrl}
              size={80}
              level="M"
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-slate-500 leading-tight mb-2">
              Scan to verify authenticity.
              <br />
              <span className="font-mono text-slate-900">{manifest.verifyUrl}</span>
            </p>
            <div className="bg-slate-100 border border-slate-200 rounded px-2 py-1 text-[9px] font-mono text-slate-900 break-all leading-tight">
              Hash: {manifest.manifestHash || "—"}
            </div>
          </div>
        </div>
      </div>

      <hr className="border-t-2 border-slate-900/10 mb-6" />

      <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-xl p-4 bg-white mb-6">
        <MetaItem label="Trip ID" value={manifest.tripNumber} />
        <MetaItem label="Completed By" value={manifest.completedByName} />
        <MetaItem label="Origin" value={manifest.origin} />
        <MetaItem label="Destination" value={manifest.destination} />
        <MetaItem label="Route" value={manifest.route} />
        <MetaItem label="Completed At" value={manifest.sealedAt} />
        <MetaItem label="Version" value={manifest.version} />
        <MetaItem
          label="Shipping Manifest Ref"
          value={manifest.shippingManifestReference}
        />
      </div>

      <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
        Delivery Totals
      </h4>
      <div className="grid grid-cols-3 gap-0 border-2 border-slate-900/10 rounded-xl overflow-hidden mb-6">
        <TotalItem label="Packages Received" value={totals.totalPackagesReceived} />
        <TotalItem label="Delivered" value={totals.totalDelivered} />
        <TotalItem label="Failed" value={totals.totalFailedDelivery} />
        <TotalItem label="Returned" value={totals.totalReturnedToWarehouse} />
        <TotalItem label="POD Captured" value={totals.podCaptured} />
        <TotalItem label="POD Rate" value={totals.podPercent} />
      </div>

      <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
        Packages by Destination
      </h4>
      <div className="space-y-4 mb-6">
        {destinations.length > 0 ? (
          destinations.map((group, index) => (
            <DeliveryDestinationCard key={`${group.destination}-${index}`} group={group} />
          ))
        ) : (
          <p className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg p-4 text-center">
            No delivered package details recorded for this trip.
          </p>
        )}
      </div>

      <p className="text-[9px] text-slate-500 text-center">
        Official delivery completion record. Generated by Atlas Logistics Platform.
      </p>
    </PrintSheet>
  );
}

export default function DeliveryManifestPrintPage() {
  return (
    <div className="min-h-screen bg-slate-100 pb-10 print:bg-white print:pb-0 flex flex-col items-center">
      <style jsx global>{`
        @media print {
          @page {
            size: Letter;
            margin: 12mm;
          }
          body {
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 p-4 print:hidden shadow-lg mb-8 w-full">
        <div className="max-w-5xl mx-auto flex items-center justify-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
          >
            <FontAwesomeIcon icon={faPrint} />
            Print Manifest
          </button>
        </div>
      </div>

      <Suspense fallback={<p className="p-8 text-center">Loading...</p>}>
        <DeliveryManifestContent />
      </Suspense>
    </div>
  );
}
