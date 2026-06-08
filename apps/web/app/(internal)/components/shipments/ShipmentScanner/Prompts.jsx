"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruckRampBox,
  faCheck,
  faLock,
  faUnlock,
  faTriangleExclamation,
  faTruck,
  faBoxOpen,
  faChevronDown,
  faChevronUp,
} from "@fortawesome/free-solid-svg-icons";
import StatusButton from "../../ui/StatusButton"; // Adjust path

export function InterceptorPrompt({
  theme,
  icon,
  iconColor,
  title,
  description,
  children,
}) {
  return (
    <div
      className={`rounded-xl border p-6 text-center space-y-4 ${theme.panelSurface}`}
    >
      <div className={`${iconColor} mb-2`}>
        <FontAwesomeIcon icon={icon} size="3x" />
      </div>
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-sm opacity-80 mb-4">{description}</p>
      {children}
    </div>
  );
}

export function NextTripPrompt({
  theme,
  item,
  onAssign,
  onSkip,
  btnStatus,
}) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faTruckRampBox}
      iconColor="text-blue-500"
      title="Unload Successful!"
      description={`Shipment ${item.shipmentId} received at warehouse. Release for checker delivery operations now?`}
    >
      <div className="space-y-2">
        <StatusButton
          status={btnStatus}
          label="Release shipment"
          loadingLabel="Releasing..."
          successLabel="Released"
          icon={faCheck}
          variant="blue"
          onClick={onAssign}
        />
        <button onClick={onSkip} className="text-xs opacity-60 underline mt-2">
          Skip (leave in warehouse)
        </button>
      </div>
    </InterceptorPrompt>
  );
}

function formatReconciliationTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function resolvePieceTotals(summary = {}) {
  const totals = summary.totals || {};
  const manifestPieces = Number(totals.manifestPieces) || 0;
  const unloadedPieces = Number(totals.unloadedPieces) || 0;
  const missingPieces =
    Number.isFinite(Number(totals.missingPieces)) &&
    Number(totals.missingPieces) >= 0
      ? Number(totals.missingPieces)
      : Math.max(manifestPieces - unloadedPieces, 0);

  return { manifestPieces, unloadedPieces, missingPieces };
}

