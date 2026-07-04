import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExclamationTriangle,
  faCamera,
  faClock,
  faChevronDown,
  faChevronUp,
  faTimes,
  faExpand,
  faBox,
} from "@fortawesome/free-solid-svg-icons";

// Make sure you have this component created from the previous step!
import StatusBadge from "../ui/StatusBadge";
import { getVisualProgress } from "@/app/utility/utilities";
import {
  buildPublicTrackingMilestones,
  getMilestoneStepState,
} from "@/app/utility/publicTrackingMilestones";
import { resolvePublicTrackingMiddleStat, resolvePublicTrackingDisplayStatus, resolvePublicTrackingStatusCode } from "@/app/utility/publicTrackingStats";

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

function isInTransitHistoryEntry(entry) {
  const code = String(entry?.statusCode || entry?.status || "")
    .toUpperCase()
    .replace(/\s+/g, "_");
  return code === "IN_TRANSIT";
}

function dedupePublicHistory(history = []) {
  let keptInTransit = false;

  return history.filter((entry) => {
    if (!isInTransitHistoryEntry(entry)) return true;
    if (keptInTransit) return false;
    keptInTransit = true;
    return true;
  });
}

function getEstimatedArrival(data) {
  return (
    data?.estimatedArrival ||
    data?.eta ||
    data?.estimatedArrivalAt ||
    data?.arrivalEstimate ||
    data?.truckDetails?.estimatedArrival ||
    data?.truckDetails?.eta ||
    null
  );
}

function sanitizePublicTrackingNote(note) {
  if (!note || typeof note !== "string") return note;
  return note.replace(/Assigned to:\s*[^•]+/gi, "Assigned to checker").trim();
}

