"use client";

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import StatusButton from "../../ui/StatusButton"; // Adjust path
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { hasReleasableHandoffPieces } from "@/app/utility/handoffRelease";
import {
  resolveAllMissingDisplayEntries,
  extractMissingPackagesFromRow,
  resolveMissingPackagesForRow,
} from "@/app/utility/reconciliationPieces";

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
  onClick = null,
  interactive = false,
}) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick || undefined}
      className={`rounded-xl border p-3 text-left w-full ${theme.panelSurface} ${
        interactive
          ? "cursor-pointer transition-colors hover:border-red-500/40 hover:bg-red-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          : ""
      }`}
    >
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
      {interactive ? (
        <p className="mt-1 text-[10px] font-semibold text-red-500/80">
          Tap to view missing labels
        </p>
      ) : null}
    </Wrapper>
  );
}

function resolveMissingStateLabel(entry = {}) {
  const state = entry.state || entry.packageStatus;
  if (state === "on_other_trip") return "On other trip";
  if (state === "on_truck") return "On truck";
  if (state === "variance" || entry.isUnresolved) return "Unaccounted";
  return "Missing";
}

function MissingPackagesModal({
  isOpen,
  onClose,
  missingPackages = [],
  missingShipments = [],
  missingPieces = 0,
  isDark = false,
}) {
  const modalTheme = getModalThemeClasses(isDark);

  const groupedEntries = useMemo(() => {
    const groups = new Map();

    const addEntry = (entry) => {
      const shipmentKey = entry.shipmentId || entry.shipmentDocId || "Unknown";
      if (!groups.has(shipmentKey)) {
        groups.set(shipmentKey, {
          shipmentId: shipmentKey,
          recipientName: entry.recipientName || null,
          destination: entry.destination || null,
          packages: [],
        });
      }
      groups.get(shipmentKey).packages.push(entry);
    };

    if (missingPackages.length > 0) {
      missingPackages.forEach(addEntry);
      return [...groups.values()];
    }

    for (const row of missingShipments) {
      const entries = resolveMissingPackagesForRow(row, {
        tripPackages: row.tripPackages || [],
        allPackages: row.allPackages || row.tripPackages || [],
        tripId: row.tripId || "",
        tripShipment: { packageBarcodes: row.packageBarcodes || [] },
      });
      if (entries.length > 0) {
        entries.forEach(addEntry);
        continue;
      }

      const fromPieces = extractMissingPackagesFromRow(row);
      if (fromPieces.length > 0) {
        fromPieces.forEach(addEntry);
        continue;
      }

      const pieces = (row.pieces || []).filter((piece) =>
        ["on_truck", "missing", "variance", "on_other_trip"].includes(
          piece.state,
        ),
      );
      for (const piece of pieces) {
        addEntry({
          packageId: piece.pieceId,
          shipmentId: row.shipmentId,
          pieceSuffix: null,
          shipmentDocId: row.id || null,
          recipientName: row.recipientName || null,
          destination: row.destination || null,
          packageStatus: piece.packageStatus || piece.state || null,
          state: piece.state,
        });
      }
    }

    return [...groups.values()];
  }, [missingPackages, missingShipments]);

  const totalListed = groupedEntries.reduce(
    (sum, group) => sum + group.packages.length,
    0,
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 100000 }}
    >
      <div
        className={`fixed inset-0 ${modalTheme.overlay}`}
        onClick={onClose}
      />

      <div
        className={`relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl ${modalTheme.modal}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between border-b px-5 py-4 ${modalTheme.header}`}
        >
          <div>
            <h3 className={`text-base font-bold ${modalTheme.title}`}>
              Missing Labels
            </h3>
            <p className={`mt-0.5 text-xs ${modalTheme.label}`}>
              {totalListed > 0
                ? `${totalListed} label${totalListed === 1 ? "" : "s"} need attention`
                : `${missingPieces} piece${missingPieces === 1 ? "" : "s"} unaccounted`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={modalTheme.closeButton}
            aria-label="Close missing labels modal"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {groupedEntries.length === 0 ? (
            <div
              className={`rounded-xl border p-4 text-sm leading-relaxed ${modalTheme.input}`}
            >
              No individual missing labels were resolved yet. Review the
              shipments below in reconciliation and unload or mark missing
              packages.
            </div>
          ) : (
            groupedEntries.map((group) => (
              <div
                key={group.shipmentId}
                className={`rounded-xl border overflow-hidden ${modalTheme.input}`}
              >
                <div className="border-b px-3 py-2.5">
                  <div className="text-xs font-mono font-bold break-all">
                    {group.shipmentId}
                  </div>
                  {group.recipientName ? (
                    <div className="mt-0.5 text-[11px] opacity-70 truncate">
                      {group.recipientName}
                      {group.destination ? ` · ${group.destination}` : ""}
                    </div>
                  ) : null}
                </div>
                <ul className="divide-y divide-white/5">
                  {group.packages.map((entry) => (
                    <li
                      key={entry.packageId}
                      className="px-3 py-2.5 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-bold break-all">
                          {entry.isUnresolved
                            ? "Unresolved label"
                            : entry.packageId}
                        </div>
                        {entry.pieceSuffix ? (
                          <div className="text-[11px] opacity-60 mt-0.5">
                            Piece {entry.pieceSuffix}
                          </div>
                        ) : null}
                        {entry.otherTripId ? (
                          <div className="text-[11px] text-amber-600 mt-0.5">
                            Loaded on {entry.otherTripId}
                          </div>
                        ) : null}
                        {entry.note ? (
                          <div className="text-[11px] opacity-60 mt-0.5 leading-snug">
                            {entry.note}
                          </div>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          entry.state === "on_other_trip"
                            ? "bg-amber-500/15 text-amber-600"
                            : entry.isUnresolved
                              ? "bg-orange-500/15 text-orange-600"
                              : "bg-red-500/15 text-red-500"
                        }`}
                      >
                        {resolveMissingStateLabel(entry)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className={`border-t px-5 py-4 ${modalTheme.header}`}>
          <button
            type="button"
            onClick={onClose}
            className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold ${modalTheme.input}`}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ReadyShipmentRow({ item, theme, defaultExpanded = true }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const totalLabels = Number(item.expectedCount) || 0;
  const receivedLabels = Number(item.unloadedCount) || 0;
  const pieces = Array.isArray(item.pieces) ? item.pieces : [];
  const missingEntries = useMemo(() => {
    const resolved = resolveMissingPackagesForRow(item, {
      tripPackages: item.tripPackages || [],
      allPackages: item.allPackages || item.tripPackages || [],
      tripId: item.tripId || "",
      tripShipment: { packageBarcodes: item.packageBarcodes || [] },
    });
    if (resolved.length > 0) return resolved;
    return Array.isArray(item.missingPackages) ? item.missingPackages : [];
  }, [item]);
  const pieceIds = new Set(
    pieces.map((piece) => String(piece.pieceId || "")).filter(Boolean),
  );
  const extraMissing = missingEntries.filter(
    (entry) => entry.packageId && !pieceIds.has(String(entry.packageId)),
  );
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

      {expanded && (pieces.length > 0 || extraMissing.length > 0) ? (
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
                        : piece.state === "variance"
                          ? "Unaccounted"
                          : "Missing"}
                  </span>
                </div>
              </div>
            );
          })}
          {extraMissing.map((entry) => (
            <div key={entry.packageId} className="px-3 py-2.5 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-mono font-bold truncate">
                    {entry.isUnresolved ? "Unresolved label" : entry.packageId}
                  </div>
                  {entry.otherTripId ? (
                    <div className="text-[11px] text-amber-600 mt-0.5">
                      Loaded on {entry.otherTripId}
                    </div>
                  ) : null}
                  {entry.note ? (
                    <div className="text-[11px] opacity-60 mt-0.5 leading-snug">
                      {entry.note}
                    </div>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    entry.state === "on_other_trip"
                      ? "bg-amber-500/15 text-amber-600"
                      : entry.isUnresolved
                        ? "bg-orange-500/15 text-orange-600"
                        : "bg-red-500/15 text-red-600"
                  }`}
                >
                  {resolveMissingStateLabel(entry)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MissingPackageRemarkCard({
  pkg,
  theme,
  missingRemarks,
  onRemarkChange,
}) {
  return (
    <div className={`rounded-lg border p-3 ${theme.panelSurface}`}>
      <div className="space-y-1 text-left">
        <div className="text-[10px] font-bold uppercase opacity-50">
          Missing Package
        </div>
        <div className="text-xs font-mono font-bold break-all">
          {pkg.packageId}
        </div>
        <div className="text-[11px] opacity-70">
          <span className="font-semibold">Shipment:</span>{" "}
          <span className="font-mono">{pkg.shipmentId}</span>
        </div>
        {pkg.pieceSuffix ? (
          <div className="text-[11px] opacity-70">
            <span className="font-semibold">Missing Piece:</span>{" "}
            <span className="font-mono">{pkg.pieceSuffix}</span>
          </div>
        ) : null}
        {pkg.packageStatus ? (
          <div className="text-[11px] opacity-70">
            <span className="font-semibold">Status:</span>{" "}
            <span className="font-mono">{pkg.packageStatus}</span>
          </div>
        ) : null}
        {pkg.recipientName ? (
          <div className="text-[11px] opacity-60 truncate">
            {pkg.recipientName}
            {pkg.destination ? ` - ${pkg.destination}` : ""}
          </div>
        ) : null}
      </div>
      <textarea
        value={missingRemarks[pkg.packageId] || ""}
        onChange={(e) => onRemarkChange(pkg.packageId, e.target.value)}
        rows={2}
        placeholder={`Optional remark for ${pkg.packageId}...`}
        className={`mt-3 w-full rounded-lg border px-3 py-2 text-xs ${theme.input}`}
      />
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
  isAdmin = false,
  isDark = false,
}) {
  const [showMissingModal, setShowMissingModal] = useState(false);
  const totals = summary?.totals || {};
  const context = summary?.context || {};
  const missingShipments = summary?.missingShipments || [];
  const missingPackages = useMemo(
    () => resolveAllMissingDisplayEntries(summary),
    [summary],
  );
  const unloadedShipments = summary?.unloadedShipments || [];
  const { manifestPieces, unloadedPieces, missingPieces } =
    resolvePieceTotals(summary);
  const hasMissingLabels = missingPackages.length > 0;
  const hasMissingCount = missingPieces > 0;
  const hasMissingShipments = missingShipments.length > 0;
  const hasMissing =
    hasMissingLabels || hasMissingCount || hasMissingShipments;
  const lifecycleCanRelease = summary?.lifecycle?.canReleaseForDelivery !== false;
  const releaseBlockReason = summary?.lifecycle?.releaseBlockReason || null;
  const standardCountsReady =
    summary?.ready && hasReleasableHandoffPieces(summary);
  const adminOverrideEligible =
    isAdmin && hasReleasableHandoffPieces(summary) && hasMissing;
  const canRelease = adminOverrideEligible
    ? true
    : standardCountsReady && (lifecycleCanRelease || summary?.ready);

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
          : adminOverrideEligible && hasMissing
            ? "Admin override release"
            : summary?.ready
              ? "Ready to release"
              : "Manifest reconciliation"
      }
      description={
        hasMissing && isAdmin
          ? "Admin override: optionally add remarks for missing labels, then release verified packages to delivery operations."
          : hasMissing
            ? "Unload remaining labels or optionally add missing remarks, then release verified packages to delivery operations."
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
          interactive={hasMissing && missingPieces > 0}
          onClick={
            hasMissing && missingPieces > 0
              ? () => setShowMissingModal(true)
              : null
          }
        />
      </div>

      <MissingPackagesModal
        isOpen={showMissingModal}
        onClose={() => setShowMissingModal(false)}
        missingPackages={missingPackages}
        missingShipments={missingShipments}
        missingPieces={missingPieces}
        isDark={isDark}
      />

      {hasMissing ? (
        <div className="space-y-3 text-left">
          {adminOverrideEligible && hasMissingLabels ? (
            <div className={`rounded-lg border p-3 ${theme.panelSurface}`}>
              <div className="text-[10px] font-bold uppercase opacity-60">
                Missing Packages ({missingPackages.length})
              </div>
              <ul className="mt-2 space-y-1 text-xs font-mono">
                {missingPackages.map((pkg) => (
                  <li key={pkg.packageId} className="flex items-start gap-2">
                    <span className="opacity-50">•</span>
                    <span className="break-all">{pkg.packageId}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!hasMissingLabels && hasMissingCount ? (
            <div
              className={`rounded-lg border p-3 text-xs leading-relaxed ${theme.panelSurface} border-amber-500/30 text-amber-700/90`}
            >
              {missingPieces} piece{missingPieces === 1 ? "" : "s"} unaccounted
              between loaded ({manifestPieces}) and unloaded ({unloadedPieces}).
              {hasMissingShipments
                ? " Review the shipments below and unload or mark missing labels."
                : " Refresh reconciliation or unload remaining labels."}
            </div>
          ) : null}

          {hasMissingShipments ? (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase opacity-60">
                Shipments With Missing Labels
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {missingShipments.map((item, index) => (
                  <ReadyShipmentRow
                    key={item.id}
                    item={item}
                    theme={theme}
                    defaultExpanded={index === 0}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {hasMissingLabels ? (
            <>
              <div className="text-[10px] font-bold uppercase opacity-60">
                Missing Remarks (optional)
              </div>
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {missingPackages.map((pkg) => (
                  <MissingPackageRemarkCard
                    key={pkg.packageId}
                    pkg={pkg}
                    theme={theme}
                    missingRemarks={missingRemarks}
                    onRemarkChange={onRemarkChange}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {unloadedShipments.length > 0 ? (
        <div className="text-left space-y-2">
          <div className="text-[10px] font-bold uppercase opacity-60">
            {hasMissing ? "Verified Shipments" : "Ready Shipments"}
          </div>
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {unloadedShipments.map((item, index) => (
              <ReadyShipmentRow
                key={item.id}
                item={item}
                theme={theme}
                defaultExpanded={!hasMissing && index === 0}
              />
            ))}
          </div>
        </div>
      ) : !hasMissing ? (
        <div className="text-left space-y-2">
          <p className={`text-xs px-1 ${theme.panelSurface} rounded-lg border p-3`}>
            No hub-received shipments are ready to release yet.
          </p>
        </div>
      ) : null}

      {adminOverrideEligible && hasMissing ? (
        <p className="text-xs text-amber-500/90 text-center px-2">
          Reconciliation variance will be logged. Verified packages will be
          released to delivery operations; missing labels stay on record until
          corrected on the manifest.
        </p>
      ) : null}

      {!lifecycleCanRelease && releaseBlockReason && !summary?.ready && !adminOverrideEligible ? (
        <p className="text-xs text-amber-500/90 text-center px-2">
          {releaseBlockReason}
        </p>
      ) : null}

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
        until a checker scans each piece under Load (out for delivery is set
        automatically per scan).
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

export function StartReceivingPrompt({
  theme,
  btnStatus,
  onStartReceiving,
  mode = "start",
}) {
  const isResume = mode === "resume";

  return (
    <InterceptorPrompt
      theme={theme}
      icon={faTruckRampBox}
      iconColor="text-emerald-500"
      title={isResume ? "Resume Receiving" : "Start Receiving"}
      description={
        isResume
          ? "Correction loads were dispatched. Resume receiving to open unload scans at Odiongan."
          : "Accept custody at the destination hub before scanning packages. This marks the trip as arrived and opens receiving."
      }
    >
      <StatusButton
        status={btnStatus}
        label={isResume ? "Resume Receiving" : "Start Receiving"}
        loadingLabel={isResume ? "Resuming..." : "Starting..."}
        successLabel={isResume ? "Receiving resumed!" : "Receiving started!"}
        icon={faCheck}
        variant="emerald"
        onClick={onStartReceiving}
      />
    </InterceptorPrompt>
  );
}

export function CorrectionDispatchPrompt({ theme, btnStatus, onDispatch }) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faTruckRampBox}
      iconColor="text-blue-500"
      title="Dispatch Correction"
      description="Newly loaded packages must be dispatched before you can resume receiving and unload at Odiongan."
    >
      <StatusButton
        status={btnStatus}
        label="Dispatch Correction"
        loadingLabel="Dispatching..."
        successLabel="Dispatched!"
        icon={faCheck}
        variant="blue"
        onClick={onDispatch}
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
