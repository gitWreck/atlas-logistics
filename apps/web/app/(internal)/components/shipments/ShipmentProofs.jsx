import React from "react";
import { formatFirestoreDate } from "@/app/utility/utilities";

const normalizeImages = (source) => {
  if (!source) return [];

  const values = Array.isArray(source) ? source : [source];

  return values
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") return item;

      return item.url || item.src || item.downloadURL || item.imageUrl || null;
    })
    .filter(Boolean);
};

const uniqueImages = (...sources) => {
  const seen = new Set();

  return sources.flatMap(normalizeImages).filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
};

const normalizeRemark = (value) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const getShipmentRemarks = (shipment) => {
  const remarks = [];
  const seen = new Set();

  const addRemark = (label, value, meta = "") => {
    const text = normalizeRemark(value);
    if (!text || seen.has(text)) return;

    remarks.push({ label, text, meta });
    seen.add(text);
  };

  addRemark("Shipment remarks", shipment?.remarks);
  addRemark("Handoff remarks", shipment?.handoffRemarks);
  addRemark("Missing remarks", shipment?.missingRemarks);

  (shipment?.statusHistory || []).forEach((event) => {
    const metaParts = [
      event.status?.replace(/_/g, " "),
      formatFirestoreDate(event.at),
    ].filter(Boolean);

    addRemark("Status note", event.note, metaParts.join(" / "));
  });

  return remarks;
};

export default function ShipmentProofs({ shipment, isDark = false }) {
  const proofGroups = [
    {
      label: "Receipt",
      images: uniqueImages(
        shipment?.proofOfReceipt,
        shipment?.receiptImages,
        shipment?.receiptPhotos,
      ),
    },
    {
      label: "Delivery",
      images: uniqueImages(
        shipment?.proofOfDelivery,
        shipment?.deliveryImages,
        shipment?.deliveryPhotos,
      ),
    },
  ].filter((group) => group.images.length > 0);

  const remarks = getShipmentRemarks(shipment);
  const hasProofs = proofGroups.length > 0;
  const hasRemarks = remarks.length > 0;

  if (!hasProofs && !hasRemarks) return null;

  const renderImage = (url, label) => (
    <div className="flex flex-col gap-1.5 shrink-0">
      <div
        className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border group ${
          isDark ? "border-slate-700" : "border-slate-300"
        }`}
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
      className={`p-4 border rounded-xl space-y-4 ${
        isDark
          ? "bg-slate-900/30 border-slate-800/50"
          : "bg-white border-slate-200 shadow-sm"
      }`}
    >
      <div>
        <h5
          className={`text-[10px] font-bold uppercase tracking-wider ${
            isDark ? "text-slate-500" : "text-slate-400"
          }`}
        >
          Captured Proofs
        </h5>

        {hasProofs ? (
          <div className="mt-3 space-y-4">
            {proofGroups.map((group) => (
              <div key={group.label}>
                <div
                  className={`mb-2 text-[10px] font-bold uppercase ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {group.label} ({group.images.length})
                </div>

                <div className="flex gap-4 items-start overflow-x-auto pb-2 custom-scrollbar">
                  {group.images.map((url, index) => (
                    <React.Fragment key={`${group.label}-${url}`}>
                      {renderImage(
                        url,
                        `${group.label} ${
                          group.images.length > 1 ? index + 1 : ""
                        }`,
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p
            className={`mt-3 text-xs italic ${
              isDark ? "text-slate-500" : "text-slate-500"
            }`}
          >
            No captured proof images yet.
          </p>
        )}
      </div>

      {hasRemarks && (
        <div
          className={`border-t pt-4 ${
            isDark ? "border-slate-800/70" : "border-slate-200"
          }`}
        >
          <h5
            className={`text-[10px] font-bold uppercase tracking-wider ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            Shipment Remarks
          </h5>

          <div className="mt-3 space-y-2">
            {remarks.map((remark, index) => (
              <div
                key={`${remark.label}-${index}`}
                className={`rounded-lg border p-3 ${
                  isDark
                    ? "bg-slate-950/50 border-slate-800 text-slate-300"
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase ${
                      isDark ? "text-slate-500" : "text-slate-500"
                    }`}
                  >
                    {remark.label}
                  </span>
                  {remark.meta && (
                    <span className="text-[10px] text-slate-500">
                      {remark.meta}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed">{remark.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
