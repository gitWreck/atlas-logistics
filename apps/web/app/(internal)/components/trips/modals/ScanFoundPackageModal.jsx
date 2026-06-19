"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faQrcode } from "@fortawesome/free-solid-svg-icons";
import {
  recoverFoundPackage,
  releaseForDeliveryOperations,
} from "@/app/utility/FirebaseFunctions";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import StatusButton from "../../ui/StatusButton";

export default function ScanFoundPackageModal({
  isOpen,
  onClose,
  tripId,
  tripPublicId,
  isDark = false,
  onRefresh,
}) {
  const theme = getModalThemeClasses(isDark);
  const [packageLabel, setPackageLabel] = useState("");
  const [recoverStatus, setRecoverStatus] = useState("IDLE");
  const [releaseStatus, setReleaseStatus] = useState("IDLE");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const tripLabel = tripPublicId || tripId;
  const counters = result?.counters;

  const handleClose = () => {
    setPackageLabel("");
    setError("");
    setResult(null);
    setRecoverStatus("IDLE");
    setReleaseStatus("IDLE");
    onClose?.();
  };

  const handleRecover = async () => {
    const label = String(packageLabel || "").trim();
    if (!label) {
      setError("Enter or scan a package label.");
      return;
    }

    setError("");
    setRecoverStatus("LOADING");
    try {
      const payload = await recoverFoundPackage({
        tripId,
        packageLabel: label,
        sourceUI: "TRIP_DRAWER",
      });
      setRecoverStatus("SUCCESS");
      setResult(payload);
      setPackageLabel("");
      onRefresh?.();
      setTimeout(() => setRecoverStatus("IDLE"), 1500);
    } catch (err) {
      setRecoverStatus("ERROR");
      setError(err?.message || "Recovery failed.");
      setTimeout(() => setRecoverStatus("IDLE"), 2000);
    }
  };

  const handleReleaseRecovered = async () => {
    if (!result?.packageId) return;

    setError("");
    setReleaseStatus("LOADING");
    try {
      await releaseForDeliveryOperations({
        tripId,
        packageIds: [result.packageId],
        remarks: `Release recovered package ${result.packageId} to delivery operations pool.`,
      });
      setReleaseStatus("SUCCESS");
      onRefresh?.();
      setTimeout(() => handleClose(), 1000);
    } catch (err) {
      setReleaseStatus("ERROR");
      setError(err?.message || "Release failed.");
      setTimeout(() => setReleaseStatus("IDLE"), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 ${theme.overlay}`}
        onClick={handleClose}
      />

      <div
        className={`relative w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden ${theme.modal}`}
      >
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${theme.header}`}
        >
          <div>
            <h3
              className={`font-bold text-base flex items-center gap-2 ${theme.title}`}
            >
              <FontAwesomeIcon icon={faQrcode} className="text-emerald-500" />
              Scan Found Package
            </h3>
            <p className={`text-xs mt-1 font-mono text-amber-500`}>{tripLabel}</p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className={`p-2 rounded-lg ${theme.closeButton}`}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className={`text-sm ${theme.bodyText}`}>
            Scan a missing package found in Odiongan warehouse. This records hub
            receive and updates trip reconciliation counts. If the trip was already
            released, release the recovered piece separately to join the delivery
            pool.
          </p>

          {!result ? (
            <>
              <label className="block">
                <span className={`text-xs font-semibold ${theme.label}`}>
                  Package label
                </span>
                <input
                  type="text"
                  value={packageLabel}
                  onChange={(e) => setPackageLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRecover();
                  }}
                  placeholder="AT-YYYYMMDD-SHP-XXXXXX-01"
                  disabled={recoverStatus === "LOADING"}
                  className={`mt-1 w-full border rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-emerald-500 ${theme.input}`}
                  autoFocus
                />
              </label>

              <StatusButton
                status={recoverStatus}
                label="Complete Scan"
                disabled={!packageLabel.trim() || recoverStatus === "LOADING"}
                variant="emerald"
                isDark={isDark}
                onClick={handleRecover}
              />
            </>
          ) : (
            <div
              className={`rounded-xl border p-4 space-y-3 ${theme.panelSurface}`}
            >
              <div className={`text-sm font-semibold ${theme.title}`}>
                Package recovered
              </div>
              <div className="font-mono text-sm text-emerald-500">
                {result.packageId}
              </div>

              {counters && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className={`rounded-lg border p-2 ${theme.panelSurface}`}>
                    <div className={theme.label}>Loaded</div>
                    <div className="font-mono font-bold mt-1">
                      {counters.loaded.before} → {counters.loaded.after}
                    </div>
                  </div>
                  <div className={`rounded-lg border p-2 ${theme.panelSurface}`}>
                    <div className={theme.label}>Received</div>
                    <div className="font-mono font-bold mt-1">
                      {counters.received.before} → {counters.received.after}
                    </div>
                  </div>
                  <div className={`rounded-lg border p-2 ${theme.panelSurface}`}>
                    <div className={theme.label}>Missing</div>
                    <div className="font-mono font-bold mt-1">
                      {counters.missing.before} → {counters.missing.after}
                    </div>
                  </div>
                </div>
              )}

              {result.tripDeliveryPoolActive ? (
                <StatusButton
                  status={releaseStatus}
                  label="Release to Delivery Operations"
                  disabled={releaseStatus === "LOADING"}
                  variant="blue"
                  isDark={isDark}
                  onClick={handleReleaseRecovered}
                />
              ) : (
                <p className={`text-xs ${theme.bodyText}`}>
                  Trip is not released yet. Use the normal Release workflow when
                  ready — only newly eligible pieces will be released.
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setRecoverStatus("IDLE");
                }}
                className={`w-full text-sm py-2 rounded-lg border ${theme.closeButton}`}
              >
                Scan another package
              </button>
            </div>
          )}

          {error && (
            <div className="alert alert--error text-sm">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
