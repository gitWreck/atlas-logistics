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

        .shipping-label {
          box-sizing: border-box;
          position: relative;
          display: grid;
          grid-template-rows: 22mm 30mm 73mm 15mm;
          width: 100mm;
          height: 150mm;
          padding: 5mm;
          overflow: hidden;
          background: white;
          border: 2px solid black;
          margin: 0;
        }

        .label-header,
        .label-details,
        .label-qr,
        .label-footer {
          min-height: 0;
          overflow: hidden;
        }

        .label-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          border-bottom: 3px solid black;
        }

        .label-details {
          display: grid;
          grid-template-columns: 1fr 32mm;
          gap: 2mm;
          padding-top: 1mm;
        }

        .label-qr {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 3px solid black;
          border-radius: 8px;
          padding: 1.5mm;
        }

        .label-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-top: 3px solid black;
          padding-top: 1mm;
        }

        .package-description {
          display: -webkit-box;
          overflow: hidden;
          overflow-wrap: anywhere;
          line-height: 1.2;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }

        .package-description.long-text {
          font-size: 9px;
        }

        .package-address {
          display: -webkit-box;
          overflow: hidden;
          overflow-wrap: anywhere;
          line-height: 1.15;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
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

          .shipping-label {
            border: 0 !important;
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
}

// --- REUSABLE LABEL COMPONENT (100mm x 150mm fixed grid) ---
function StandardLabel({ shipment, pkg, index, total }) {
  const recipient = shipment.recipient || {};
  const address = recipient.address || {};
  const addressText = formatAddress(address);
  const qrValue = pkg.packageId || "NO_ID";
  const description = pkg.description || "No Description";
  const isLongDescription = description.length > 48;
  const QR_SIZE_MM = 52;
  const QR_SIZE = Math.round((QR_SIZE_MM * 96) / 25.4);
  const LOGO_SIZE = Math.round(QR_SIZE * 0.26);
  const LOGO_PAD = Math.round(QR_SIZE * 0.018);

  return (
    <div className="shipping-label label-sheet print:shadow-none">
      {/* Header — 22mm */}
      <div className="label-header">
        <div className="text-[28px] font-bold uppercase leading-none">ATLAS</div>
        <div className="text-[13px] font-medium text-gray-700 leading-tight">
          Fast & Easy Shipping
        </div>
      </div>

      {/* Recipient & package details — 30mm */}
      <div className="label-details">
        <div className="min-h-0 overflow-hidden">
          <div className="text-[9px] font-bold text-gray-500 uppercase leading-none">
            Ship To:
          </div>
          <div className="text-[15px] font-bold uppercase leading-tight line-clamp-1">
            {recipient.name || "Unknown"}
          </div>
          <div className="text-[11px] font-mono leading-tight">
            {recipient.phone}
          </div>
          <div className="package-address text-[9px] font-bold uppercase text-gray-800">
            {addressText || "No address provided"}
          </div>
        </div>

        <div className="min-h-0 overflow-hidden text-[9px] leading-tight">
          <div className="font-bold uppercase text-gray-500">Package Details</div>
          <div
            className={`package-description font-semibold uppercase ${
              isLongDescription ? "long-text" : ""
            }`}
          >
            Description: {description}
          </div>
          <div className="text-gray-600 uppercase line-clamp-1">
            Type: {pkg.packagingType || "Standard Packaging"}
          </div>
          <div className="text-gray-600 uppercase">
            Qty: {pkg.quantity || 1}
          </div>
        </div>
      </div>

      {/* QR code — 73mm */}
      <div className="label-qr">
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
        <div className="w-full text-[12px] font-mono font-bold tracking-tight text-center uppercase leading-tight">
          {pkg.packageId || "NO ID"}
        </div>
        <div className="text-[10px] font-mono tracking-widest text-center leading-tight">
          ATLAS PACKAGE ID
        </div>
      </div>

      {/* Footer — 15mm */}
      <div className="label-footer">
        <div>
          <div className="text-[8px] font-bold text-gray-500 uppercase leading-none">
            Origin
          </div>
          <div className="text-xl font-bold uppercase text-gray-800 leading-none">
            {shipment.originCode || "ORG"}
          </div>
        </div>

        <div className="flex gap-1">
          {pkg.isFragile && (
            <span className="text-xl" title="Fragile">
              <FontAwesomeIcon icon={faWineGlass} />
            </span>
          )}
          {pkg.isPerishable && (
            <span className="text-xl" title="Perishable">
              <FontAwesomeIcon icon={faSnowflake} />
            </span>
          )}
        </div>

        <div className="text-center">
          <div className="text-[8px] font-bold text-gray-500 uppercase leading-none line-clamp-1 max-w-[36mm]">
            {pkg.packagingType || "Standard Packaging"}
          </div>
          <div className="text-2xl font-bold leading-none">
            {index + 1}
            <span className="text-base text-gray-400 font-normal">/</span>
            {total}
          </div>
        </div>
      </div>
    </div>
  );
}
