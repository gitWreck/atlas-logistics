"use client";

export const dynamic = "force-dynamic"; // Keep this for safety

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPrint,
  faSearch,
  faCheckCircle,
  faTimesCircle,
  faQrcode,
} from "@fortawesome/free-solid-svg-icons";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import QRCode from "react-qr-code";
import Image from "next/image";

// --- 1. HELPER COMPONENTS ---

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
    <div className="text-xl font-black text-slate-900">{value}</div>
  </div>
);

const DestinationCard = ({ group }) => {
  const items = group.items || [];
  const subtotal = items.reduce((acc, it) => acc + (it.packageCount || 0), 0);

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
          {items.map((item, i) => (
            <tr key={i}>
              <td className="px-4 py-2 font-mono text-slate-700 font-medium">
                {item.trackingNumber}
                {item.note && (
                  <span className="block text-[9px] text-slate-400 font-sans">
                    {item.note}
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-right font-bold text-slate-900">
                {/* {item.packageCount} */}
                {item.descriptionBreakdown &&
                item.descriptionBreakdown.length > 0 ? (
                  <div className="flex flex-col items-end gap-0.5">
                    {item.descriptionBreakdown.map((line, idx) => (
                      <div key={idx} className="text-[10px] whitespace-nowrap">
                        <span className="text-slate-500 font-medium">
                          {line.desc}:{" "}
                        </span>
                        <span className="text-slate-900">{line.count}</span>
                      </div>
                    ))}
                    {/* Optional: Show Total line if multiple types exist */}
                    {item.descriptionBreakdown.length > 1 && (
                      <div className="border-t border-slate-200 mt-1 pt-1 text-[10px]">
                        Total: {item.packageCount}
                      </div>
                    )}
                  </div>
                ) : (
                  item.packageCount
                )}
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-bold">
            <td className="px-4 py-2 text-right text-slate-500 text-[10px] uppercase">
              Subtotal
            </td>
            <td className="px-4 py-2 text-right text-slate-900">{subtotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const SignatureBox = ({ label }) => (
  <div className="border border-slate-300 rounded-lg p-3 h-24 flex flex-col justify-between bg-white">
    <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
      {label}
    </div>
    <div className="border-t border-slate-300 pt-1"></div>
  </div>
);

// --- 2. INNER LOGIC COMPONENT (Contains useSearchParams) ---

function ManifestContent() {
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("READY");
  const [manifest, setManifest] = useState(null);

  const fetchManifestData = async (paramType, paramValue) => {
    setLoading(true);
    setError("");
    setStatus("READY");
    setManifest(null);

    try {
      let tripId = paramValue;
      let tripData = null;

      const tripRef = doc(db, "truck_trips", tripId);
      const tripSnap = await getDoc(tripRef);

      if (!tripSnap.exists()) throw new Error("Trip not found");
      tripData = tripSnap.data();

      const q = query(
        collection(db, "shipments"),
        where("currentTruckTripId", "==", tripId),
      );
      const shipSnaps = await getDocs(q);

      const shipments = [];
      shipSnaps.forEach((doc) => shipments.push(doc.data()));

      const groupedDestinations = {};
      let totalPackages = 0;

      shipments.forEach((ship) => {
        const destCode = ship.destinationCode || "UNKNOWN";
        const itemsCount =
          ship.packages?.length || ship.totals?.totalItems || 0;
        totalPackages += itemsCount;

        // --- NEW: Calculate Description Breakdown ---
        const descCounts = {};
        if (ship.packages && Array.isArray(ship.packages)) {
          ship.packages.forEach((p) => {
            // Use description or fallback to "Standard Pkg"
            const d = p.description ? p.description.trim() : "Standard Pkg";
            descCounts[d] = (descCounts[d] || 0) + 1;
          });
        }

        // Convert object to array for easier rendering: [{desc: "Box", count: 2}, ...]
        const descriptionBreakdown = Object.entries(descCounts).map(
          ([k, v]) => ({
            desc: k,
            count: v,
          }),
        );

        // ----------------------

        if (!groupedDestinations[destCode]) {
          groupedDestinations[destCode] = {
            destination: ship.destinationCity || destCode,
            routeCode: `${ship.originCode || "ORG"}-${destCode}`,
            items: [],
          };
        }

        groupedDestinations[destCode].items.push({
          trackingNumber: ship.trackingNumber,
          packageCount: itemsCount,
          note: ship.packages?.some((p) => p.isFragile) ? "Fragile" : "",

          descriptionBreakdown: descriptionBreakdown, // <--- Add this new field
        });
      });

      const destinationArray = Object.values(groupedDestinations);

      const data = {
        tripId: tripSnap.id,
        tripNumber: tripData.tripId || "T-PENDING",
        driverName: tripData.driverName || "Unassigned",
        truckPlate: tripData.truckPlateNumber || tripData.plateNumber || "—",
        origin: tripData.origin || "Warehouse",
        route: tripData.route || "Direct",
        sealedAt:
          tripData.manifestGeneratedAt?.toDate().toISOString() ||
          new Date().toISOString(),
        version: tripData.manifestLocked ? "v1.0-LOCKED" : "DRAFT-PREVIEW",
        manifestHash: tripData.manifestHash || "DRAFT-NO-HASH-GENERATED",
        verifyUrl: `https://atlas-trucking-platform.vercel.app/verify/${tripSnap.id}`,
        stamps: tripData.manifestLocked
          ? ["LOCKED", "OFFICIAL_RECORD"]
          : ["DRAFT", "UNVERIFIED"],
        totals: {
          shipments: shipments.length,
          packages: totalPackages,
          destinations: destinationArray.length,
        },
        destinations: destinationArray,
      };

      setManifest(data);
      setStatus("OK");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load manifest");
      setStatus("BAD");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const m = searchParams.get("m");
    const tripId = searchParams.get("tripId");

    if (m) {
      setSearchQuery(m);
      fetchManifestData("m", m);
    } else if (tripId) {
      setSearchQuery(tripId);
      fetchManifestData("tripId", tripId);
    }
  }, [searchParams]);

  const handleManualLoad = () => {
    if (!searchQuery) return;
    const isHash = searchQuery.length > 20;
    fetchManifestData(isHash ? "m" : "tripId", searchQuery);
  };

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

      {/* TOOLBAR */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 p-4 print:hidden shadow-lg mb-8 w-full">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-96">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualLoad()}
                placeholder="Enter Manifest Hash or Trip ID..."
                className="w-full border border-slate-300 bg-white text-slate-900 rounded-lg pl-10 pr-4 py-2.5 focus:border-blue-500 focus:outline-none text-sm font-mono"
              />
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-3.5 top-3 text-sm text-slate-400"
              />
            </div>
            <button
              onClick={handleManualLoad}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg border bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300 font-medium text-sm transition-colors"
            >
              Load
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-full border ${
                status === "OK"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : status === "BAD"
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-slate-200 text-slate-600 border-slate-300"
              }`}
            >
              {status === "OK" && <FontAwesomeIcon icon={faCheckCircle} />}
              {status === "BAD" && <FontAwesomeIcon icon={faTimesCircle} />}
              <span>
                {status === "OK"
                  ? "VERIFIED"
                  : status === "BAD"
                    ? "INVALID"
                    : "READY"}
              </span>
            </div>

            <button
              onClick={() => window.print()}
              disabled={!manifest}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
            >
              <FontAwesomeIcon icon={faPrint} /> Print Manifest
            </button>
          </div>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3 print:hidden">
          <FontAwesomeIcon icon={faTimesCircle} /> {error}
        </div>
      )}

      {/* MANIFEST SHEET */}
      {manifest && (
        <PrintSheet>
          {/* HEADER */}
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
                  ATLAS OFFICIAL SEALED BILL OF LADING <br /> & CARGO
                  DECLARATION
                </h1>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug max-w-sm">
                  Atlas Logistics Platform — digitally sealed cargo ledger for
                  port / RORO / checkpoint verification.
                </p>
                <div className="flex gap-2 mt-2">
                  {manifest.stamps?.map((stamp) => (
                    <span
                      key={stamp}
                      className="px-2 py-0.5 rounded-full border border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-600 uppercase tracking-wide"
                    >
                      {stamp}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* QR / Hash */}
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
                  Scan to verify authenticity at port.
                  <br />
                  <span className="font-mono text-slate-900">
                    {manifest.verifyUrl}
                  </span>
                </p>
                <div className="bg-slate-100 border border-slate-200 rounded px-2 py-1 text-[9px] font-mono text-slate-900 break-all leading-tight">
                  Hash: {manifest.manifestHash}
                </div>
              </div>
            </div>
          </div>

          <hr className="border-t-2 border-slate-900/10 mb-6" />

          {/* METADATA GRID */}
          <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-xl p-4 bg-white mb-6">
            <MetaItem label="Trip ID" value={manifest.tripId} />
            <MetaItem label="Trip Number" value={manifest.tripNumber} />
            <MetaItem label="Driver" value={manifest.driverName} />
            <MetaItem label="Truck Plate" value={manifest.truckPlate} />
            <MetaItem label="Origin" value={manifest.origin} />
            <MetaItem label="Route" value={manifest.route} />
            <MetaItem
              label="Sealed At"
              value={new Date(manifest.sealedAt).toLocaleString()}
            />
            <MetaItem label="Version" value={manifest.version} />
          </div>

          {/* TOTALS */}
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Trip Totals
          </h4>
          <div className="grid grid-cols-3 gap-0 border-2 border-slate-900/10 rounded-xl overflow-hidden mb-6">
            <TotalItem
              label="Total Shipments"
              value={manifest.totals.shipments}
            />
            <TotalItem
              label="Total Packages"
              value={manifest.totals.packages}
            />
            <TotalItem
              label="Destinations"
              value={manifest.totals.destinations}
            />
          </div>

          {/* DESTINATIONS LIST */}
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Packages by Destination
          </h4>
          <div className="space-y-4 mb-8">
            {manifest.destinations.map((group, idx) => (
              <DestinationCard key={idx} group={group} />
            ))}
          </div>

          {/* SIGNATURES */}
          <div className="break-inside-avoid">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Signatures
            </h4>
            <div className="grid grid-cols-3 gap-6 mb-8">
              <SignatureBox label="Driver Signature" />
              <SignatureBox label="Warehouse / Dispatcher" />
              <SignatureBox label="Port Officer" />
            </div>
          </div>

          {/* LEGAL TEXT */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-[9px] leading-relaxed text-slate-700 text-justify break-inside-avoid print:bg-transparent print:border-slate-300">
            <div className="text-center mb-4">
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-tight">
                Atlas Official Sealed Bill of Lading & Cargo Declaration
              </h3>
              <p className="italic text-slate-500">
                (Shipping Manifest, Chain-of-Custody Record & Sealed-Cargo
                Enforcement Instrument)
              </p>
            </div>

            <div className="space-y-2 mb-4">
              <p>
                This document constitutes the{" "}
                <strong className="text-slate-900">
                  exclusive and final cargo ledger
                </strong>{" "}
                for the referenced trip and forms an{" "}
                <strong className="text-slate-900">
                  integral and controlling part of the Contract of Carriage
                </strong>{" "}
                governing this shipment.
              </p>
              <p>
                This Shipping Manifest was digitally generated, sealed, and
                cryptographically signed by the{" "}
                <strong className="text-slate-900">
                  Atlas Logistics Platform
                </strong>{" "}
                at the moment the trip was locked. It represents the{" "}
                <strong className="text-slate-900">
                  complete, final, and authoritative record
                </strong>{" "}
                of all cargo loaded onto this vehicle for the specified trip.
              </p>
              <div>
                <strong className="text-slate-900 block mb-1">
                  Once sealed:
                </strong>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>
                    All package identities, quantities, and destinations are{" "}
                    <strong className="text-slate-900">
                      final and immutable
                    </strong>
                    .
                  </li>
                  <li>
                    Any modification, substitution, or removal of cargo{" "}
                    <strong className="text-slate-900">
                      invalidates this manifest
                    </strong>
                    .
                  </li>
                  <li>
                    The cryptographic hash and QR verification system are the{" "}
                    <strong className="text-slate-900">
                      sole authoritative means of validation
                    </strong>
                    .
                  </li>
                </ul>
              </div>
              <p>
                This manifest is binding upon ports, RORO operators,
                checkpoints, warehouses, contract carriers, and insurance and
                audit personnel. Verification must be performed by scanning the
                QR code or entering the manifest hash into the Atlas
                verification system. A manifest that does not pass verification{" "}
                <strong className="text-slate-900">
                  shall be treated as invalid and fraudulent
                </strong>
                .
              </p>
            </div>

            <div className="mb-4">
              <h4 className="font-bold text-[10px] text-slate-900 uppercase border-b border-slate-300 mb-2 pb-1">
                Sealed Cargo Protocol
              </h4>
              <p className="mb-2">
                Upon sealing, this vehicle enters{" "}
                <strong className="text-slate-900">
                  Atlas Sealed Cargo Status
                </strong>
                . The cargo compartment is deemed{" "}
                <strong className="text-slate-900">
                  closed, locked, and protected
                </strong>{" "}
                for the duration of the trip. The cargo shall not be opened,
                accessed, inspected, transferred, or unloaded by any party until
                the vehicle reaches its designated receiving facility:
              </p>

              <p className="text-center font-bold text-slate-900 my-2 bg-slate-100 py-1 border border-slate-200 rounded uppercase">
                {manifest.route || "Designated Atlas Warehouse"} — Atlas
                Logistics
              </p>

              <p className="mb-1">
                Except only under one of the following conditions:
              </p>

              <ul className="list-disc pl-4 mb-2 space-y-0.5">
                <li>Arrival at the designated Atlas warehouse.</li>
                <li>
                  Inspection by lawful authority acting under a{" "}
                  <strong className="text-slate-900">
                    written, court-issued warrant or legal order
                  </strong>
                  .
                </li>
                <li>
                  Emergency conditions involving immediate risk to life, vehicle
                  safety, or public safety.
                </li>
              </ul>
              <p>
                No verbal instruction, port request, terminal policy,
                third-party directive, or local operating procedure shall
                override this sealed-cargo order.
              </p>
            </div>

            <div className="mb-4">
              <h4 className="font-bold text-[10px] text-slate-900 uppercase border-b border-slate-300 mb-2 pb-1">
                Unauthorized Access & Legal Consequences
              </h4>
              <p className="mb-2">
                Any opening, inspection, seal break, or removal of cargo from
                this vehicle prior to arrival at the designated Atlas warehouse,
                without a valid court-issued warrant or lawful emergency,
                constitutes{" "}
                <strong className="text-slate-900">
                  unauthorized interference with sealed freight
                </strong>
                .
              </p>
              <p className="mb-2">
                Any such seal break or compartment opening shall be{" "}
                <strong className="text-slate-900">
                  conclusively presumed to constitute
                </strong>{" "}
                cargo tampering unless proven otherwise by the responsible
                party.
              </p>

              <ul className="list-disc pl-4 space-y-0.5 mb-2">
                <li>Immediately invalidates this Shipping Manifest.</li>
                <li>
                  Triggers Atlas audit, incident, and verification logging.
                </li>
                <li>
                  Voids all carrier, port, and terminal liability protections.
                </li>
                <li>
                  Exposes the responsible party to civil, contractual, and tort
                  liability.
                </li>
              </ul>
              <p>
                Atlas Logistics reserves the right to pursue{" "}
                <strong className="text-slate-900">
                  all available legal remedies
                </strong>
                .
              </p>
            </div>

            <div className="mb-4">
              <h4 className="font-bold text-[10px] text-slate-900 uppercase border-b border-slate-300 mb-2 pb-1">
                Legal & Audit Authority
              </h4>
              <p className="mb-2">
                Atlas maintains a permanent cryptographic and operational audit
                trail. These records constitute{" "}
                <strong className="text-slate-900">prima facie evidence</strong>{" "}
                of cargo condition and custody.
              </p>
              <p className="font-bold text-slate-900 text-center uppercase text-[10px]">
                This manifest is legally equivalent to a sealed bill of lading,
                cargo declaration, and chain-of-custody record.
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-300 text-[8px] italic text-slate-500 text-center">
              Audit Notice: This document is intended for checkpoint, port, and
              RORO digital verification only. Verification must be performed via
              the QR code or manifest hash. If verification does not validate,
              Atlas Operations must be notified immediately. No cargo
              compartment may be opened, accessed, or inspected without a
              court-issued warrant or lawful emergency.
            </div>
          </div>
        </PrintSheet>
      )}

      {loading && (
        <div className="text-center py-20 print:hidden">
          <div className="animate-spin text-blue-500 text-3xl mb-4">
            <FontAwesomeIcon icon={faQrcode} />
          </div>
          <p className="text-slate-600">Verifying Cryptographic Seal...</p>
        </div>
      )}
    </div>
  );
}

// --- 3. WRAPPER COMPONENT (DEFAULT EXPORT) ---

export default function ManifestPrintPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-800">
          <div className="text-center p-10">Loading Manifest System...</div>
        </div>
      }
    >
      <ManifestContent />
    </Suspense>
  );
}
