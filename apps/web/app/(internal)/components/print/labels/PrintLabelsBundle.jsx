"use client";
import React, { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSnowflake, faWineGlass } from "@fortawesome/free-solid-svg-icons";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore"; // Direct Firestore import for speed
import { db } from "@/lib/firebase";

const PACKAGES_PER_LABEL_PAGE = 15;

function chunkPackages(packages = []) {
  if (packages.length === 0) return [[]];

  const chunks = [];
  for (let i = 0; i < packages.length; i += PACKAGES_PER_LABEL_PAGE) {
    chunks.push(packages.slice(i, i + PACKAGES_PER_LABEL_PAGE));
  }
  return chunks;
}

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

export default function PrintLabelsBundle() {
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

        // --- Inside fetchData effect (FLATTEN THE DATA section) ---

        const flatList = [];
        let totalShipments = shipmentsToPrint.length;
        let totalLabels = 0;

        shipmentsToPrint.forEach((shipment) => {
          const packages = shipment.packages || [];
          const packagePages = chunkPackages(packages);
          totalLabels += packagePages.length;

          // ✅ 1. Calculate the TRUE Total (Sum of all internal 'quantity' fields)
          const trueTotalQuantity = packages.reduce(
            (acc, p) => acc + (Number(p.quantity) || 0),
            0,
          );

          // ✅ 2. Calculate the Unique Package Counts (e.g., "1 Sack, 2 Boxes")
          const packagingCounts = packages.reduce((acc, p) => {
            const type = p.packagingType || "Standard";
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {});

          // Convert the object into a displayable string (e.g., "1 Sack, 2 Box")
          const summaryText = Object.entries(packagingCounts)
            .map(([type, count]) => `${count} ${type}`)
            .join(", ");

          flatList.push({
            uniqueKey: `shipment-${shipment.id}`,
            shipment: shipment,
            pkg: {
              packageId: shipment.shipmentId, // Shipment-Level QR
              description:
                shipment.remarks || `${trueTotalQuantity} Total Pieces`,
              summaryText: summaryText || "Multiple Units", // e.g., "1 Sack, 2 Boxes"
              isFragile: packages.some((p) => p.isFragile),
              isPerishable: packages.some((p) => p.isPerishable),
            },
            packagePages,
            totalQuantity: trueTotalQuantity, // ✅ True Piece Count
            allPackages: packages, // ✅ Pass the full array for detailed listing on label
          });
        });

        setPrintItems(flatList);
        setStats({ shipments: totalShipments, packages: totalLabels }); // Stats updated for Shipment Mode
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

  const labelPages = printItems.flatMap((item) =>
    item.packagePages.map((packagePage, pageIndex) => ({
      item,
      packagePage,
      pageIndex,
    })),
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
                {stats.packages || printItems.length}
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
          <span>🖨️ Print {stats.packages || printItems.length} Label/s</span>
        </button>
      </div>

      {/* LABEL LIST */}
      <div className="flex flex-col items-center print:m-0 print:block print:p-0">
        {labelPages.map(({ item, packagePage, pageIndex }, i) => (
          <React.Fragment key={`${item.uniqueKey}-page-${pageIndex}`}>
            <div className="label-container mb-8 print:mb-0">
              <StandardLabel
                shipment={item.shipment}
                pkg={item.pkg}
                packagePage={packagePage}
                packagePageIndex={pageIndex}
                packagePageCount={item.packagePages.length}
                totalQuantity={item.totalQuantity}
              />
            </div>
            {/* Only between labels — a break after the last one creates a blank page */}
            {i < labelPages.length - 1 && <div className="page-break" />}
          </React.Fragment>
        ))}
      </div>

      <style jsx global>{`
        @page {
          size: 100mm 150mm;
          margin: 0;
        }

        .shipping-label-bundle {
          box-sizing: border-box;
          position: relative;
          display: grid;
          grid-template-rows: 22mm 103mm 15mm;
          width: 100mm;
          height: 150mm;
          padding: 5mm;
          overflow: hidden;
          background: white;
          border: 2px solid black;
          margin: 0;
        }

        .label-header,
        .label-body,
        .label-footer {
          min-height: 0;
          overflow: hidden;
        }

        .label-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 3px solid black;
        }

        .label-body {
          display: grid;
          grid-template-columns: 42mm 1fr;
          gap: 2mm;
          padding-top: 1mm;
        }

        .label-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-top: 3px solid black;
          padding-top: 1mm;
        }

        .package-items {
          max-height: 78mm;
          overflow: hidden;
        }

        .package-address {
          display: -webkit-box;
          overflow: hidden;
          overflow-wrap: anywhere;
          line-height: 1.15;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
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

          .shipping-label-bundle {
            border: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

function StandardLabel({
  shipment,
  pkg,
  totalQuantity,
  packagePage = [],
  packagePageIndex = 0,
  packagePageCount = 1,
}) {
  const recipient = shipment.recipient || {};
  const address = recipient.address || {};
  const addressText = formatAddress(address);
  const qrValue = shipment.shipmentId || "NO_ID";
  const QR_SIZE_MM = 34;
  const QR_SIZE = Math.round((QR_SIZE_MM * 96) / 25.4);

  return (
    <div className="shipping-label-bundle label-sheet print:shadow-none">
      {/* Header — 22mm */}
      <div className="label-header">
        <img
          src="/atlas-logo.png"
          alt="Atlas"
          className="h-[14mm] w-auto object-contain"
        />
        <div className="text-right leading-tight">
          <span className="text-base font-bold uppercase">ATLAS: </span>
          <span className="text-base font-medium text-gray-600">
            Fast & Easy Shipping
          </span>
        </div>
      </div>

      {/* Body — 103mm fixed */}
      <div className="label-body">
        <div className="min-h-0 overflow-hidden flex flex-col">
          <div className="text-[9px] font-bold text-gray-500 uppercase leading-none">
            Ship To:
          </div>
          <div className="text-[13px] font-bold uppercase leading-tight line-clamp-2">
            {recipient.name}
          </div>
          <div className="text-[11px] font-mono leading-tight">
            {recipient.phone}
          </div>
          <div className="package-address text-[9px] font-medium uppercase text-gray-800">
            {addressText || "No address provided"}
          </div>

          <div className="mt-auto flex w-full flex-col items-center justify-center border-2 border-black rounded-lg px-1 py-1">
            <QRCode
              value={qrValue}
              size={QR_SIZE}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
              className="bg-white"
              style={{ width: `${QR_SIZE_MM}mm`, height: `${QR_SIZE_MM}mm` }}
            />
            <div className="w-full text-[9px] font-mono font-bold tracking-tighter text-center uppercase break-all leading-tight">
              {shipment.shipmentId}
            </div>
            <div className="text-[8px] font-mono tracking-widest text-center leading-tight">
              ATLAS TRACKING NUMBER
            </div>
          </div>
        </div>

        <div className="min-h-0 overflow-hidden border-l border-gray-300 pl-2">
          <div className="flex items-center justify-between gap-2 font-bold uppercase text-gray-500 text-[9px]">
            <span>Package Breakdown</span>
            {packagePageCount > 1 && (
              <span className="shrink-0 text-[8px] text-gray-400">
                {packagePageIndex + 1}/{packagePageCount}
              </span>
            )}
          </div>
          <div className="package-items space-y-0.5">
            {packagePage.map((p, i) => (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,1fr)_0.4in] gap-1 text-[9px] leading-tight border-b border-gray-100 pb-0.5"
              >
                <span className="min-w-0 uppercase whitespace-normal break-words line-clamp-2">
                  {p.packagingType || "Package"}:{" "}
                  {p.description || "No Description"}
                </span>
                <span className="font-bold text-right whitespace-nowrap">
                  {p.quantity || 1} PCS
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer — 15mm */}
      <div className="label-footer">
        <div>
          <div className="text-[8px] font-bold text-gray-500 uppercase leading-none">
            Origin
          </div>
          <div className="text-xl font-bold uppercase leading-none">
            {shipment.originCode || "ORG"}
          </div>
        </div>

        <div className="flex gap-2">
          {pkg.isFragile && (
            <FontAwesomeIcon icon={faWineGlass} className="text-xl" />
          )}
          {pkg.isPerishable && (
            <FontAwesomeIcon icon={faSnowflake} className="text-xl" />
          )}
        </div>

        <div className="text-center">
          <div className="text-[8px] font-bold text-gray-500 uppercase leading-none">
            Total Items
          </div>
          <div className="text-2xl font-bold leading-none">
            {totalQuantity}{" "}
            <span className="text-xs text-gray-400">PCS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
