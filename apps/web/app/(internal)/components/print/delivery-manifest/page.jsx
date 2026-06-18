"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPrint,
  faCheckCircle,
  faQrcode,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";
import { fetchPrintApi } from "@/lib/printFetch";
import { onAuthStateChanged } from "firebase/auth";
import QRCode from "react-qr-code";
import Image from "next/image";

const PrintSheet = ({ children }) => (
  <div className="bg-white text-slate-900 w-[215.9mm] min-h-[279.4mm] mx-auto my-8 p-[12mm] shadow-2xl border border-gray-300 print:shadow-none print:w-full print:h-full print:m-0 print:p-0 print:border-none">
    {children}
  </div>
);

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

  return (
    <PrintSheet>
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
        <div>
          <Image src="/logo.png" alt="Atlas" width={120} height={40} className="mb-2" />
          <h1 className="text-2xl font-black uppercase tracking-tight">
            Delivery Manifest
          </h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Completion Manifest · {manifest.version}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-slate-400 font-bold">Trip ID</p>
          <p className="font-mono font-bold text-lg">{manifest.tripNumber}</p>
          <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase">
            <FontAwesomeIcon icon={faCheckCircle} />
            {manifest.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p className="text-[10px] uppercase text-slate-400 font-bold">Route</p>
          <p className="font-bold">{manifest.route}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400 font-bold">Completed</p>
          <p className="font-bold">{manifest.sealedAt || "—"}</p>
          <p className="text-xs text-slate-500">{manifest.completedByName}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400 font-bold">Origin</p>
          <p>{manifest.origin}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400 font-bold">Destination</p>
          <p>{manifest.destination}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          ["Packages Received", totals.totalPackagesReceived],
          ["Delivered", totals.totalDelivered],
          ["Failed Delivery", totals.totalFailedDelivery],
          ["Returned to Warehouse", totals.totalReturnedToWarehouse],
          ["POD Captured", totals.podCaptured],
          ["POD Rate", totals.podPercent],
        ].map(([label, value]) => (
          <div
            key={label}
            className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-center"
          >
            <p className="text-[10px] uppercase text-slate-400 font-bold">{label}</p>
            <p className="text-xl font-black">{value ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="border border-slate-200 rounded-xl p-4 flex justify-between items-center mb-6">
        <div>
          <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">
            Shipping Manifest Reference
          </p>
          <p className="font-mono text-xs">{manifest.shippingManifestReference || "—"}</p>
          <p className="text-[10px] uppercase text-slate-400 font-bold mt-3 mb-1">
            Digital Hash
          </p>
          <p className="font-mono text-[9px] break-all text-slate-600">
            {manifest.manifestHash || "—"}
          </p>
        </div>
        {manifest.verifyUrl && (
          <div className="text-center">
            <QRCode value={manifest.verifyUrl} size={88} />
            <p className="text-[8px] mt-1 max-w-[100px] break-all text-slate-500">
              {manifest.verifyUrl}
            </p>
          </div>
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
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="fixed top-4 right-4 z-50 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold shadow-lg"
        >
          <FontAwesomeIcon icon={faPrint} />
          Print / Save PDF
        </button>
      </div>
      <Suspense fallback={<p className="p-8 text-center">Loading...</p>}>
        <DeliveryManifestContent />
      </Suspense>
    </div>
  );
}
