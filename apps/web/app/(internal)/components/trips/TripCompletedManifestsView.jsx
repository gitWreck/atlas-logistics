"use client";

import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faTruck,
  faBoxOpen,
  faLock,
  faClipboardList,
  faDownload,
  faPrint,
  faEye,
  faLink,
  faArchive,
  faMinusCircle,
} from "@fortawesome/free-solid-svg-icons";
import QRCode from "react-qr-code";
import TripAuditLogModal from "./TripAuditLogModal";
import TripCustodyTimelineModal from "./TripCustodyTimelineModal";
import { getDrawerThemeClasses } from "@/app/utility/constant/theme";
import { archiveTruckTrip } from "@/app/utility/FirebaseFunctions";
import { canArchiveTrip, canManageTripLifecycle } from "@/app/utility/tripLifecycle";
import TripReasonConfirmModal from "./TripReasonConfirmModal";

function compactActionButtonClass(theme, { inline = false } = {}) {
  return [
    theme.secondaryActionButton,
    "!py-2 px-3 !text-xs",
    inline ? "!flex-none shrink-0 whitespace-nowrap" : "flex-1 justify-center",
  ].join(" ");
}

function ManifestActionButton({ label, icon, onClick, theme, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
          : compactActionButtonClass(theme)
      }
    >
      <FontAwesomeIcon icon={icon} className="w-3 h-3" />
      {label}
    </button>
  );
}

function HashBlock({ hash, isDark }) {
  if (!hash) return null;
  return (
    <p
      className={`text-[10px] font-mono break-all leading-relaxed ${
        isDark ? "text-slate-500" : "text-slate-500"
      }`}
    >
      {hash}
    </p>
  );
}

function ManifestDocumentCard({
  index,
  manifest,
  isDark,
  theme,
  onView,
}) {
  const isShipping = manifest.type === "SHIPPING";
  const Icon = isShipping ? faTruck : faBoxOpen;
  const accent = isShipping ? "text-blue-500" : "text-emerald-500";
  const borderAccent = isShipping ? "border-blue-500/20" : "border-emerald-500/20";
  const bgAccent = isShipping ? "bg-blue-500/5" : "bg-emerald-500/5";

  const handlePrint = () => {
    if (manifest.printPath) {
      window.open(manifest.printPath, "_blank");
    }
  };

  const handleDownload = () => {
    handlePrint();
    window.print();
  };

  return (
    <div
      className={`rounded-xl border ${borderAccent} ${bgAccent} overflow-hidden ${
        isDark ? "bg-slate-900/40" : "bg-white"
      }`}
    >
      <div className="p-4 border-b border-inherit">
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isShipping ? "bg-blue-500/10" : "bg-emerald-500/10"
            }`}
          >
            <FontAwesomeIcon icon={Icon} className={accent} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-50">
              {index}. {manifest.title}
            </p>
            <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {manifest.description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
              isShipping
                ? "bg-blue-500/10 text-blue-600"
                : "bg-emerald-500/10 text-emerald-600"
            }`}
          >
            <FontAwesomeIcon icon={isShipping ? faLock : faCheckCircle} />
            Status: {manifest.status}
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-slate-500/10 opacity-70">
            Version: {manifest.version}
          </span>
        </div>

        <p className={`text-[11px] mt-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          {isShipping ? (
            <>
              Created on <strong>{manifest.createdAt || "—"}</strong>
              {manifest.createdByName ? (
                <>
                  {" "}
                  by <strong>{manifest.createdByName}</strong>
                  {manifest.createdByRole ? ` (${manifest.createdByRole})` : ""}
                </>
              ) : null}
            </>
          ) : (
            <>
              Completed on <strong>{manifest.completedAt || "—"}</strong>
              {manifest.completedByName ? (
                <>
                  {" "}
                  by <strong>{manifest.completedByName}</strong>
                  {manifest.completedByRole ? ` (${manifest.completedByRole})` : ""}
                </>
              ) : null}
            </>
          )}
        </p>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-2">
            {isShipping ? "Manifest Summary" : "Delivery Summary"}
          </p>
          <div className={`text-xs space-y-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
            {isShipping ? (
              <>
                <p>
                  <span className="opacity-60">Origin:</span> {manifest.summary.origin}
                </p>
                <p>
                  <span className="opacity-60">Destination:</span>{" "}
                  {manifest.summary.destination}
                </p>
                <p>
                  <span className="opacity-60">Total Shipments:</span>{" "}
                  {manifest.summary.totalShipments}
                </p>
                <p>
                  <span className="opacity-60">Total Packages Loaded:</span>{" "}
                  <strong>{manifest.summary.totalPackagesLoaded}</strong>
                </p>
                <p>
                  <span className="opacity-60">Route:</span> {manifest.summary.route}
                </p>
              </>
            ) : (
              <>
                <p>
                  <span className="opacity-60">Total Packages Received:</span>{" "}
                  {manifest.summary.totalPackagesReceived}
                </p>
                <p>
                  <span className="opacity-60">Total Delivered:</span>{" "}
                  <strong className="text-emerald-600">
                    {manifest.summary.totalDelivered}
                  </strong>
                </p>
                <p>
                  <span className="opacity-60">Failed Delivery:</span>{" "}
                  <strong className="text-orange-500">
                    {manifest.summary.totalFailedDelivery}
                  </strong>
                </p>
                <p>
                  <span className="opacity-60">Returned to Warehouse:</span>{" "}
                  <strong className="text-orange-500">
                    {manifest.summary.totalReturnedToWarehouse}
                  </strong>
                </p>
                <p>
                  <span className="opacity-60">POD Captured:</span>{" "}
                  {manifest.summary.podCaptured} ({manifest.summary.podPercent})
                </p>
                <p>
                  <span className="opacity-60">Delivery Hub:</span>{" "}
                  {manifest.summary.deliveryHub}
                </p>
              </>
            )}
          </div>
        </div>

        {manifest.verifyUrl && (
          <div className="flex flex-col items-center gap-2">
            <div className="bg-white p-2 rounded-lg border border-slate-200">
              <QRCode value={manifest.verifyUrl} size={72} />
            </div>
            <p className="text-[9px] text-center opacity-60 max-w-[120px] break-all">
              <FontAwesomeIcon icon={faLink} className="mr-1" />
              {manifest.verifyUrl}
            </p>
          </div>
        )}
      </div>

      {manifest.hash && (
        <div className="px-4 pb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1">
            Digital Hash
          </p>
          <HashBlock hash={manifest.hash} isDark={isDark} />
        </div>
      )}

      <div className="p-4 pt-0 flex gap-2">
        <ManifestActionButton
          label="View"
          icon={faEye}
          onClick={onView || handlePrint}
          theme={theme}
        />
        <ManifestActionButton
          label="Print"
          icon={faPrint}
          onClick={handlePrint}
          theme={theme}
        />
        <ManifestActionButton
          label="Download PDF"
          icon={faDownload}
          onClick={handleDownload}
          theme={theme}
        />
      </div>
    </div>
  );
}

