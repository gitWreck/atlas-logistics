"use client";
import React, { useEffect, useState } from "react";
import QRCode from "react-qr-code";

// export const dynamic = "force-dynamic"; // <--- Add this line
import { useSearchParams } from "next/navigation";

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function PrintLabelsClient() {
  const searchParams = useSearchParams();
  const shipmentId = searchParams.get("id");
  const [shipment, setShipment] = useState(null);

  useEffect(() => {
    if (!shipmentId) return;
    const fetchShipment = async () => {
      const snap = await getDoc(doc(db, "shipments", shipmentId));
      if (snap.exists()) setShipment({ id: snap.id, ...snap.data() });
    };
    fetchShipment();
  }, [shipmentId]);

  if (!shipment) return <div className="p-10">Loading Labels...</div>;

  console.log("shipments print: ", shipment);

  return (
    <div className="bg-gray-100 min-h-screen p-8 print:p-0 print:bg-white">
      {/* INSTRUCTIONS (Hidden when printing) */}
      <div className="max-w-md mx-auto mb-8 print:hidden text-center space-y-4">
        <h1 className="text-2xl font-bold">Print Packages</h1>
        <p className="text-sm text-gray-500">
          Found {shipment.packages?.length || 0} packages. Printer settings:{" "}
          <strong>4" x 6"</strong> or <strong>A4</strong>.
        </p>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-blue-500 transition-all"
        >
          Print Now
        </button>
      </div>

      {/* LABEL LIST */}
      <div className="flex flex-col items-center print:block">
        {(shipment.packages || []).map((pkg, index) => (
          <div
            key={pkg.trackingNumber}
            className="label-container mb-8 print:mb-0"
          >
            <StandardLabel shipment={shipment} pkg={pkg} index={index} />
            {/* Force page break after each label for thermal printers */}
            <div className="page-break" />
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: 4in 6in;
          } /* Standard Thermal Label Size */
          body {
            background: white;
          }
          .page-break {
            page-break-after: always;
          }
          .label-container {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

// THE LABEL COMPONENT (4x6 Design)
function StandardLabel({ shipment, pkg, index }) {
  return (
    <div className="w-[4in] h-[6in] bg-white border border-gray-300 p-4 flex flex-col justify-between font-sans text-black relative overflow-hidden box-border mx-auto print:border-none">
      {/* HEADER */}
      <div className="flex justify-between items-start border-b-2 border-black pb-2">
        <div className="text-4xl font-extrabold tracking-tighter uppercase">
          {shipment.destinationCode || "DEST"}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-gray-500 uppercase">
            Weight
          </div>
          <div className="text-xl font-bold">{pkg.weight} KG</div>
        </div>
      </div>

      {/* ROUTING INFO */}
      <div className="my-2">
        <div className="text-[10px] font-bold text-gray-500 uppercase">
          Ship To:
        </div>
        <div className="text-sm font-bold leading-tight">
          {shipment.recipient.name}
        </div>
        <div className="text-xs mt-1">{shipment.recipient.phone}</div>
        <div className="text-xs leading-tight mt-1">
          {/* ✅ FIX: Render specific fields */}
          {shipment.recipient.address.unit
            ? `${shipment.recipient.address.unit}, `
            : ""}
          {shipment.recipient.address.street},{" "}
          {shipment.recipient.address.barangay}
        </div>
        <div className="text-xs mt-1">
          {shipment.recipient.address.city},{" "}
          {shipment.recipient.address.province}
        </div>
        <div className="text-xs mt-1">{shipment.destinationCity}</div>
      </div>

      {/* QR CODE - THE MOST IMPORTANT PART */}
      <div className="flex-1 flex flex-col items-center justify-center border-2 border-black rounded-lg my-2 py-2">
        <QRCode value={pkg.trackingNumber} size={140} level="M" />
        <div className="text-sm font-mono font-bold mt-2 tracking-widest">
          {pkg.trackingNumber}
        </div>
      </div>

      {/* FOOTER */}
      <div className="border-t-2 border-black pt-2 flex justify-between items-end">
        <div>
          <div className="text-[10px] font-bold text-gray-500 uppercase">
            Origin
          </div>
          <div className="text-lg font-bold">
            {shipment.originCode || "ORG"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] font-bold text-gray-500 uppercase">
            Package
          </div>
          <div className="text-2xl font-bold">
            {index + 1} <span className="text-sm text-gray-400">of</span>{" "}
            {shipment.packages.length}
          </div>
        </div>
      </div>
    </div>
  );
}
