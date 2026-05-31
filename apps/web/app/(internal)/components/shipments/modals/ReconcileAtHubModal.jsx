"use client";

import React, { useEffect, useMemo, useState } from "react";
import { reconcileShipmentAtHub } from "@/app/utility/FirebaseFunctions";
import {
  getExpectedPieceCountFromShipment,
  getHubReconcileBlockReason,
  isEligibleForHubReconcile,
} from "@/app/utility/hubReconcile";

export default function ReconcileAtHubModal({
  isOpen,
  onClose,
  onSuccess,
  isDark = false,
  shipment = null,
}) {
  const [expectedQty, setExpectedQty] = useState("");
  const [receivedQty, setReceivedQty] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("ODIONGAN_WAREHOUSE");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const shipmentId = shipment?.id || shipment?.shipmentId || "";
  const defaultExpected = useMemo(
    () => getExpectedPieceCountFromShipment(shipment || {}),
    [shipment],
  );

  const blockReason = shipment
    ? getHubReconcileBlockReason(shipment.status)
    : "Select a shipment first.";

  const eligible = shipment && isEligibleForHubReconcile(shipment.status);
  const parsedExpected = Number(expectedQty);
  const parsedReceived = Number(receivedQty);
  const previewVariance =
    Number.isFinite(parsedExpected) && Number.isFinite(parsedReceived)
      ? parsedReceived - parsedExpected
      : null;

  useEffect(() => {
    if (!isOpen || !shipment) return;
    setExpectedQty(String(defaultExpected || ""));
    setReceivedQty(String(defaultExpected || ""));
    setWarehouseCode("ODIONGAN_WAREHOUSE");
    setRemarks("");
    setError("");
  }, [isOpen, shipment, defaultExpected]);

  if (!isOpen) return null;

  const overlayClass = isDark
    ? "fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4"
    : "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[120] flex items-center justify-center p-4";
  const modalClass = isDark
    ? "w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-2xl"
    : "w-full max-w-lg rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl";
  const inputClass = isDark
    ? "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
    : "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500";
  const labelClass = isDark
    ? "text-xs text-slate-400 mb-1"
    : "text-xs text-slate-600 mb-1";

  const canSubmit =
    eligible &&
    !submitting &&
    shipmentId &&
    Number.isInteger(parsedExpected) &&
    parsedExpected >= 0 &&
    Number.isInteger(parsedReceived) &&
    parsedReceived >= 0;

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <div
          className={`px-5 py-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
        >
          <h3 className="text-lg font-bold">Reconcile at Odiongan</h3>
          <p
            className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}
          >
            Record expected vs received piece counts for{" "}
            <span className="font-mono">{shipmentId || "—"}</span>
          </p>
        </div>

        <div className="p-5 space-y-4">
          {!eligible && (
            <div
              className={`text-sm rounded-lg px-3 py-2 ${isDark ? "bg-amber-900/20 text-amber-200 border border-amber-800" : "bg-amber-50 text-amber-800 border border-amber-200"}`}
            >
              {blockReason}
            </div>
          )}

          {shipment?.reconciledAt && (
            <div
              className={`text-xs rounded-lg px-3 py-2 ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}
            >
              Previously reconciled: {shipment.reconcileResult || "—"}
              {shipment.reconciledBy ? ` by ${shipment.reconciledBy}` : ""}. Submit
              again to update counts.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={labelClass}>Expected pieces</div>
              <input
                type="number"
                min={0}
                step={1}
                className={inputClass}
                value={expectedQty}
                onChange={(e) => setExpectedQty(e.target.value)}
                disabled={!eligible}
              />
            </div>
            <div>
              <div className={labelClass}>Received pieces</div>
              <input
                type="number"
                min={0}
                step={1}
                className={inputClass}
                value={receivedQty}
                onChange={(e) => setReceivedQty(e.target.value)}
                disabled={!eligible}
              />
            </div>
          </div>

          {previewVariance != null && (
            <div
              className={`text-sm rounded-lg px-3 py-2 font-semibold ${
                previewVariance === 0
                  ? isDark
                    ? "bg-emerald-900/30 text-emerald-200 border border-emerald-800"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : isDark
                    ? "bg-amber-900/30 text-amber-200 border border-amber-800"
                    : "bg-amber-50 text-amber-800 border border-amber-200"
              }`}
            >
              {parsedReceived} of {parsedExpected} pieces matched
              {previewVariance !== 0 &&
                ` — variance ${previewVariance > 0 ? "+" : ""}${previewVariance}`}
            </div>
          )}

          <div>
            <div className={labelClass}>Warehouse code</div>
            <input
              className={inputClass}
              value={warehouseCode}
              onChange={(e) => setWarehouseCode(e.target.value)}
              disabled={!eligible}
            />
          </div>

          <div>
            <div className={labelClass}>Remarks (optional)</div>
            <input
              className={inputClass}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Odiongan intake reconcile"
              disabled={!eligible}
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
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            disabled={!canSubmit}
            onClick={async () => {
              try {
                setSubmitting(true);
                setError("");
                await reconcileShipmentAtHub({
                  shipmentId,
                  expectedQty: parsedExpected,
                  receivedQty: parsedReceived,
                  warehouseCode: warehouseCode || null,
                  remarks: remarks || null,
                });
                onSuccess?.();
                onClose?.();
              } catch (err) {
                console.error("Hub reconcile failed:", err);
                setError(err?.message || "Failed to reconcile shipment.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Saving..." : "Save Reconcile"}
          </button>
        </div>
      </div>
    </div>
  );
}
