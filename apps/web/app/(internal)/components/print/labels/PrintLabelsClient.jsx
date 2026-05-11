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
          const q = query(
            collection(db, "shipments"),
            where("currentTripId", "==", tripId),
          );
          const querySnapshot = await getDocs(q);
          querySnapshot.forEach((doc) => {
            shipmentsToPrint.push({ id: doc.id, ...doc.data() });
          });
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
                {stats.packages}
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
          <span>🖨️ Print {stats.packages} Label/s</span>
        </button>
      </div>

      {/* LABEL LIST */}
      <div className="flex flex-col items-center print:block">
        {printItems.map((item) => (
          <div key={item.uniqueKey} className="label-container mb-8 print:mb-0">
            <StandardLabel
              shipment={item.shipment}
              pkg={item.pkg}
              index={item.index}
              total={item.totalInShipment}
            />

            {/* Force page break after every label */}
            <div className="page-break" />
          </div>
        ))}
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

// --- REUSABLE LABEL COMPONENT (4x6) ---
function StandardLabel({ shipment, pkg, index, total }) {
  const recipient = shipment.recipient || {};
  const address = recipient.address || {};
  const addressText = formatAddress(address);
  const qrValue = pkg.packageId || "NO_ID";

  console.log("Rendering label for pkg:", pkg);
  // console.log("Rendering label for package:", pkg);

  return (
    <div
      className="w-[4in] h-[6in] bg-white border-2 border-black p-4 
  print:border-2 print:border-dashed print:border-black
  flex flex-col justify-between relative overflow-hidden box-border mx-auto shadow-2xl"
    >
      {/* 1. TOP HEADER (Dest & Weight) */}
      <div className="border-b-4 border-black pb-2 mb-2">
        <div className="flex justify-between items-center">
          {/* LOGO */}
          <div className="flex items-center gap-2">
            <img
              src="/atlas-logo.png"
              alt="Atlas"
              className="h-8 w-auto object-contain"
            />
          </div>
          <div className="text-right flex flex-row items-end gap-1">
            <div className="text-xl font-bold text-dark uppercase">ATLAS: </div>
            <div className="text-xl font-medium text-gray-600">
              Fast & Easy Shipping
            </div>
          </div>

          {/* WEIGHT */}
          {/* <div className="text-right">
            <div className="text-[10px] font-bold text-gray-500 uppercase">
              Weight
            </div>
            <div className="text-xl font-bold">{pkg.weight} KG</div>
          </div> */}
        </div>

        {/* DESTINATION */}
        {/* <div className="text-5xl font-extrabold tracking-tighter uppercase leading-none truncate mt-1">
          {shipment.destinationCode || "DEST"}
        </div> */}
      </div>
      <div className="my-1 flex-1 flex justify-between gap-3">
        {/* LEFT: RECIPIENT + PACKAGE INFO */}
        <div className="flex-1 flex flex-col justify-start">
          <div className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">
            Ship To:
          </div>

          <div className="text-lg font-bold uppercase leading-tight line-clamp-2">
            {recipient.name || "Unknown"}
          </div>
          <div className="text-sm font-mono mt-0.5">{recipient.phone}</div>

          <div className="text-[10px] leading-tight mt-2 font-medium uppercase text-gray-800">
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
        <div className="w-[1.2in] flex flex-col justify-start text-[10px]">
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

      {/* QR CODE - WITH SAFETY CHECK */}
      <div className="flex flex-col items-center justify-center border-4 border-black rounded-xl pt-3 pb-2 my-1">
        <QRCode
          value={qrValue}
          size={180}
          level="M"
          bgColor="#ffffff"
          fgColor="#000000"
          className="bg-white p-2"
        />
        <div className="text-xs font-mono font-bold mt-2 tracking-widest text-center">
          {pkg.packageId || "NO ID"}
        </div>
        <div className="text-xs font-mono  mt-2 tracking-widest text-center">
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
