import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faTruckFast,
  faTruckRampBox,
  faCheckCircle,
  faExclamationTriangle,
  faCamera,
  faClock,
  faChevronDown,
  faChevronUp,
  faTimes,
  faExpand,
  faReceipt,
  faBox,
} from "@fortawesome/free-solid-svg-icons";

// Make sure you have this component created from the previous step!
import StatusBadge from "../ui/StatusBadge";
import { getVisualProgress } from "@/app/utility/utilities";

function formatDate(timestamp) {
  if (!timestamp) return "Just now";
  const date = timestamp.seconds
    ? new Date(timestamp.seconds * 1000)
    : new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// --- MAIN COMPONENT ---
export default function TrackingResult({ data }) {
  const {
    status,
    delayReason,
    delayCleared,
    totals,
    proofOfReceipt, // Can be string or array
    proofOfDelivery, // Can be string or array
    updatedAt,
  } = data;

  // --- 1. IMAGE LOGIC: COMBINE RECEIPT AND DELIVERY IMAGES ---
  const normalizeImages = (imgSource) => {
    if (!imgSource) return [];
    if (Array.isArray(imgSource)) return imgSource;
    return [imgSource];
  };

  const receiptImages = normalizeImages(proofOfReceipt);
  const deliveryImages = normalizeImages(proofOfDelivery);

  // Combined list for the gallery
  const allImages = [...receiptImages, ...deliveryImages];

  // State
  const [showImages, setShowImages] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  // Logic
  const safeStatus = (
    status === "Received at Warehouse" ? "RECEIVED" : status || ""
  )
    .toUpperCase()
    .replace(/ /g, "_");
  const currentProgress = getVisualProgress(safeStatus);
  const isDelayed = delayReason && !delayCleared;

  // Timeline Config
  const MILESTONES = [
    {
      val: 0,
      label: "Received",
      icon: faBoxOpen,
      color: "text-cyan-400",
      border: "border-cyan-500",
      bg: "bg-cyan-500",
    },
    {
      val: 33,
      label: "In Transit",
      icon: faTruckFast,
      color: "text-blue-400",
      border: "border-blue-500",
      bg: "bg-blue-500",
    },
    {
      val: 66,
      label: "Out for Delivery",
      icon: faTruckRampBox,
      color: "text-purple-400",
      border: "border-purple-500",
      bg: "bg-purple-500",
    },
    {
      val: 100,
      label: "Delivered",
      icon: faCheckCircle,
      color: "text-emerald-400",
      border: "border-emerald-500",
      bg: "bg-emerald-500",
    },
  ];

  let activeLineColor = "bg-blue-600";
  if (isDelayed) activeLineColor = "bg-amber-500";
  else if (safeStatus === "DELIVERED") activeLineColor = "bg-emerald-500";
  else if (safeStatus === "OUT_FOR_DELIVERY") activeLineColor = "bg-purple-500";
  else if (safeStatus === "RECEIVED") activeLineColor = "bg-cyan-500";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-900 rounded-b-3xl overflow-hidden flex flex-col h-full relative shadow-2xl">
      {/* --- A. HEADER SECTION (Mobile Stacked, Desktop Row) --- */}
      <div className="bg-slate-950/30 px-6 py-6 border-y border-slate-800 flex flex-col sm:flex-row justify-between items-start gap-6">
        {/* Left: Badge & Date */}
        <div className="w-full sm:w-auto">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">
            Current Status
          </div>

          <StatusBadge
            status={status}
            reason={isDelayed ? delayReason : null}
          />

          <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
            <FontAwesomeIcon icon={faClock} className="text-slate-600" />
            <span>Updated {formatDate(updatedAt)}</span>
          </div>
        </div>

        {/* Right: Route */}
        <div className="w-full sm:w-auto text-left sm:text-right border-t sm:border-0 border-slate-800/50 pt-4 sm:pt-0">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
            Route
          </div>
          <div className="text-xl font-bold text-white font-mono flex items-center sm:justify-end gap-2">
            <span>{data.originCode || "ORG"}</span>
            <span className="text-slate-600">&rarr;</span>
            <span>{data.destinationCode || "DST"}</span>
          </div>
          <div className="text-xs text-slate-600 font-mono mt-0.5 break-words">
            {data.origin} &rarr; {data.destination || "—"}
          </div>
        </div>
      </div>

      {/* --- B. DELAY BANNER --- */}
      {isDelayed && (
        <div className="bg-amber-500/10 border-b border-amber-500/10 px-6 py-3 flex items-start gap-3">
          <FontAwesomeIcon
            icon={faExclamationTriangle}
            className="text-amber-500 mt-0.5 text-sm shrink-0"
          />
          <div>
            <p className="text-amber-500 text-xs font-bold uppercase">
              Shipment Delayed
            </p>
            <p className="text-amber-200/80 text-xs">{delayReason}</p>
          </div>
        </div>
      )}

      {/* --- C. TIMELINE SECTION (Scrollable on Mobile) --- */}
      <div className="w-full overflow-x-auto no-scrollbar">
        <div className="px-10 pt-12 pb-16 min-w-[320px]">
          <div className="relative w-full">
            {/* 1. BACKGROUND TRACK */}
            <div className="absolute top-5 left-0 w-full h-1 bg-slate-800 rounded-full z-0" />

            {/* 2. ACTIVE PROGRESS LINE */}
            <div
              className={`absolute top-5 left-0 h-1 rounded-full transition-all duration-1000 z-0 ${activeLineColor}`}
              style={{ width: `${currentProgress}%` }}
            />

            {/* 3. MILESTONE DOTS */}
            <div className="flex justify-between w-full relative z-10">
              {MILESTONES.map((step) => {
                const isPast = step.val < currentProgress;
                const isActive = step.val === currentProgress;

                let dotStyle = "border-slate-700 bg-slate-900 text-slate-600";

                if (isActive) {
                  if (isDelayed) {
                    dotStyle =
                      "border-amber-500 bg-slate-900 text-amber-500 shadow-[0_0_15px_-5px_rgba(245,158,11,0.5)]";
                  } else {
                    dotStyle = `${step.border} bg-slate-900 ${step.color} shadow-[0_0_15px_-5px_rgba(255,255,255,0.2)]`;
                  }
                } else if (isPast) {
                  dotStyle = "border-blue-600 bg-slate-900 text-blue-600";
                }

                return (
                  <div
                    key={step.label}
                    className="flex flex-col items-center relative group w-10 shrink-0"
                  >
                    <div className="relative flex items-center justify-center w-10 h-10">
                      {isActive && !isDelayed && (
                        <span
                          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${step.bg}`}
                        />
                      )}
                      <div
                        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-500 relative z-10 ${dotStyle}`}
                      >
                        <FontAwesomeIcon
                          icon={
                            isActive && isDelayed
                              ? faExclamationTriangle
                              : step.icon
                          }
                          className="text-sm"
                        />
                      </div>
                    </div>

                    <div className="absolute top-12 w-32 text-center -left-11">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider block transition-colors duration-500 
                        ${isActive ? "text-white" : "text-slate-500"}
                        ${isActive && isDelayed ? "text-amber-500" : ""}
                      `}
                      >
                        {step.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* --- D. IMAGE SECTIONS --- */}
      <div className="border-t border-slate-800">
        {/* SECTION 1: PROOF OF RECEIPT */}
        {receiptImages.length > 0 && (
          <ImageGallery
            title="Proof of Receipt"
            count={receiptImages.length}
            images={receiptImages}
            icon={faBox} // or faReceipt
            onView={setLightboxSrc}
            defaultOpen={false}
          />
        )}

        {/* Separator if both exist */}
        {receiptImages.length > 0 && deliveryImages.length > 0 && (
          <div className="h-px bg-slate-800 mx-6" />
        )}

        {/* SECTION 2: PROOF OF DELIVERY */}
        {deliveryImages.length > 0 && (
          <ImageGallery
            title="Proof of Delivery"
            count={deliveryImages.length}
            images={deliveryImages}
            icon={faCamera}
            onView={setLightboxSrc}
            defaultOpen={true} // Auto-open delivery proof as it's usually more important
          />
        )}
      </div>

      {/* --- E. FOOTER STATS --- */}
      {totals && (
        <div className="mt-auto grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800 bg-slate-950/50">
          <StatBox label="Total Items" value={totals.totalItems || 0} />
          <StatBox
            label="Loaded"
            value={totals.loaded || 0}
            color="text-blue-400"
          />
          <StatBox
            label="Pending"
            value={(totals.totalItems || 0) - (totals.loaded || 0)}
            color="text-slate-500"
          />
        </div>
      )}

      {/* --- F. LIGHTBOX MODAL --- */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-6 right-6 text-slate-400 hover:text-white p-4"
          >
            <FontAwesomeIcon icon={faTimes} size="xl" />
          </button>

          <img
            src={lightboxSrc}
            alt="Full View"
            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// Stats Helper
function StatBox({ label, value, color = "text-white" }) {
  return (
    <div className="p-4 text-center group hover:bg-slate-900 transition-colors">
      <div className="text-[9px] text-slate-500 uppercase font-bold mb-1 group-hover:text-slate-400 transition-colors">
        {label}
      </div>
      <div className={`text-xl font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}

// --- REUSABLE IMAGE GALLERY COMPONENT ---
function ImageGallery({
  title,
  count,
  images,
  icon,
  onView,
  defaultOpen = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-colors">
            <FontAwesomeIcon icon={icon} className="text-xs" />
          </div>
          <span className="text-xs font-bold uppercase text-slate-400 group-hover:text-white transition-colors">
            {title} <span className="text-slate-600">({count})</span>
          </span>
        </div>
        <FontAwesomeIcon
          icon={isOpen ? faChevronUp : faChevronDown}
          className="text-slate-600 text-xs transition-transform duration-300"
        />
      </button>

      {/* Scrollable List */}
      {isOpen && (
        <div className="px-6 pb-6 pt-0 animate-in slide-in-from-top-2 duration-300">
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar snap-x">
            {images.map((src, idx) => (
              <div key={idx} className="snap-center shrink-0">
                <button
                  onClick={() => onView(src)}
                  className="w-24 h-24 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden relative group block hover:border-blue-500 transition-colors"
                >
                  <img
                    src={src}
                    alt={title}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <FontAwesomeIcon
                      icon={faExpand}
                      className="text-white drop-shadow-md"
                    />
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
