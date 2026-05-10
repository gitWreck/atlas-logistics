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
} from "firebase/firestore";
import { db } from "@/lib/firebase";

function formatDate(value) {
  if (!value) return "—";

  try {
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleDateString();
    }

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  } catch {
    return "—";
  }
}

function getShipmentQuantity(shipment = {}) {
  return Number(
    shipment?.totals?.totalContentQty ??
      shipment?.totalContentQty ??
      shipment?.totalItems ??
      0,
  );
}

function getShipmentDescription(shipment = {}) {
  if (Array.isArray(shipment?.packages) && shipment.packages.length > 0) {
    return shipment.packages
      .map((pkg) => {
        const qty = Number(pkg.quantity) || 1;
        const desc = pkg.description || "Package";
        return qty > 1 ? `${desc} (${qty})` : desc;
      })
      .join(", ");
  }

  if (Array.isArray(shipment?.items) && shipment.items.length > 0) {
    return shipment.items
      .map((item) => {
        const qty = Number(item.quantity) || 1;
        const desc = item.description || "Item";
        return qty > 1 ? `${desc} (${qty})` : desc;
      })
      .join(", ");
  }

  return "—";
}

function getDestination(shipment = {}) {
  return shipment?.recipient?.address?.city || shipment?.destination || "—";
}

function getShipmentDisplayId(shipment = {}) {
  return shipment?.shipmentId || shipment?.id || "—";
}

const SHIPMENTS_PER_PAGE = 12;

function chunkShipments(shipments = []) {
  if (shipments.length === 0) return [[]];
  const chunks = [];
  for (let i = 0; i < shipments.length; i += SHIPMENTS_PER_PAGE) {
    chunks.push(shipments.slice(i, i + SHIPMENTS_PER_PAGE));
  }
  return chunks;
}

