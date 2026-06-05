"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruckRampBox,
  faCheck,
  faLock,
  faUnlock,
  faTriangleExclamation,
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
          ? "Add remarks for missing manifest rows, then finalize reconciliation and release for delivery operations."
          : summary?.ready
            ? tripId
              ? lifecycleCanRelease
                ? `All shipments on ${tripId} are accounted for. Release to delivery operations.`
                : `All shipments on ${tripId} are accounted for. Click Release below to finalize and send to delivery operations.`
              : lifecycleCanRelease
                ? "All manifest shipments are accounted for. Release to delivery operations."
                : "All manifest shipments are accounted for. Click Release to finalize reconciliation."
            : "Unload remaining packages or add missing remarks to complete reconciliation."
      }
    >
      <div className="grid grid-cols-3 gap-2 text-left">
        <MetricCard
          label="Manifest"
          value={totals.manifestShipments || 0}
          theme={theme}
        />
        <MetricCard
          label="Unloaded"
          value={totals.unloadedShipments || 0}
          theme={theme}
        />
        <MetricCard
          label="Missing"
          value={totals.missingShipments || 0}
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
                    {item.remainingLoaded} left
                  </span>
                </div>
                <textarea
                  value={missingRemarks[item.id] || ""}
                  onChange={(e) => onRemarkChange(item.id, e.target.value)}
                  rows={2}
                  placeholder="Add a remark for this missing shipment..."
                  className={`mt-3 w-full rounded-lg border px-3 py-2 text-xs ${theme.input}`}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-left">
          <div className="text-[10px] font-bold uppercase opacity-60 mb-2">
            Ready Shipments
          </div>
          <div className="max-h-36 overflow-y-auto rounded-lg border divide-y divide-white/5">
            {unloadedShipments.map((item) => (
              <div
                key={item.id}
                className="p-2 flex justify-between gap-3 text-xs"
              >
                <span className="font-mono font-bold truncate">
                  {item.shipmentId}
                </span>
                <span className="opacity-60 shrink-0">
                  {item.unloadedCount}/{item.expectedCount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!lifecycleCanRelease && releaseBlockReason && !summary?.ready && (
        <p className="text-xs text-amber-500/90 text-center px-2">
          {releaseBlockReason}
        </p>
      )}

      <p className="text-[11px] opacity-60 text-center px-1">
        Releases to the delivery pool. Custody stays at Odiongan until a checker
        scans and loads each label.
      </p>

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

function MetricCard({ label, value, theme }) {
  return (
    <div className={`rounded-lg border p-3 ${theme.panelSurface}`}>
      <div className="text-[10px] font-bold uppercase opacity-50">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
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
