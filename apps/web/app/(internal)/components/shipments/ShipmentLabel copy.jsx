import React from "react";
import QRCode from "react-qr-code";

export default function ShipmentLabel({ shipment, packages }) {
  if (!shipment) return null;

  return (
    <div className="w-[3.5in] h-[6in] bg-white text-black p-4 flex flex-col font-sans border border-gray-300 mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2">
        <div className="font-bold text-2xl uppercase tracking-tighter">
          PRIORITY
        </div>
        <div className="text-right">
          <div className="text-xs font-bold text-gray-500">WEIGHT</div>
          <div className="text-xl font-bold">{packages.weight || "0.5"} KG</div>
        </div>
      </div>

      {/* FROM / TO */}
      <div className="text-xs mb-4 space-y-2">
        <div>
          <span className="font-bold text-gray-500 block text-[10px]">
            FROM:
          </span>
          <div className="font-bold">{shipment.sender.name}</div>
          <div>{shipment.origin || "Manila Hub"}</div>
        </div>
        <div>
          <span className="font-bold text-gray-500 block text-[10px]">TO:</span>
          <div className="font-bold text-lg">{shipment.recipient.name}</div>
          <div className="leading-tight">{shipment.destination}</div>
        </div>
      </div>

      {/* QR CODE (THE CORE) */}
      <div className="flex-1 flex flex-col items-center justify-center border-2 border-black rounded-lg py-4 mb-2">
        <QRCode
          value={packages.trackingNumber} // This is what the scanner reads
          size={128}
          level="M"
        />
        <div className="mt-2 font-mono font-bold text-sm tracking-widest">
          {packages.trackingNumber}
        </div>
      </div>

      {/* FOOTER */}
      <div className="grid grid-cols-3 text-center text-[10px] font-bold border-t border-black pt-2">
        <div>
          <div className="text-gray-500">ROUTE</div>
          <div className="text-lg">
            {shipment.originCode || "N/A"}
            {" -> "}
            {shipment.destinationCode || "N/A"}
          </div>
        </div>
        <div>
          <div className="text-gray-500">PCS</div>
          <div className="text-lg">1/{shipment.totalItems || 1}</div>
        </div>
        <div>
          <div className="text-gray-500">DATE</div>
          <div className="text-lg">{new Date().toLocaleDateString()}</div>
        </div>
      </div>
    </div>
  );
}
