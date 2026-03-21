import React from "react";

export default function ShipmentProofs({ shipment, isDark = false }) {
  // Ensure we treat them as arrays even if they are missing
  const proofOfDelivery = shipment?.proofOfDelivery || [];
  const proofOfReceipt = shipment?.proofOfReceipt || [];

  // If both arrays are empty, don't render the component
  if (proofOfDelivery.length === 0 && proofOfReceipt.length === 0) return null;

  const renderImage = (url, label) => (
    <div className="flex flex-col gap-1.5 shrink-0">
      <div
        className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border group ${isDark ? "border-slate-700" : "border-slate-300"}`}
      >
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt={label}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        </a>
      </div>
      <span className="text-[9px] font-bold text-center text-slate-500 uppercase tracking-tighter">
        {label}
      </span>
    </div>
  );

  return (
    <div
      className={`p-4 border rounded-xl space-y-3 ${isDark ? "bg-slate-900/30 border-slate-800/50" : "bg-white border-slate-200 shadow-sm"}`}
    >
      <h5
        className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}
      >
        Captured Proofs
      </h5>

      <div className="flex gap-4 items-start overflow-x-auto pb-2 custom-scrollbar">
        {/* Map through Delivery Array */}
        {proofOfDelivery.map((url, index) => (
          <React.Fragment key={`pod-${index}`}>
            {renderImage(
              url,
              `Delivery ${proofOfDelivery.length > 1 ? index + 1 : ""}`,
            )}
          </React.Fragment>
        ))}

        {/* Map through Receipt Array */}
        {proofOfReceipt.map((url, index) => (
          <React.Fragment key={`por-${index}`}>
            {renderImage(
              url,
              `Receipt ${proofOfReceipt.length > 1 ? index + 1 : ""}`,
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
