"use client";

import React, { useEffect, useState } from "react";
import { receiveReturnedShipmentAtHub } from "@/app/utility/FirebaseFunctions";
import {
  formatReturnSummary,
  getReturnReceiveBlockReason,
  isEligibleForReturnReceive,
} from "@/app/utility/returnLoop";
import { getShipmentTripIdsLabel } from "../shipmentHelpers";

export default function ReceiveReturnedModal({
  isOpen,
  onClose,
  onSuccess,
  isDark = false,
  shipment = null,
}) {
  const [warehouseCode, setWarehouseCode] = useState("ODIONGAN_WAREHOUSE");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const shipmentId = shipment?.id || shipment?.shipmentId || "";
  const eligible = Boolean(shipment) && isEligibleForReturnReceive(shipment);
  const blockReason = getReturnReceiveBlockReason(shipment);
  const summary = shipment ? formatReturnSummary(shipment) : null;
  const tripIdsLabel = shipment ? getShipmentTripIdsLabel(shipment) : null;

  useEffect(() => {
    if (!isOpen) return;
    setWarehouseCode("ODIONGAN_WAREHOUSE");
    setRemarks("");
    setError("");
  }, [isOpen, shipmentId]);

  if (!isOpen) return null;

  const overlayClass = isDark
    ? "fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4"
    : "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[120] flex items-center justify-center p-4";
  const modalClass = isDark
    ? "w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-2xl"
    : "w-full max-w-lg rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl";
  const inputClass = isDark
    ? "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
    : "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500";
  const labelClass = isDark
    ? "text-xs text-slate-400 mb-1"
    : "text-xs text-slate-600 mb-1";

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <div
          className={`px-5 py-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
        >
          <h3 className="text-lg font-bold">Receive Returned Shipment</h3>
          <p
            className={`text-xs mt-1 font-mono ${isDark ? "text-slate-400" : "text-slate-600"}`}
          >
            {shipmentId || "—"}
          </p>
        </div>

        <div className="p-5 space-y-4">
          {summary && (
            <div
              className={`text-xs rounded-lg px-3 py-2 ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"}`}
            >
              {summary}
            </div>
          )}

          {tripIdsLabel ? (
            <div
              className={`text-xs rounded-lg px-3 py-2 ${isDark ? "bg-indigo-900/30 text-indigo-200 border border-indigo-800" : "bg-indigo-50 text-indigo-800 border border-indigo-200"}`}
            >
              Active trip ID(s):{" "}
              <span className="font-mono font-semibold">{tripIdsLabel}</span>
            </div>
          ) : null}

          {!eligible && blockReason && (
            <div
              className={`text-sm rounded-lg px-3 py-2 ${isDark ? "bg-amber-900/20 text-amber-200 border border-amber-800" : "bg-amber-50 text-amber-800 border border-amber-200"}`}
            >
              {blockReason}
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
              placeholder="Received returned shipment at Odiongan"
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
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
            disabled={!eligible || submitting || !shipmentId}
            onClick={async () => {
              try {
                setSubmitting(true);
                setError("");
                await receiveReturnedShipmentAtHub({
                  shipmentIds: [shipmentId],
                  warehouseCode: warehouseCode || null,
                  remarks: remarks || null,
                });
                onSuccess?.();
                onClose?.();
              } catch (err) {
                console.error("Receive returned failed:", err);
                setError(err?.message || "Failed to receive returned shipment.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Saving..." : "Confirm Receive"}
          </button>
        </div>
      </div>
    </div>
  );
}