function ReconciliationMetricCard({
  label,
  value,
  subtext,
  icon,
  accentClass,
  theme,
}) {
  return (
    <div className={`rounded-xl border p-3 text-left ${theme.panelSurface}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase opacity-50">
            {label}
          </div>
          <div className="mt-1 text-2xl font-bold leading-none">{value}</div>
          <div className="text-[10px] opacity-50 mt-1">packages</div>
        </div>
        <div className={`shrink-0 text-lg ${accentClass}`}>
          <FontAwesomeIcon icon={icon} />
        </div>
      </div>
      {subtext ? (
        <p className="mt-2 text-[10px] leading-snug opacity-60">{subtext}</p>
      ) : null}
    </div>
  );
}

function ReadyShipmentRow({ item, theme, defaultExpanded = true }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const totalLabels = Number(item.expectedCount) || 0;
  const receivedLabels = Number(item.unloadedCount) || 0;
  const pieces = Array.isArray(item.pieces) ? item.pieces : [];
  const isReady =
    item.labelSummary?.ready ??
    (totalLabels > 0 && receivedLabels >= totalLabels);

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isReady ? "border-emerald-500/40" : theme.panelSurface
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={`w-full px-3 py-2.5 flex items-center justify-between gap-3 text-left ${
          isReady ? "bg-emerald-500/5" : ""
        }`}
      >
        <div className="min-w-0">
          <div className="text-xs font-mono font-bold truncate">
            {item.shipmentId}
          </div>
          <div className="text-[11px] opacity-60">
            {receivedLabels} of {totalLabels || receivedLabels} labels received
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isReady
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-amber-500/15 text-amber-600"
            }`}
          >
            {receivedLabels}/{totalLabels || receivedLabels}{" "}
            {isReady ? "Ready" : "Pending"}
          </span>
          <FontAwesomeIcon
            icon={expanded ? faChevronUp : faChevronDown}
            className="text-[10px] opacity-50"
          />
        </div>
      </button>

      {expanded && pieces.length > 0 ? (
        <div className="border-t divide-y divide-white/5">
          {pieces.map((piece) => {
            const received = piece.state === "received";
            return (
              <div key={piece.pieceId} className="px-3 py-2.5 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-bold truncate">
                      {piece.pieceId}
                    </div>
                    {received && piece.receivedBy ? (
                      <div className="text-[11px] opacity-60 mt-0.5">
                        Received by {piece.receivedBy}
                        {piece.receivedAt
                          ? ` · ${formatReconciliationTimestamp(piece.receivedAt)}`
                          : ""}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      received
                        ? "bg-emerald-500/15 text-emerald-600"
                        : piece.state === "on_truck"
                          ? "bg-amber-500/15 text-amber-600"
                          : "bg-red-500/15 text-red-600"
                    }`}
                  >
                    {received
                      ? "Received"
                      : piece.state === "on_truck"
                        ? "On truck"
                        : "Missing"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function HandoffPrompt({
  theme,
  summary,
  tripId = null,
  missingRemarks,
  onRemarkChange,
  onRelease,
  onRefresh,
  onBack,
  btnStatus,
}) {
  const totals = summary?.totals || {};
  const context = summary?.context || {};
  const missingShipments = summary?.missingShipments || [];
  const unloadedShipments = summary?.unloadedShipments || [];
  const hasMissing = missingShipments.length > 0;
  const remarksComplete = missingShipments.every((item) =>
    String(missingRemarks?.[item.id] || "").trim(),
  );
  const lifecycleCanRelease = summary?.lifecycle?.canReleaseForDelivery !== false;
  const releaseBlockReason = summary?.lifecycle?.releaseBlockReason || null;
  const countsReady =
    summary?.ready &&
    unloadedShipments.length > 0 &&
    (!hasMissing || remarksComplete);
  const canRelease = countsReady && (lifecycleCanRelease || summary?.ready);
  const { manifestPieces, unloadedPieces, missingPieces } =
    resolvePieceTotals(summary);

  const loadedSubtext = context.loadedScanBy
    ? `Scanned by ${context.loadedScanBy} at ${context.originWarehouse || "origin warehouse"}`
    : `Loaded at ${context.originWarehouse || "origin warehouse"}`;
  const unloadedSubtext = context.unloadedScanBy
    ? `Scanned by ${context.unloadedScanBy} at ${context.destinationWarehouse || "destination hub"}`
    : `Received at ${context.destinationWarehouse || "destination hub"}`;

  return (
    <InterceptorPrompt
      theme={theme}
      icon={hasMissing ? faTriangleExclamation : faTruckRampBox}
      iconColor={hasMissing ? "text-amber-500" : "text-emerald-500"}
      title={
        summary?.ready && lifecycleCanRelease
          ? "Manifest reconciled"
          : summary?.ready
            ? "Ready to release"
            : "Manifest reconciliation"
      }
      description={
        hasMissing
          ? "Add remarks for missing labels, then finalize reconciliation and release for delivery operations."
          : summary?.ready
            ? tripId
              ? lifecycleCanRelease
                ? `All shipments on ${tripId} are accounted for. Release to delivery operations.`
                : `All shipments on ${tripId} are accounted for. Click Release below to finalize and send to delivery operations.`
              : lifecycleCanRelease
                ? "All manifest shipments are accounted for. Release to delivery operations."
                : "All manifest shipments are accounted for. Click Release to finalize reconciliation."
            : "Unload remaining labels or add missing remarks to complete reconciliation."
      }
    >
      <div className="grid grid-cols-3 gap-2 text-left">
        <ReconciliationMetricCard
          label="Loaded into truck"
          value={manifestPieces}
          subtext={loadedSubtext}
          icon={faTruck}
          accentClass="text-emerald-500"
          theme={theme}
        />
        <ReconciliationMetricCard
          label="Unloaded (received)"
          value={unloadedPieces}
          subtext={unloadedSubtext}
          icon={faBoxOpen}
          accentClass="text-blue-500"
          theme={theme}
        />
        <ReconciliationMetricCard
          label="Missing"
          value={missingPieces}
          subtext="Difference between loaded and unloaded"
          icon={faTriangleExclamation}
          accentClass="text-red-500"
          theme={theme}
        />
      </div>

      {hasMissing ? (
        <div className="space-y-3 text-left">
          <div className="text-[10px] font-bold uppercase opacity-60">
            Missing Remarks
          </div>
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {missingShipments.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 ${theme.panelSurface}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-bold truncate">
                      {item.shipmentId}
                    </div>
                    <div className="text-[11px] opacity-60 truncate">
                      {item.recipientName} - {item.destination}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold text-amber-500">
                    {item.remainingLoaded} label
                    {item.remainingLoaded === 1 ? "" : "s"} on truck
                  </span>
                </div>
                <textarea
                  value={missingRemarks[item.id] || ""}
                  onChange={(e) => onRemarkChange(item.id, e.target.value)}
                  rows={2}
                  placeholder="Add a remark for this missing label..."
                  className={`mt-3 w-full rounded-lg border px-3 py-2 text-xs ${theme.input}`}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-left space-y-2">
          <div className="text-[10px] font-bold uppercase opacity-60">
            Ready Shipments
          </div>
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {unloadedShipments.length > 0 ? (
              unloadedShipments.map((item, index) => (
                <ReadyShipmentRow
                  key={item.id}
                  item={item}
                  theme={theme}
                  defaultExpanded={index === 0}
                />
              ))
            ) : (
              <p className={`text-xs px-1 ${theme.panelSurface} rounded-lg border p-3`}>
                No hub-received shipments are ready to release yet.
              </p>
            )}
          </div>
        </div>
      )}

      {!lifecycleCanRelease && releaseBlockReason && !summary?.ready && (
        <p className="text-xs text-amber-500/90 text-center px-2">
          {releaseBlockReason}
        </p>
      )}

      <div
        className={`rounded-lg border px-3 py-2.5 text-left text-[11px] leading-relaxed ${
          theme.panelSurface
        } border-blue-500/30 text-blue-600/90`}
      >
        Packages are now at {context.destinationWarehouse || "the destination hub"}{" "}
        and ready to be released to delivery operations. Custody remains at{" "}
        {context.destinationWarehouse?.includes("Odiongan")
          ? "Odiongan"
          : context.destinationWarehouse || "the hub"}{" "}
        until a checker scans and loads each label.
      </div>

      <div className="space-y-2">
        <StatusButton
          status={btnStatus}
          label="Release to Delivery Operations"
          loadingLabel="Releasing..."
          successLabel="Released"
          icon={faCheck}
          variant="blue"
          disabled={!canRelease}
          onClick={onRelease}
        />
        <div className="flex items-center justify-center gap-4">
          <button onClick={onBack} className="text-xs opacity-60 underline">
            Back to scanning
          </button>
          <button onClick={onRefresh} className="text-xs opacity-60 underline">
            Refresh reconciliation
          </button>
        </div>
      </div>
    </InterceptorPrompt>
  );
}

export function StartReceivingPrompt({ theme, btnStatus, onStartReceiving }) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faTruckRampBox}
      iconColor="text-emerald-500"
      title="Start Receiving"
      description="Accept custody at the destination hub before scanning packages. This marks the trip as arrived and opens receiving."
    >
      <StatusButton
        status={btnStatus}
        label="Start Receiving"
        loadingLabel="Starting..."
        successLabel="Receiving started!"
        icon={faCheck}
        variant="emerald"
        onClick={onStartReceiving}
      />
    </InterceptorPrompt>
  );
}

export function ArrivalPrompt({ theme, btnStatus, onMarkArrived }) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faTruckRampBox}
      iconColor="text-blue-500"
      title="Mark Trip as Arrived"
      description="Legacy fallback only. Hub trips should use Start Receiving before scanning; reconciliation marks the manifest RECONCILED."
    >
      <StatusButton
        status={btnStatus}
        label="Mark as Arrived"
        icon={faCheck}
        variant="blue"
        onClick={onMarkArrived}
      />
    </InterceptorPrompt>
  );
}

export function UnlockPrompt({ theme, btnStatus, onUnlock }) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faLock}
      iconColor="text-amber-500"
      title="Manifest Locked"
      description="The manifest is locked. Unlock it before scanning items out."
    >
      <StatusButton
        status={btnStatus}
        label="Unlock Manifest"
        loadingLabel="Unlocking..."
        successLabel="Unlocked!"
        icon={faUnlock}
        variant="amber"
        onClick={onUnlock}
      />
    </InterceptorPrompt>
  );
}

export function LoadedStatusPrompt({ theme, btnStatus, onSetLoaded, onSkip }) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faCheck}
      iconColor="text-emerald-500"
      title="Trip is Fully Loaded"
      description="All pending items are loaded. Set the trip to LOADED before locking the manifest or dispatching."
    >
      <div className="space-y-2">
        <StatusButton
          status={btnStatus}
          label="Set to LOADED"
          icon={faTruckRampBox}
          variant="emerald"
          onClick={onSetLoaded}
        />
        <button onClick={onSkip} className="text-xs opacity-60 underline mt-2">
          Skip & load extra items
        </button>
      </div>
    </InterceptorPrompt>
  );
}

export function LockPrompt({ theme, trip, btnStatus, onLock, onSkip }) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faLock}
      iconColor="text-emerald-500"
      title="Ready for Dispatch"
      description="The trip is loaded. Lock the manifest to seal it. The trip stays LOADED — use Dispatch Trip in the trip drawer next."
    >
      <div className="space-y-2">
        <StatusButton
          status={btnStatus}
          label="Lock Manifest"
          loadingLabel="Locking..."
          successLabel="Locked!"
          icon={faLock}
          variant="emerald"
          onClick={onLock}
        />
        <button onClick={onSkip} className="text-xs opacity-60 underline mt-2">
          Skip & load extra items
        </button>
      </div>
    </InterceptorPrompt>
  );
}

export function AssignmentPrompt({ theme, item, loading, action, onAssign }) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faTruckRampBox}
      iconColor="text-amber-500"
      title="Assignment Required"
      description={`Shipment ${item.shipmentId} is not assigned to this trip. You must assign it before you can ${action?.toLowerCase()} its packages.`}
    >
      <button
        onClick={onAssign}
        disabled={loading}
        className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${loading ? "bg-gray-500" : "bg-blue-600 hover:bg-blue-500"}`}
      >
        {loading ? "Assigning..." : "Assign Shipment Now"}
      </button>
    </InterceptorPrompt>
  );
}
