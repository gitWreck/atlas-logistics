"use client";

import React, { useEffect, useMemo, useState } from "react";
import { releaseForDeliveryOperations } from "@/app/utility/FirebaseFunctions";
import {
  getCheckerReleaseBlockReason,
  isEligibleForCheckerRelease,
} from "@/app/utility/checkerRelease";
import { isTripReleaseEligible } from "@/app/utility/tripLifecycle";

function parseShipmentIds(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[\n,]/g)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
}

export default function ReleaseToCheckerModal({
  isOpen,
  onClose,
  onSuccess,
  user,
  isDark = false,
  defaultShipmentIds = [],
  defaultShipments = [],
  tripId = null,
  tripStatus = null,
  tripReconciledAt = null,
  tripManifestStatus = null,
  tripType = null,
}) {
  const [warehouseCode, setWarehouseCode] = useState("ODIONGAN_WAREHOUSE");
  const [remarks, setRemarks] = useState("");
  const [shipmentIdsInput, setShipmentIdsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setShipmentIdsInput((defaultShipmentIds || []).join("\n"));
  }, [defaultShipmentIds, isOpen]);

  const parsedIds = useMemo(
    () => parseShipmentIds(shipmentIdsInput),
    [shipmentIdsInput],
  );

  const statusByShipmentId = useMemo(() => {
    const map = new Map();
    (defaultShipments || []).forEach((shipment) => {
      if (!shipment?.id) return;
      map.set(String(shipment.id), shipment.status);
    });
    return map;
  }, [defaultShipments]);

  const releaseValidation = useMemo(() => {
    const blocked = [];
    const eligible = [];

    parsedIds.forEach((id) => {
      const status = statusByShipmentId.get(id);
      if (status != null && !isEligibleForCheckerRelease(status)) {
        blocked.push({
          id,
          status,
          reason: getCheckerReleaseBlockReason(status),
        });
        return;
      }
      eligible.push(id);
    });

    return { blocked, eligible };
  }, [parsedIds, statusByShipmentId]);

  const tripReleaseGate = useMemo(() => {
    if (!tripId) return { eligible: true, reason: null };
    return isTripReleaseEligible({
      status: tripStatus,
      reconciledAt: tripReconciledAt,
      manifestStatus: tripManifestStatus,
      tripType: tripType,
    });
  }, [tripId, tripStatus, tripReconciledAt, tripManifestStatus, tripType]);

  const canSubmit =
    !submitting &&
    releaseValidation.eligible.length > 0 &&
    tripReleaseGate.eligible;

  if (!isOpen) return null;

  const overlayClass = isDark
    ? "fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4"
    : "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[120] flex items-center justify-center p-4";
  const modalClass = isDark
    ? "w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-2xl"
    : "w-full max-w-2xl rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl";
  const inputClass = isDark
    ? "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
    : "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500";
  const labelClass = isDark
    ? "text-xs text-slate-400 mb-1"
    : "text-xs text-slate-600 mb-1";

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <div
          className={`px-5 py-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
        >
          <h3 className="text-lg font-bold">Release shipment(s)</h3>
          <p
            className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}
          >
            {tripId ? (
              <>
                Release from trip{" "}
                <span className="font-mono font-semibold">{tripId}</span>.
                Inventory becomes visible to all checkers. Custody stays at
                Odiongan until each piece is scanned under Load (marks out for
                delivery automatically).
              </>
            ) : (
              <>
                Makes inventory visible to all checkers. Custody stays at
                Odiongan until each piece is scanned under Load (marks out for
                delivery automatically).
              </>
            )}
          </p>
        </div>

        <div className="p-5 space-y-4">
          {tripId && !tripReleaseGate.eligible && (
            <div
              className={`text-sm rounded-lg px-3 py-2 ${isDark ? "bg-amber-900/30 text-amber-200 border border-amber-800" : "bg-amber-50 text-amber-800 border border-amber-200"}`}
            >
              {tripReleaseGate.reason}
            </div>
          )}

          <div>
            <div className={labelClass}>
              Shipment IDs (one per line or comma-separated)
            </div>
            <textarea
              rows={4}
              className={inputClass}
              placeholder="AT-20260525-SHP-920964-01"
              value={shipmentIdsInput}
              onChange={(e) => setShipmentIdsInput(e.target.value)}
            />
            <p
              className={`mt-1 text-[11px] ${isDark ? "text-slate-500" : "text-slate-500"}`}
            >
              {releaseValidation.eligible.length} eligible
              {parsedIds.length !== releaseValidation.eligible.length
                ? ` of ${parsedIds.length}`
                : ""}{" "}
              shipment(s) ready to release. Delivered, completed, and cancelled
              shipments cannot be released.
            </p>
            {releaseValidation.blocked.length > 0 && (
              <div
                className={`mt-2 text-[11px] rounded-lg px-3 py-2 ${isDark ? "bg-amber-900/20 text-amber-200 border border-amber-800" : "bg-amber-50 text-amber-800 border border-amber-200"}`}
              >
                Skipped {releaseValidation.blocked.length} ineligible:{" "}
                {releaseValidation.blocked
                  .map((item) => `${item.id} (${item.status})`)
                  .join(", ")}
              </div>
            )}
          </div>

          <div>
            <div className={labelClass}>Warehouse Code</div>
            <input
              className={inputClass}
              value={warehouseCode}
              onChange={(e) => setWarehouseCode(e.target.value)}
              placeholder="ODIONGAN_WAREHOUSE"
            />
          </div>

          <div>
            <div className={labelClass}>Remarks (optional)</div>
            <input
              className={inputClass}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Released for delivery; checker Load scan marks each piece out for delivery."
            />
          </div>

          {!!error && (
            <div
              className={`text-sm rounded-lg px-3 py-2 ${isDark ? "bg-red-900/30 text-red-300 border border-red-800" : "bg-red-50 text-red-700 border border-red-200"}`}
            >
              {error}
            </div>
          )}
        </div>

        <div
          className={`px-5 py-4 border-t flex justify-end gap-2 ${isDark ? "border-slate-800" : "border-slate-200"}`}
        >
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${isDark ? "bg-slate-800 text-slate-200 hover:bg-slate-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            disabled={!canSubmit}
            onClick={async () => {
              try {
                setSubmitting(true);
                setError("");
                await releaseForDeliveryOperations({
                  tripId: tripId || null,
                  shipmentIds: releaseValidation.eligible,
                  warehouseCode: warehouseCode || null,
                  remarks: remarks || null,
                });
                onSuccess?.();
                onClose?.();
              } catch (err) {
                console.error("Release to checker failed:", err);
                setError(err?.message || "Failed to release shipments.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Releasing..." : "Release shipment(s)"}
          </button>
        </div>
      </div>
    </div>
  );
}