export default function PrintManifest() {
  const searchParams = useSearchParams();
  const shipmentId = searchParams.get("id"); // Single Shipment Mode
  const tripId = searchParams.get("tripId");

  const [trip, setTrip] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchManifestData = async () => {
      try {
        setLoading(true);
        let shipmentsData = [];
        let tripData = null;

        // MODE A: Single Shipment
        if (shipmentId) {
          const snap = await getDoc(doc(db, "shipments", shipmentId));
          if (snap.exists()) {
            shipmentsData.push({ id: snap.id, ...snap.data() });
          }
        }
        // MODE B: Bulk Trip Mode
        else if (tripId) {
          // Fetch Trip Data
          const tripSnap = await getDoc(doc(db, "truck_trips", tripId));
          if (tripSnap.exists()) {
            tripData = { id: tripSnap.id, ...tripSnap.data() };
          }

          // Fetch Shipments Data
          const q = query(
            collection(db, "shipments"),
            where("currentTripId", "==", tripData?.tripId || tripId),
          );
          const querySnapshot = await getDocs(q);

          querySnapshot.forEach((docSnap) => {
            shipmentsData.push({ id: docSnap.id, ...docSnap.data() });
          });

          // Fallback query matching currentTruckTripId if empty
          if (shipmentsData.length === 0) {
            const qAlternate = query(
              collection(db, "shipments"),
              where("currentTruckTripId", "==", tripData?.tripId || tripId),
            );
            const alternateSnap = await getDocs(qAlternate);
            alternateSnap.forEach((docSnap) => {
              shipmentsData.push({ id: docSnap.id, ...docSnap.data() });
            });
          }
        }

        setTrip(
          tripData || (tripId ? { tripId } : { tripId: shipmentId || "N/A" }),
        );
        setShipments(shipmentsData);
      } catch (err) {
        console.error("Error fetching manifest:", err);
      } finally {
        setLoading(false);
      }
    };

    if (shipmentId || tripId) fetchManifestData();
    else setLoading(false);
  }, [shipmentId, tripId]);

  if (loading) {
    return (
      <div className="p-10 text-center animate-pulse">Generating Label...</div>
    );
  }

  if (shipments.length === 0) {
    return (
      <div className="p-10 text-center text-red-500">No shipments found.</div>
    );
  }

  const tripLabel = trip?.tripId || trip?.id || "Trip";
  const driverName = trip?.driverName || trip?.driver?.name || "Unassigned";
  const truckPlate = trip?.truckPlate || trip?.truckPlateNumber || "—";
  const route =
    trip?.route ||
    (trip?.originCode || trip?.destinationCode
      ? `${trip?.originCode || trip?.origin || "—"} -> ${
          trip?.destinationCode || trip?.destination || "—"
        }`
      : "—");
  const departureDate = formatDate(
    trip?.plannedDeparture || trip?.departure || trip?.createdAt,
  );

  const totalQty = shipments.reduce(
    (sum, shipment) => sum + (Number(getShipmentQuantity(shipment)) || 0),
    0,
  );

  const shipmentPages = chunkShipments(shipments);

  return (
    <div className="bg-gray-100 min-h-screen p-8 print:p-0 print:bg-white text-black font-sans">
      <div className="max-w-5xl mx-auto mb-8 print:hidden text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">
          {tripId ? "Trip Labels" : "Shipment Labels"}
        </h1>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold shadow-xl hover:bg-blue-500 hover:scale-105 transition-all flex items-center gap-2 mx-auto"
        >
          <span>🖨️ Print Labels</span>
        </button>
      </div>

      <div className="flex flex-col items-center print:block">
        {shipmentPages.map((pageShipments, pageIndex) => (
          <div
            key={`page-${pageIndex}`}
            className="label-container mb-8 print:mb-0"
          >
            <div className="w-[4in] h-[6in] bg-white p-4 print:p-4 print:shadow-none shadow-lg border-2 border-black print:border-none box-border flex flex-col overflow-hidden">
              <div className="mb-4 border-b-2 border-black pb-2">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src="/atlas-logo.png"
                      alt="Atlas"
                      className="h-10 w-auto object-contain"
                    />
                    <h1 className="text-xl font-black uppercase tracking-wider leading-none">
                      {tripId ? "TRIP DETAILS" : "SHIPMENT DETAILS"}
                    </h1>
                  </div>
                  <div className="flex flex-col items-center justify-center border-2 border-black rounded p-1">
                    <QRCode
                      value={tripLabel}
                      size={50}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[9px]">
                  <div>
                    <p>
                      <span className="font-bold uppercase">Trip ID:</span>{" "}
                      {tripLabel}
                    </p>
                    <p>
                      <span className="font-bold uppercase">Driver:</span>{" "}
                      {driverName}
                    </p>
                    <p>
                      <span className="font-bold uppercase">Plate #:</span>{" "}
                      {truckPlate}
                    </p>
                  </div>
                  <div className="text-right">
                    <p>
                      <span className="font-bold uppercase">Route:</span>{" "}
                      {route}
                    </p>
                    <p>
                      <span className="font-bold uppercase">Departure:</span>{" "}
                      {departureDate}
                    </p>
                    <p>
                      <span className="font-bold uppercase">Generated At:</span>{" "}
                      {new Date().toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <table className="w-full text-left border-collapse text-[8px] leading-tight">
                <thead>
                  <tr className="border-b border-black bg-gray-50 print:bg-transparent">
                    <th className="py-1 pr-1 font-bold uppercase">ID</th>
                    <th className="py-1 px-1 font-bold uppercase">Sender</th>
                    <th className="py-1 px-1 font-bold uppercase">Recipient</th>
                    <th className="py-1 px-1 font-bold uppercase">Dest</th>
                    <th className="py-1 px-1 font-bold uppercase text-center">
                      Qty
                    </th>
                    <th className="py-1 px-1 font-bold uppercase">Status</th>
                    <th className="py-1 px-1 font-bold uppercase">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageShipments.map((shipment, index) => (
                    <tr
                      key={shipment.id || index}
                      className="border-b border-gray-200 align-top"
                    >
                      <td className="py-1 pr-1 font-mono tracking-tighter break-all">
                        {getShipmentDisplayId(shipment)}
                      </td>
                      <td className="py-1 px-1 break-words">
                        {shipment?.sender?.name || "—"}
                      </td>
                      <td className="py-1 px-1 break-words">
                        {shipment?.recipient?.name || "—"}
                      </td>
                      <td className="py-1 px-1 break-words">
                        {getDestination(shipment)}
                      </td>
                      <td className="py-1 px-1 text-center font-bold">
                        {getShipmentQuantity(shipment)}
                      </td>
                      <td className="py-1 px-1 break-words">
                        {shipment?.status || "—"}
                      </td>
                      <td className="py-1 px-1 text-gray-700 break-words">
                        {getShipmentDescription(shipment)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-auto border-t-4 border-black pt-2 flex justify-between items-end shrink-0">
                <div className="text-[10px] font-bold text-gray-500 uppercase">
                  {shipmentPages.length > 1
                    ? `Total Quantity (Page ${pageIndex + 1}/${shipmentPages.length})`
                    : "Total Quantity"}
                </div>
                <div className="text-3xl font-bold leading-none">
                  {totalQty} <span className="text-sm text-gray-400">PCS</span>
                </div>
              </div>
            </div>
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