function CustodyMilestone({ milestone, isLast, isDark }) {
  return (
    <div className="flex flex-col items-center min-w-[88px] flex-1">
      <div className="flex items-center w-full">
        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
            milestone ? "bg-emerald-500" : isDark ? "bg-slate-700" : "bg-slate-200"
          }`}
        >
          {milestone ? (
            <FontAwesomeIcon icon={faCheckCircle} className="text-white text-[10px]" />
          ) : null}
        </div>
        {!isLast && (
          <div
            className={`h-0.5 flex-1 ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
          />
        )}
      </div>
      <p
        className={`text-[10px] font-bold text-center mt-2 leading-tight ${
          isDark ? "text-slate-200" : "text-slate-800"
        }`}
      >
        {milestone?.label || "—"}
      </p>
      {milestone?.displayAt && (
        <p className="text-[9px] text-center opacity-60 mt-0.5">{milestone.displayAt}</p>
      )}
      {milestone?.actorName && (
        <p className="text-[9px] text-center opacity-50">{milestone.actorName}</p>
      )}
    </div>
  );
}

export default function TripCompletedManifestsView({
  trip,
  shipments = [],
  onUnassign,
  user,
  profile,
  isDark = false,
  onRefresh,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [custodyOpen, setCustodyOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const theme = getDrawerThemeClasses(isDark);
  const tripDocId = trip?.id || trip?.tripId;
  const canArchive = canManageTripLifecycle(profile, user) && canArchiveTrip(trip);
  const canCorrectShipments =
    String(profile?.role || "").toLowerCase() === "admin";

  useEffect(() => {
    if (!tripDocId || !user) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/trips/${tripDocId}/trip-manifests`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load manifests");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load manifests");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tripDocId, user]);

  const handleExportAll = async () => {
    if (!tripDocId || !user) return;
    setExporting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/trips/${tripDocId}/export-manifests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${data?.tripCode || tripDocId}-manifests.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className={`text-sm ${theme.mutedText} animate-pulse`}>
        Loading manifests...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
        {error}
      </div>
    );
  }

  const completion = data?.completion || {};
  const shipping = data?.manifests?.shipping;
  const delivery = data?.manifests?.delivery;
  const custodySummary = data?.custodySummary || [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
          <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-500 text-lg" />
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-600">TRIP COMPLETED</p>
          <p className={`text-xs mt-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
            This trip was completed on{" "}
            <strong>{completion.completedAt || "—"}</strong>.{" "}
            {completion.message ||
              "All deliveries are completed and finalized. Both manifests are available for audit and printing."}
          </p>
          <div className={`flex flex-wrap gap-4 mt-2 text-[11px] ${theme.mutedText}`}>
            <span>
              <strong>Completed At:</strong> {completion.completedAt || "—"}
            </span>
            <span>
              <strong>Completed By:</strong> {completion.completedByName || "—"}
            </span>
            <span>
              <strong>Location:</strong> {completion.location || "—"}
            </span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1">
          Manifests
        </p>
        <p className={`text-xs mb-4 ${theme.mutedText}`}>
          Two official manifests are available for this trip.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {shipping?.available && (
            <ManifestDocumentCard
              index={1}
              manifest={shipping}
              isDark={isDark}
              theme={theme}
            />
          )}
          {delivery?.available && (
            <ManifestDocumentCard
              index={2}
              manifest={delivery}
              isDark={isDark}
              theme={theme}
            />
          )}
        </div>
      </div>

      {canCorrectShipments && shipments.length > 0 && (
        <div className={`rounded-xl border p-4 ${theme.footerPanel}`}>
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-50">
              Shipment corrections
            </p>
            <p className={`text-xs mt-1 ${theme.mutedText}`}>
              Removing a shipment keeps the sealed manifests for audit and
              returns its linked pieces to Received at Divisoria.
            </p>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {shipments.map((shipment) => (
              <div
                key={shipment.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                  isDark
                    ? "border-slate-700 bg-slate-900/40"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-semibold truncate">
                    {shipment.shipmentId || shipment.id}
                  </p>
                  <p className={`text-[10px] ${theme.mutedText}`}>
                    {shipment.status || "Unknown status"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUnassign?.(shipment)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/20"
                  title="Remove shipment and reset linked pieces to Divisoria"
                >
                  <FontAwesomeIcon icon={faMinusCircle} />
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`rounded-xl border p-4 ${theme.footerPanel}`}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-50">
              Chain of Custody Summary
            </p>
            <p className={`text-xs ${theme.mutedText}`}>
              End-to-end visibility of this trip.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCustodyOpen(true)}
            className={compactActionButtonClass(theme, { inline: true })}
          >
            View Full Timeline
          </button>
        </div>

        <div className="overflow-x-auto pb-2 px-4">
          <div className="flex min-w-[720px]">
            {custodySummary.map((milestone, index) => (
              <CustodyMilestone
                key={milestone.key}
                milestone={milestone}
                isLast={index === custodySummary.length - 1}
                isDark={isDark}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={`rounded-xl border p-4 ${theme.footerPanel}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-50">
              Audit & Activity Log
            </p>
            <p className={`text-xs ${theme.mutedText}`}>
              View all actions and changes made during this trip.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAuditOpen(true)}
            className={compactActionButtonClass(theme, { inline: true })}
          >
            <FontAwesomeIcon icon={faClipboardList} />
            View Audit Log
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 px-1">
        {canArchive && (
          <button
            type="button"
            onClick={() => setArchiveOpen(true)}
            className={`${compactActionButtonClass(theme)} !flex-none`}
          >
            <FontAwesomeIcon icon={faArchive} />
            Archive Trip
          </button>
        )}
        <button
          type="button"
          onClick={handleExportAll}
          disabled={exporting}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shrink-0 ml-auto"
        >
          <FontAwesomeIcon icon={faDownload} />
          {exporting ? "Exporting..." : "Export All Manifests"}
        </button>
      </div>

      <TripAuditLogModal
        isOpen={auditOpen}
        onClose={() => setAuditOpen(false)}
        trip={trip}
        isDark={isDark}
      />

      <TripCustodyTimelineModal
        isOpen={custodyOpen}
        onClose={() => setCustodyOpen(false)}
        trip={trip}
        milestones={custodySummary}
        isDark={isDark}
        user={user}
      />

      <TripReasonConfirmModal
        isOpen={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive Trip"
        entityLabel={trip?.tripId || tripDocId}
        description={`Archive ${trip?.tripId || tripDocId}? The record is kept for audit but hidden from the active board.`}
        confirmLabel="Archive Trip"
        confirmVariant="red"
        isDark={isDark}
        onConfirm={async (reason) => {
          await archiveTruckTrip({ tripId: tripDocId, reason });
          setArchiveOpen(false);
          onRefresh?.();
        }}
      />
    </div>
  );
}
