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

  return (
    <div className="bg-gray-100 min-h-screen p-8 print:p-0 print:bg-white text-black font-sans">
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
            Format: 4" x 6" (Thermal) or A4 Portrait
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-xl hover:bg-blue-500 hover:scale-105 transition-all flex items-center gap-2 mx-auto"
        >
          <span>🖨️ Print {stats.packages || printItems.length} Label/s</span>
        </button>
      </div>

      {/* LABEL LIST */}
      <div className="flex flex-col items-center print:block">
        {printItems.map((item) =>
          item.packagePages.map((packagePage, pageIndex) => (
            <div
              key={`${item.uniqueKey}-page-${pageIndex}`}
              className="label-container mb-8 print:mb-0"
            >
              <StandardLabel
                shipment={item.shipment}
                pkg={item.pkg}
                packagePage={packagePage}
                packagePageIndex={pageIndex}
                packagePageCount={item.packagePages.length}
                totalQuantity={item.totalQuantity} // The calculated Sum (100 PCS)
              />
              <div className="page-break" />
            </div>
          )),
        )}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: 4in 6in;
          }
          body {
            background: white;
          }
          .page-break {
            page-break-after: always;
          }
          .label-container {
            break-inside: avoid;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 6in;
            width: 4in;
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

  return (
    <div className="w-[4in] h-[6in] bg-white border-2 border-black p-4 flex flex-col justify-between relative mx-auto shadow-2xl print:shadow-none">
      {/* 1. HEADER (Original) */}
      <div className="border-b-4 border-black pb-2 mb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img
              src="/atlas-logo.png"
              alt="Atlas"
              className="h-8 w-auto object-contain"
            />
          </div>
          <div className="text-right">
            <span className="text-xl font-bold uppercase">ATLAS: </span>
            <span className="text-xl font-medium text-gray-600">
              Fast & Easy Shipping
            </span>
          </div>
        </div>
      </div>

      <div className="my-1 flex-1 flex justify-between gap-2">
        {/* LEFT: RECIPIENT & DETAILED PACKAGE LIST (Moved here) */}
        <div className="w-[1.75in] shrink-0 flex flex-col justify-start">
          <div className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">
            Ship To:
          </div>
          <div className="text-lg font-bold uppercase leading-tight">
            {recipient.name}
          </div>
          <div className="text-sm font-mono mt-0.5">{recipient.phone}</div>
          <div className="text-[10px] leading-tight mt-1 font-medium uppercase text-gray-800">
            {addressText || "No address provided"}
          </div>

          <div className="self-center w-[1.7in] flex flex-col items-center justify-center border-2 rounded-lg border-black mt-3 px-2 py-2 mb-2">
            <QRCode
              value={qrValue}
              size={150}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
              className="bg-white p-1"
            />
            <div className="w-full text-[11px] font-mono font-bold mt-2 tracking-tighter text-center uppercase break-all">
              {shipment.shipmentId}
            </div>
            <div className="text-[10px] font-mono mt-1 tracking-widest text-center">
              ATLAS TRACKING NUMBER
            </div>
          </div>
        </div>

        {/* RIGHT: QR CODE & ATTEMPTS (Moved here) */}
        <div className="flex-1 min-w-0 flex flex-col items-stretch justify-start border-l pl-2">
          {/* QR CODE */}
          {/* <div className="flex flex-col items-center justify-center border-2 border-black p-1 mb-3">
            <QRCode value={qrValue} size={100} level="M" />
            <div className="text-[9px] font-mono font-bold mt-1 tracking-tighter text-center uppercase">
              {shipment.trackingNumber}
            </div>
          </div> */}

          {/* DELIVERY ATTEMPTS */}
          <div className="w-full">
            {/* <div className="text-[9px] font-bold uppercase text-gray-400 mb-1">
              Delivery
            </div>
            <div className="flex gap-1 mb-2">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className="w-4 h-4 border border-black text-[10px] flex items-center justify-center font-bold"
                >
                  {n}
                </span>
              ))}
            </div>
            <div className="text-[9px] font-bold uppercase text-gray-400 mb-1">
              Return
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className="w-4 h-4 border border-black text-[10px] flex items-center justify-center font-bold"
                >
                  {n}
                </span>
              ))}
            </div> */}
          </div>
          {/* ✅ DETAILED PACKAGE BREAKDOWN */}
          <div className="mt-3 border-t pt-2 w-full">
            <div className="flex items-center justify-between gap-2 font-bold uppercase text-gray-500 text-[10px] mb-1">
              <span>Package Breakdown</span>
              {packagePageCount > 1 && (
                <span className="shrink-0 text-[9px] text-gray-400">
                  {packagePageIndex + 1}/{packagePageCount}
                </span>
              )}
            </div>
            <div className="space-y-1">
              {packagePage.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_0.45in] gap-1 text-[10px] leading-tight border-b border-gray-100 pb-0.5"
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
      </div>

      {/* 4. FOOTER (Original) */}
      <div className="border-t-4 border-black pt-2 flex justify-between items-end mt-2">
        <div>
          <div className="text-[10px] font-bold text-gray-500 uppercase">
            Origin
          </div>
          <div className="text-2xl font-bold uppercase">
            {shipment.originCode || "ORG"}
          </div>
        </div>

        <div className="flex gap-2 mb-1">
          {pkg.isFragile && (
            <FontAwesomeIcon icon={faWineGlass} className="text-2xl" />
          )}
          {pkg.isPerishable && (
            <FontAwesomeIcon icon={faSnowflake} className="text-2xl" />
          )}
        </div>

        <div className="text-center">
          <div className="text-[10px] font-bold text-gray-500 uppercase">
            Total Items
          </div>
          <div className="text-3xl font-bold leading-none">
            {totalQuantity} <span className="text-sm text-gray-400">PCS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
