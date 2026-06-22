"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPrint,
  faSearch,
  faCheckCircle,
  faTimesCircle,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";
import { fetchPrintApi } from "@/lib/printFetch";
import { onAuthStateChanged } from "firebase/auth";
import QRCode from "react-qr-code";
import Image from "next/image";

const PrintSheet = ({ children }) => (
  <div
    className="bg-white text-slate-900 w-[215.9mm] min-h-[279.4mm] mx-auto my-8 p-[12mm] shadow-2xl border border-gray-300 print:shadow-none print:w-full print:h-full print:m-0 print:p-0 print:border-none overflow-hidden relative"
  >
    {children}
  </div>
);

const MetaItem = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
      {label}
    </span>
    <span className="text-sm font-bold text-slate-900 break-all">{value || "—"}</span>
  </div>
);

function formatTimestamp(value) {
  if (!value) return "—";
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value?.seconds
        ? new Date(value.seconds * 1000)
        : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function AmendmentContent() {
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [amendment, setAmendment] = useState(null);

  const fetchAmendment = async (amendmentId, tripDocId = null) => {
    setLoading(true);
    setError("");
    setAmendment(null);

    try {
      const path = amendmentId
        ? `/api/manifest-amendments/${encodeURIComponent(amendmentId)}`
        : `/api/manifest-amendments/latest?tripId=${encodeURIComponent(tripDocId)}`;
      const data = await fetchPrintApi(path);
      setAmendment({
        ...data,
        adminName: data.adminName || "—",
      });
    } catch (err) {
      setError(err.message || "Failed to load manifest amendment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const amendmentId = searchParams.get("amendmentId");
    const tripId = searchParams.get("tripId");
    if (!amendmentId && !tripId) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setError("Please sign in to view print documents.");
        return;
      }

      if (amendmentId) {
        setSearchQuery(amendmentId);
        fetchAmendment(amendmentId);
      } else if (tripId) {
        setSearchQuery(tripId);
        fetchAmendment(null, tripId);
      }
    });

    return () => unsubscribe();
  }, [searchParams]);

  const handleManualLoad = () => {
    if (!searchQuery) return;
    if (searchQuery.startsWith("AMENDMENT-")) {
      fetchAmendment(searchQuery);
    } else {
      fetchAmendment(null, searchQuery);
    }
  };

  const entries = Array.isArray(amendment?.entries) ? amendment.entries : [];
  const verifyUrl =
    amendment?.verifyUrl ||
    (amendment?.amendmentId
      ? `https://atlastransport.ph/verify/amendment/${amendment.amendmentId}`
      : "");

  return (
    <div className="min-h-screen bg-slate-100 pb-10 print:bg-white print:pb-0 flex flex-col items-center">
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 p-4 print:hidden shadow-lg mb-8 w-full">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-96">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualLoad()}
                placeholder="Amendment ID or Trip ID..."
                className="w-full border border-slate-300 bg-white text-slate-900 rounded-lg pl-10 pr-4 py-2.5 text-sm font-mono"
              />
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-3.5 top-3 text-sm text-slate-400"
              />
            </div>
            <button
              onClick={handleManualLoad}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg border bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium text-sm"
            >
              Load
            </button>
          </div>
          <button
            onClick={() => window.print()}
            disabled={!amendment}
            className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm disabled:opacity-40"
          >
            <FontAwesomeIcon icon={faPrint} className="mr-2" />
            Print Addendum
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 max-w-3xl w-full">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-slate-500">Loading manifest amendment...</div>
      ) : null}

      {amendment ? (
        <PrintSheet>
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 flex items-center justify-center bg-white rounded-xl overflow-hidden">
                <Image
                  src="/atlas-logo.png"
                  alt="Atlas Logistics"
                  width={64}
                  height={64}
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-lg font-black uppercase">
                  Manifest Amendment / Addendum
                </h1>
                <p className="text-[10px] text-slate-500 mt-1 max-w-md">
                  This addendum supplements the original sealed manifest. The
                  original v1.0-LOCKED manifest remains unchanged.
                </p>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-[10px] font-bold text-amber-700 uppercase">
                    {amendment.version || "v1.x-AMENDMENT"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full border border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                    Addendum
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-dashed border-slate-300 rounded-xl p-3 flex gap-3 items-center bg-slate-50/50">
              <div className="w-20 h-20 bg-white border border-slate-200 rounded-lg p-1">
                <QRCode value={verifyUrl} size={80} level="M" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 mb-1">
                  Scan to verify this addendum only.
                </p>
                <div className="text-[9px] font-mono text-slate-900 break-all">
                  Hash: {amendment.hash}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetaItem label="Original Trip ID" value={amendment.originalTripId} />
            <MetaItem label="Version" value={amendment.version} />
            <MetaItem label="Admin" value={amendment.adminName} />
            <MetaItem label="Timestamp" value={formatTimestamp(amendment.sealedAt)} />
            <MetaItem
              label="Original Manifest"
              value={amendment.originalManifestId}
            />
            <MetaItem
              label="Base Version"
              value={amendment.baseVersion || "v1.0-LOCKED"}
            />
            <MetaItem label="Amendment ID" value={amendment.amendmentId} />
            <MetaItem label="Reason" value={amendment.reason} />
          </div>

          <div className="mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 mb-2">
              Added / Corrected Packages ({entries.length})
            </h2>
            <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-600 uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Shipment / Package ID</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2 text-left">Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={`${entry.packageId || entry.shipmentId}-${index}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold">{entry.changeType}</td>
                    <td className="px-3 py-2 font-mono">
                      {entry.packageId || entry.shipmentId}
                    </td>
                    <td className="px-3 py-2">{entry.reason || "—"}</td>
                    <td className="px-3 py-2">{entry.recordedByName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-200 pt-4">
            The original manifest QR/hash verifies only the sealed v1.0-LOCKED
            record. This addendum has its own cryptographic hash and QR code.
            Operational corrections must not alter the original locked manifest
            snapshot.
          </p>
        </PrintSheet>
      ) : null}
    </div>
  );
}

export default function ManifestAmendmentPrintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <AmendmentContent />
    </Suspense>
  );
}
