import { faSnowflake, faWineGlass } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import QRCode from "react-qr-code";

export default function StandardLabel({ shipment, packages, index, total }) {
  const recipient = shipment.recipient || {};
  const address = recipient.address || {};
  const qrValue = packages?.trackingNumber || "NO_ID";

  console.log("Rendering label for package:", packages);

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
            <div className="text-xl font-bold">{packages.weight} KG</div>
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
            {address.unit ? `${address.unit}, ` : ""}
            {address.street}
            <br />
            {address.barangay}, {address.city}
            <br />
            {address.province}
          </div>

          {/* PACKAGE INFO */}
          <div className="mt-3 border-t pt-2 text-[10px]">
            {/* <div className="font-bold uppercase text-gray-500">
              Package Details
            </div>
            <div className="font-semibold uppercase">
              Description: {packages?.description || "No Description"}
            </div>
            <div className="text-gray-600 uppercase">
              Package Type: {packages?.packagingType || "Standard Packaging"}
            </div>
            <div className="text-gray-600 uppercase">
              Quantity: {packages?.quantity || 1}
            </div> */}
          </div>
        </div>

        {/* RIGHT: DELIVERY / RETURN ATTEMPTS */}
        <div className="w-[1.2in] flex flex-col justify-start text-[10px]">
          <div className="font-bold uppercase text-gray-500">
            Package Details
          </div>
          <div className="font-semibold uppercase">
            Description: {packages?.description || "No Description"}
          </div>
          <div className="text-gray-600 uppercase">
            Package Type: {packages?.packagingType || "Standard Packaging"}
          </div>
          <div className="text-gray-600 uppercase">
            Quantity: {packages?.quantity || 1}
          </div>
        </div>
      </div>

      {/* QR CODE - WITH SAFETY CHECK */}
      <div className="flex flex-col items-center justify-center border-4 border-black rounded-xl pt-3 pb-2 my-1">
        <QRCode value={qrValue} size={180} level="M" />
        <div className="text-xs font-mono font-bold mt-2 tracking-widest text-center">
          {packages?.trackingNumber || "NO ID"}
        </div>
        <div className="text-xs font-mono  mt-2 tracking-widest text-center">
          ATLAS TRACKING NUMBER
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
          {packages?.isFragile && (
            <span className="text-2xl" title="Fragile">
              <FontAwesomeIcon icon={faWineGlass} />
            </span>
          )}
          {packages?.isPerishable && (
            <span className="text-2xl" title="Perishable">
              <FontAwesomeIcon icon={faSnowflake} />
            </span>
          )}
        </div>

        <div className="text-center">
          <div className="text-[10px] font-bold text-gray-500 uppercase">
            {packages?.packagingType}
          </div>
          <div className="text-3xl font-bold leading-none">
            #{index + 1}
            {/* <span className="text-lg text-gray-400 font-normal">/</span>
            {total} */}
          </div>
        </div>
      </div>
    </div>
  );
}
