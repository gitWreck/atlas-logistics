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
  flex flex-col justify-between relative overflow-hidden box-border mx-auto shadow-2xl text-black"
      /* ✅ ADDED 'text-black' to the parent container */
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
            <div className="text-[10px] font-bold text-gray-600 uppercase">
              {" "}
              {/* ✅ Darker gray */}
              {/* Count */}
            </div>
            <div className="text-xl font-bold text-black">
              {/* {packages.weight} KG */}
            </div>{" "}
            {/* ✅ Explicit black */}
          </div>
        </div>

        {/* DESTINATION CODE */}
        <div className="text-m font-extrabold tracking-tight uppercase leading-none mt-1 truncate text-black">
          {shipment.destinationCode || "DEST"}
        </div>
      </div>

      {/* BODY */}
      <div className="my-2 flex-1 flex justify-between gap-3">
        {/* LEFT */}
        <div className="flex-1 flex flex-col justify-start">
          <div className="text-[10px] font-bold text-gray-600 uppercase mb-0.5">
            Ship To:
          </div>

          <div className="text-lg font-bold uppercase leading-tight line-clamp-2 text-black">
            {shipment.recipient.name || "Unknown"}
          </div>
          <div className="text-sm font-mono mt-0.5 text-black">
            {shipment.recipient.phone}
          </div>

          <div className="text-[10px] leading-tight mt-2 font-medium uppercase text-gray-900">
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
          <div className="mt-3 border-t-2 border-black pt-2 text-[10px]">
            <div className="font-bold uppercase text-gray-600">Package</div>
            <div className="font-semibold uppercase text-black">
              {packages.description || "No Description"}
            </div>
            <div className="text-gray-800 uppercase">
              {packages.packagingType || "Standard Packaging"}
            </div>
          </div>
        </div>

        {/* RIGHT — ATTEMPTS */}
        <div className="w-[1in] flex flex-col">
          <div className="text-[10px] font-bold uppercase text-gray-600 mb-1">
            Attempts
          </div>

          {/* DELIVERY */}
          <div className="mb-3">
            <div className="text-[11px] font-bold uppercase mb-1 text-black">
              Delivery
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className="w-4 h-4 border-2 border-black text-black text-[10px] flex items-center justify-center font-bold"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>

          {/* RETURN */}
          <div>
            <div className="text-[11px] font-bold uppercase mb-1 text-black">
              Return
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className="w-4 h-4 border-2 border-black text-black text-[10px] flex items-center justify-center font-bold"
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
        <div className="text-xs font-mono font-bold mt-2 tracking-widest text-center text-black">
          {packages.trackingNumber || "NO ID"}
        </div>
      </div>

      {/* FOOTER */}
      <div className="border-t-4 border-black pt-2 flex justify-between items-end mt-2">
        <div>
          <div className="text-[10px] font-bold text-gray-600 uppercase">
            Origin
          </div>
          <div className="text-2xl font-bold uppercase text-gray-900">
            {shipment.originCode || "ORG"}
          </div>
        </div>

        <div className="flex gap-1 text-black">
          {packages.isFragile && <FontAwesomeIcon icon={faWineGlass} />}
          {packages.isPerishable && <FontAwesomeIcon icon={faSnowflake} />}
        </div>

        <div className="text-center">
          <div className="text-[10px] font-bold text-gray-600 uppercase">
            Box
          </div>
          <div className="text-3xl font-bold leading-none text-black">
            {index + 1}
            <span className="text-lg text-gray-500 font-normal">/</span>
            {shipment.totals.totalItems || 1}
          </div>
        </div>
      </div>
    </div>
  );
}
