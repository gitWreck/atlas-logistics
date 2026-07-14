"use client";
import React, { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { useSearchParams } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore"; // Direct Firestore import for speed
import { db } from "@/lib/firebase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSnowflake, faWineGlass } from "@fortawesome/free-solid-svg-icons";

function formatAddress(address = {}) {
  return [
    address.unit,
    address.street,
    address.barangay,
    address.city,
    address.province,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
}

export default function PrintLabelsClient() {
  const searchParams = useSearchParams();
  const shipmentId = searchParams.get("id"); // Single Shipment Mode
  const tripId = searchParams.get("tripId"); // Bulk Trip Mode

  const [printItems, setPrintItems] = useState([]); // Flat list of { pkg, shipment }
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ shipments: 0, packages: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        let shipmentsToPrint = [];

        // MODE A: Single Shipment
        if (shipmentId) {
          const snap = await getDoc(doc(db, "shipments", shipmentId));
          if (snap.exists())
            shipmentsToPrint.push({ id: snap.id, ...snap.data() });
        }
        // MODE B: Entire Trip
        else if (tripId) {
          // Query all shipments assigned to this trip
          // NOTE: We query the ROOT 'shipments' collection to get full package details
          // Multi-trip shipments have currentTripId=null, so also match the
          // currentTripIds array and de-dupe.
          const [byTripIdSnap, byTripIdsArraySnap] = await Promise.all([
            getDocs(
              query(
                collection(db, "shipments"),
                where("currentTripId", "==", tripId),
              ),
            ),
            getDocs(
              query(
                collection(db, "shipments"),
                where("currentTripIds", "array-contains", tripId),
              ),
            ).catch(() => ({ docs: [] })),
          ]);
          const printMap = new Map();
          [...byTripIdSnap.docs, ...byTripIdsArraySnap.docs].forEach((doc) => {
            printMap.set(doc.id, { id: doc.id, ...doc.data() });
          });
          shipmentsToPrint.push(...printMap.values());
        }

        // FLATTEN THE DATA
        // We create a single array where every item is a label to be printed
        const flatList = [];
        let pkgCount = 0;

        shipmentsToPrint.forEach((shipment) => {
          const packages = shipment.packages || [];
          pkgCount += packages.length;

          packages.forEach((pkg, index) => {
            flatList.push({
              uniqueKey: `${shipment.id}-${pkg.packageId}-${index}`,
              pkg: pkg,
              shipment: shipment, // Pass parent shipment data for address/routing
              index: index, // 1 of X
              totalInShipment: packages.length,
            });
          });
        });

        setPrintItems(flatList);
        setStats({ shipments: shipmentsToPrint.length, packages: pkgCount });
      } catch (err) {
        console.error("Error fetching labels:", err);
      } finally {
        setLoading(false);
      }
    };

    if (shipmentId || tripId) fetchData();
  }, [shipmentId, tripId]);

  if (loading)
    return (
      <div className="p-10 text-center animate-pulse">Generating Labels...</div>
    );
  if (printItems.length === 0)
    return (
      <div className="p-10 text-center text-red-500">
        No packages found to print.
      </div>
    );

  return (
    <div className="label-print-root bg-gray-100 min-h-screen p-8 print:m-0 print:min-h-0 print:p-0 print:bg-white text-black font-sans">
      {/* INSTRUCTIONS (Hidden when printing) */}
      <div className="max-w-md mx-auto mb-8 print:hidden text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">
          {tripId ? "Trip Manifest Labels" : "Shipment Labels"}
        </h1>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-sm">
          <div className="grid grid-cols-2 gap-4 text-left">
            <div>
              <div className="text-xs text-gray-500 uppercase font-bold">
                Shipments
              </div>
              <div className="text-lg font-bold">{stats.shipments}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase font-bold">
                Total Labels
              </div>
              <div className="text-lg font-bold text-blue-600">
                {stats.packages}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-400 border-t pt-2">
            Format: 100mm x 150mm (Thermal)
          </p>
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
            <p className="font-bold uppercase">Before printing</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>
                Paper size: <strong>100mm x 150mm</strong>
              </li>
              <li>
                Margins: <strong>None</strong>
              </li>
              <li>
                Scale: <strong>100%</strong> (turn off{" "}
                <strong>Fit to printable area</strong>)
              </li>
            </ul>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-xl hover:bg-blue-500 hover:scale-105 transition-all flex items-center gap-2 mx-auto"
        >
          <span>🖨️ Print {stats.packages} Label/s</span>
        </button>
      </div>

      {/* LABEL LIST */}
      <div className="flex flex-col items-center print:m-0 print:block print:p-0">
        {printItems.map((item) => (
          <React.Fragment key={item.uniqueKey}>
            <div className="label-container mb-8 print:mb-0">
              <StandardLabel
                shipment={item.shipment}
                pkg={item.pkg}
                index={item.index}
                total={item.totalInShipment}
              />
            </div>
            <div className="page-break" />
          </React.Fragment>
        ))}
      </div>

      <style jsx global>{`
        @page {
          size: 100mm 150mm;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 100mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .label-print-root,
          .label-print-root * {
            box-sizing: border-box;
          }

          .label-print-root {
            width: 100mm !important;
            margin: 0 !important;
            padding: 0 !important;
            min-height: 0 !important;
            background: white !important;
          }

          .page-break {
            break-after: page;
            page-break-after: always;
            height: 0;
            margin: 0;
            padding: 0;
          }

          .label-container {
            position: relative;
            display: block;
            width: 100mm !important;
            height: 150mm !important;
            margin: 0 !important;
            padding: 0 !important;
            break-inside: avoid;
            page-break-inside: avoid;
            overflow: hidden;
          }

          .label-sheet {
            position: absolute;
            top: 0;
            left: 0;
            width: 100mm !important;
            height: 150mm !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

// --- REUSABLE LABEL COMPONENT (4x6) ---
function StandardLabel({ shipment, pkg, index, total }) {
  const recipient = shipment.recipient || {};
  const address = recipient.address || {};
  const addressText = formatAddress(address);
  const qrValue = pkg.packageId || "NO_ID";
  const QR_SIZE_MM = 56;
  const QR_SIZE = Math.round((QR_SIZE_MM * 96) / 25.4);
  const LOGO_SIZE = Math.round(QR_SIZE * 0.26);
  const LOGO_PAD = Math.round(QR_SIZE * 0.018);

  return (
    <div
      className="label-sheet w-[100mm] h-[150mm] bg-white border-2 border-black p-[3mm]
  print:border-0
  flex flex-col justify-between relative overflow-hidden box-border
  m-0 print:m-0 print:shadow-none"
    >
      {/* 1. TOP HEADER */}
      <div className="border-b-4 border-black pb-2 mb-2">
        <div className="flex flex-col items-center text-center">
          <div className="text-[35px] font-bold text-dark uppercase leading-none">
            ATLAS
          </div>
          <div className="text-[17px] font-medium text-gray-700 leading-tight">
            Fast & Easy Shipping
          </div>
        </div>
      </div>
      <div className="my-1 flex-1 flex justify-between gap-3">
        {/* LEFT: RECIPIENT + PACKAGE INFO */}
        <div className="flex-1 flex flex-col justify-start">
          <div className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">
            Ship To:
          </div>

          <div className="text-xl font-bold uppercase leading-tight line-clamp-2">
            {recipient.name || "Unknown"}
          </div>
          <div className="text-sm font-mono mt-0.5">{recipient.phone}</div>

          <div className="text-[10px] leading-tight mt-2 font-bold uppercase text-gray-800">
            {addressText || "No address provided"}
          </div>

          {/* PACKAGE INFO */}
          <div className="mt-3 border-t pt-2 text-[10px]">
            {/* <div className="font-bold uppercase text-gray-500">
              Package Details
            </div>
            <div className="font-semibold uppercase">
              Description: {pkg.description || "No Description"}
            </div>
            <div className="text-gray-600 uppercase">
              Package Type: {pkg.packagingType || "Standard Packaging"}
            </div>
            <div className="text-gray-600 uppercase">
              Quantity: {pkg.quantity || 1}
            </div> */}
          </div>
        </div>

        {/* RIGHT: DELIVERY / RETURN ATTEMPTS */}
        <div className="w-[32mm] shrink-0 flex flex-col justify-start text-[10px]">
          <div className="font-bold uppercase text-gray-500">
            Package Details
          </div>
          <div className="font-semibold uppercase">
            Description: {pkg.description || "No Description"}
          </div>
          <div className="text-gray-600 uppercase">
            Package Type: {pkg.packagingType || "Standard Packaging"}
          </div>
          <div className="text-gray-600 uppercase">
            Quantity: {pkg.quantity || 1}
          </div>
        </div>
      </div>

      {/* QR CODE */}
      <div className="flex w-full min-h-[80mm] flex-col items-center justify-center border-4 border-black rounded-xl px-[2mm] py-[2mm] my-1">
        <div
          className="relative shrink-0"
          style={{ width: `${QR_SIZE_MM}mm`, height: `${QR_SIZE_MM}mm` }}
        >
          <QRCode
            value={qrValue}
            size={QR_SIZE}
            level="H"
            bgColor="#ffffff"
            fgColor="#000000"
            className="h-full w-full"
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="flex items-center justify-center bg-white"
              style={{ padding: LOGO_PAD }}
            >
              <img
                src="/atlas-logo.png"
                alt="Atlas"
                className="object-contain"
                style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
              />
            </div>
          </div>
        </div>
        <div className="mt-2 w-full text-[13px] font-mono font-bold tracking-tight text-center uppercase">
          {pkg.packageId || "NO ID"}
        </div>
        <div className="mt-1 text-[12px] font-mono tracking-widest text-center">
          ATLAS PACKAGE ID
        </div>
      </div>

      {/* 4. FOOTER (Origin & Count) */}
      <div className="border-t-4 border-black pt-2 flex justify-between items-end mt-2">
        <div>
          <div className="text-[10px] font-bold text-gray-500 uppercase">
            Origin
          </div>
          <div className="text-2xl font-bold uppercase text-gray-800">
            {shipment.originCode || "ORG"}
          </div>
        </div>

        {/* Package Handling Icons/Tags */}
        <div className="flex gap-1">
          {pkg.isFragile && (
            <span className="text-2xl" title="Fragile">
              <FontAwesomeIcon icon={faWineGlass} />
            </span>
          )}
          {pkg.isPerishable && (
            <span className="text-2xl" title="Perishable">
              <FontAwesomeIcon icon={faSnowflake} />
            </span>
          )}
        </div>

        <div className="text-center">
          <div className="text-[10px] font-bold text-gray-500 uppercase">
            {pkg.packagingType || "Standard Packaging"}
          </div>
          <div className="text-3xl font-bold leading-none">
            {index + 1}
            <span className="text-lg text-gray-400 font-normal">/</span>
            {total}
          </div>
        </div>
      </div>
    </div>
  );
}