function hasPublicCheckerAssignment(data = {}) {
  return Boolean(data.assignedToChecker || data.assignedCheckerName);
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

  // Logic — prefer statusCode over formatted status (formatStatus used to fall back to RECEIVED)
  const trackingStatusCode = resolvePublicTrackingStatusCode(data);
  const displayStatus = resolvePublicTrackingDisplayStatus(data);
  const currentProgress = getVisualProgress(trackingStatusCode);
  const isDelayed = delayReason && !delayCleared;
  const estimatedArrival = getEstimatedArrival(data);
  const MILESTONES = buildPublicTrackingMilestones(data);
  const middleStat = resolvePublicTrackingMiddleStat(data);

  let activeLineColor = "bg-blue-600";
  if (isDelayed) activeLineColor = "bg-amber-500";
  else if (trackingStatusCode === "DELIVERED" || trackingStatusCode === "COMPLETED")
    activeLineColor = "bg-emerald-500";
  else if (
    [
      "ARRIVED",
      "PARTIALLY_ARRIVED",
      "AVAILABLE_FOR_DELIVERY",
      "PARTIALLY_AVAILABLE_FOR_DELIVERY",
      "READY_FOR_DELIVERY",
      "AVAILABLE_AT_WAREHOUSE",
      "AVAILABLE_AT_ODIONGAN_WAREHOUSE",
      "ARRIVED_AT_ODIONGAN",
      "RELEASED_FOR_DELIVERY",
    ].includes(trackingStatusCode)
  )
    activeLineColor = "bg-sky-500";
  else if (trackingStatusCode === "OUT_FOR_DELIVERY") activeLineColor = "bg-purple-500";
  else if (trackingStatusCode === "PARTIALLY_DELIVERED") activeLineColor = "bg-teal-500";
  else if (
    trackingStatusCode === "RECEIVED" ||
    trackingStatusCode === "RECEIVED_AT_DIVISORIA"
  )
    activeLineColor = "bg-cyan-500";

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white rounded-b-3xl overflow-hidden flex flex-col h-full relative shadow-2xl shadow-slate-200/70">
      {/* --- A. HEADER SECTION (Mobile Stacked, Desktop Row) --- */}
      <div className="bg-slate-50 px-6 py-6 border-y border-slate-200 flex flex-col sm:flex-row justify-between items-start gap-6">
        {/* Left: Badge & Date */}
        <div className="w-full sm:w-auto">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">
            Current Status
          </div>

          <StatusBadge
            status={displayStatus}
            reason={isDelayed ? delayReason : null}
          />

          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
            <FontAwesomeIcon icon={faClock} className="text-slate-400" />
            <span>Updated {formatDate(updatedAt)}</span>
          </div>
        </div>

        {/* Right: Route */}
        <div className="w-full sm:w-auto text-left sm:text-right border-t sm:border-0 border-slate-200 pt-4 sm:pt-0">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
            Route
          </div>
          <div className="text-xl font-bold text-slate-950 font-mono flex items-center sm:justify-end gap-2">
            <span>{data.originCode || "ORG"}</span>
            <span className="text-slate-400">&rarr;</span>
            <span>{data.destinationCode || "DST"}</span>
          </div>
          <div className="text-xs text-slate-500 font-mono mt-0.5 break-words">
            {data.origin} &rarr; {data.destination || "—"}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 sm:justify-end">
            <FontAwesomeIcon icon={faClock} className="text-slate-400" />
            <span>
              Estimated arrival:{" "}
              <span className="font-semibold text-slate-700">
                {estimatedArrival ? formatDate(estimatedArrival) : "TBA"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* --- B. DELAY BANNER --- */}
      {isDelayed && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-start gap-3">
          <FontAwesomeIcon
            icon={faExclamationTriangle}
            className="text-amber-600 mt-0.5 text-sm shrink-0"
          />
          <div>
            <p className="text-amber-700 text-xs font-bold uppercase">
              Shipment Delayed
            </p>
            <p className="text-amber-700/80 text-xs">{delayReason}</p>
          </div>
        </div>
      )}

      {/* --- C. LAST-MILE CONTEXT --- */}
      {(hasPublicCheckerAssignment(data) || data.deliveryVehicleName) && (
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-2">
            Delivery details
          </div>
          <div className="space-y-1 text-sm text-slate-700">
            {hasPublicCheckerAssignment(data) && (
              <p>
                <span className="font-semibold">Assigned to:</span> checker
              </p>
            )}
            {data.deliveryVehicleName && (
              <p>
                <span className="font-semibold">Vehicle:</span>{" "}
                {data.deliveryVehicleName}
              </p>
            )}
          </div>
        </div>
      )}

      {/* --- D. TIMELINE SECTION (vertical — fits narrow card, shows all 5 steps) --- */}
      <div className="w-full border-b border-slate-200 px-4 py-8 sm:px-6">
        <div className="relative">
          {MILESTONES.map((step, index) => {
            const { isPast, isActive } = getMilestoneStepState(
              currentProgress,
              index,
              MILESTONES,
            );
            const isLast = index === MILESTONES.length - 1;

            let dotStyle = "border-slate-300 bg-white text-slate-400";

            if (isActive) {
              dotStyle = isDelayed
                ? "border-amber-500 bg-white text-amber-600 shadow-[0_0_0_4px_rgba(245,158,11,0.12)]"
                : `${step.border} bg-white ${step.color.replace("400", "600")} shadow-[0_0_0_4px_rgba(59,130,246,0.10)]`;
            } else if (isPast) {
              dotStyle = "border-blue-600 bg-white text-blue-600";
            }

            return (
              <div
                key={`${step.val}-${step.label}`}
                className="relative flex gap-3 pb-5 last:pb-0"
              >
                <div className="relative flex w-9 shrink-0 justify-center">
                  {!isLast && (
                    <div className="absolute left-1/2 top-9 bottom-0 w-1 -translate-x-1/2 rounded-full bg-slate-200" />
                  )}
                  {!isLast && isPast && (
                    <div
                      className={`absolute left-1/2 top-9 bottom-0 w-1 -translate-x-1/2 rounded-full ${activeLineColor}`}
                    />
                  )}
                  <div className="relative flex items-center justify-center w-9 h-9">
                    {isActive && !isDelayed && (
                      <span
                        className={`absolute inline-flex h-full w-full rounded-full opacity-20 animate-ping ${step.bg}`}
                      />
                    )}
                    <div
                      className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-500 relative z-10 ${dotStyle}`}
                    >
                      <FontAwesomeIcon
                        icon={
                          isActive && isDelayed
                            ? faExclamationTriangle
                            : step.icon
                        }
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <div
                    className={`text-sm font-bold leading-snug transition-colors duration-500 ${
                      isActive
                        ? isDelayed
                          ? "text-amber-700"
                          : "text-slate-950"
                        : isPast
                          ? "text-blue-700"
                          : "text-slate-500"
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {isActive
                      ? isDelayed
                        ? "Attention required"
                        : "Current stage"
                      : isPast
                        ? "Completed"
                        : "Pending"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- E. ACTIVITY LOG --- */}
      {Array.isArray(data.history) && data.history.length > 0 && (
        <div className="border-t border-slate-200 px-6 py-5">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-3">
            Tracking activity
          </div>
          <div className="space-y-3">
            {dedupePublicHistory(data.history).slice(0, 8).map((entry, index) => (
              <div
                key={`${entry.date}-${entry.title || entry.status}-${index}`}
                className="border border-slate-200 rounded-xl p-3 bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {entry.title || entry.status}
                    </p>
                    {entry.note && !isInTransitHistoryEntry(entry) && (
                      <p className="text-xs text-slate-600 mt-1">
                        {sanitizePublicTrackingNote(entry.note)}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 shrink-0">
                    {formatDate(entry.date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- F. IMAGE SECTIONS --- */}
      <div className="border-t border-slate-200">
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
          <div className="h-px bg-slate-200 mx-6" />
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

      {/* --- G. FOOTER STATS --- */}
      {totals && (
        <div className="mt-auto grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 bg-slate-50">
          <StatBox label="Total Items" value={totals.totalItems || 0} />
          <StatBox
            label={middleStat.label}
            value={middleStat.value}
            color={middleStat.color}
          />
          <StatBox
            label="Pending"
            value={totals.pending ?? 0}
            color="text-slate-600"
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
function StatBox({ label, value, color = "text-slate-950" }) {
  return (
    <div className="p-4 text-center group hover:bg-white transition-colors">
      <div className="text-[9px] text-slate-500 uppercase font-bold mb-1 group-hover:text-slate-700 transition-colors">
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
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-blue-700 group-hover:bg-blue-50 transition-colors">
            <FontAwesomeIcon icon={icon} className="text-xs" />
          </div>
          <span className="text-xs font-bold uppercase text-slate-600 group-hover:text-slate-950 transition-colors">
            {title} <span className="text-slate-400">({count})</span>
          </span>
        </div>
        <FontAwesomeIcon
          icon={isOpen ? faChevronUp : faChevronDown}
          className="text-slate-400 text-xs transition-transform duration-300"
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
                  className="w-24 h-24 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative group block hover:border-blue-500 transition-colors"
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
