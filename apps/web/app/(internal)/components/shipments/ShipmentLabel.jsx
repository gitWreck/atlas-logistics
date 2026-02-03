import { faSnowflake, faWineGlass } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import QRCode from "react-qr-code";

export default function ShipmentLabel({ shipment, packages, index }) {
  if (!shipment) return null;

  return (
    <div
      className="w-[4in] h-[6in] bg-white border-2 border-black p-4 
  print:border-2 print:border-dashed print:border-black
  flex flex-col justify-between relative overflow-hidden box-border mx-auto shadow-2xl"
    >
      {/* HEADER */}
      <div className="border-b-4 border-black pb-2 mb-2">
        <div className="flex justify-between items-center">
          {/* LOGO */}
          <img
            src="/atlas-logo.png"
            alt="Atlas"
            className="h-8 w-auto object-contain"
          />

          {/* WEIGHT */}
          <div className="text-right">
            <div className="text-[10px] font-bold text-gray-500 uppercase">
              Weight
            </div>
            <div className="text-xl font-bold">{packages.weight} KG</div>
          </div>
        </div>

        {/* DESTINATION CODE (RESTORED, BALANCED) */}
        <div className="text-4xl font-extrabold tracking-tight uppercase leading-none mt-1 truncate">
          {shipment.destinationCode || "DEST"}
        </div>
      </div>

      {/* BODY */}
      <div className="my-2 flex-1 flex justify-between gap-3">
        {/* LEFT */}
        <div className="flex-1 flex flex-col justify-start">
          <div className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">
            Ship To:
          </div>

          <div className="text-lg font-bold uppercase leading-tight line-clamp-2">
            {shipment.recipient.name || "Unknown"}
          </div>
          <div className="text-sm font-mono mt-0.5">
            {shipment.recipient.phone}
          </div>

          <div className="text-sm leading-tight mt-2 font-medium uppercase text-gray-800">
            {shipment.recipient.address.unit
              ? `${shipment.recipient.address.unit}, `
              : ""}
            {shipment.recipient.address.street}
            <br />
            {shipment.recipient.address.barangay},{" "}
            {shipment.recipient.address.city}
            <br />
            {shipment.recipient.address.province}
          </div>

          {/* PACKAGE INFO */}
          <div className="mt-3 border-t-2 border-black pt-2 text-xs">
            <div className="font-bold uppercase text-gray-500">Package</div>
            <div className="font-semibold uppercase">
              {packages.description || "No Description"}
            </div>
            <div className="text-gray-600 uppercase">
              {packages.packagingType || "Standard Packaging"}
            </div>
          </div>
        </div>

        {/* RIGHT — ATTEMPTS (TIGHTER) */}
        <div className="w-[1in] flex flex-col">
          <div className="text-[10px] font-bold uppercase text-gray-500 mb-1">
            Attempts
          </div>

          {/* DELIVERY */}
          <div className="mb-3">
            <div className="text-[11px] font-bold uppercase mb-1">Delivery</div>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className="w-4 h-4 border-2 border-black text-[10px] flex items-center justify-center font-bold"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>

          {/* RETURN */}
          <div>
            <div className="text-[11px] font-bold uppercase mb-1">Return</div>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className="w-4 h-4 border-2 border-black text-[10px] flex items-center justify-center font-bold"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* QR CODE */}
      <div className="flex flex-col items-center justify-center border-4 border-black rounded-xl py-4 my-1">
        <QRCode value={packages.trackingNumber} size={110} level="M" />
        <div className="text-xs font-mono font-bold mt-2 tracking-widest text-center">
          {packages.trackingNumber || "NO ID"}
        </div>
      </div>

      {/* FOOTER */}
      <div className="border-t-4 border-black pt-2 flex justify-between items-end mt-2">
        <div>
          <div className="text-[10px] font-bold text-gray-500 uppercase">
            Origin
          </div>
          <div className="text-2xl font-bold uppercase text-gray-800">
            {shipment.originCode || "ORG"}
          </div>
        </div>

        <div className="flex gap-1">
          {packages.isFragile && <FontAwesomeIcon icon={faWineGlass} />}
          {packages.isPerishable && <FontAwesomeIcon icon={faSnowflake} />}
        </div>

        <div className="text-center">
          <div className="text-[10px] font-bold text-gray-500 uppercase">
            Box
          </div>
          <div className="text-3xl font-bold leading-none">
            {index + 1}
            <span className="text-lg text-gray-400 font-normal">/</span>
            {shipment.totals.totalItems || 1}
          </div>
        </div>
      </div>
    </div>
  );
}
