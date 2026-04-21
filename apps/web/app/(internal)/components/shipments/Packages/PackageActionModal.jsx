"use client";

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faBoxesStacked,
  faCube,
  faRotateLeft,
  faCheckCircle,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { updateShipmentPackageStatus } from "@/app/utility/FirebaseFunctions";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import StatusButton from "../../ui/StatusButton";

export default function PackageActionModal({
  pkg,
  shipmentId,
  onClose,
  isDark = false,
  onRefresh,
}) {
  const theme = getModalThemeClasses(isDark);

  const [manualQty, setManualQty] = useState(pkg?.quantity || 1);
  const [actionStatus, setActionStatus] = useState({
    loadAll: "IDLE",
    partialLoad: "IDLE",
    unload: "IDLE",
  });
  const [feedback, setFeedback] = useState({
    type: "",
    message: "",
  });

  const maxQty = Number(pkg?.quantity) || 1;

  const isBusy = useMemo(() => {
    return Object.values(actionStatus).some(
      (status) => status === "LOADING" || status === "SUCCESS",
    );
  }, [actionStatus]);

  const setButtonStatus = (key, value) => {
    setActionStatus((prev) => ({ ...prev, [key]: value }));
  };

  const clampQty = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(maxQty, Math.max(1, parsed));
  };

  const handleAction = async ({ buttonKey, newStatus, updateAll }) => {
    setFeedback({ type: "", message: "" });
    setButtonStatus(buttonKey, "LOADING");

    try {
      await updateShipmentPackageStatus({
        shipmentId,
        packageId: pkg.packageId,
        newStatus,
        manualQty: updateAll ? maxQty : manualQty,
        updateAll,
      });

      setButtonStatus(buttonKey, "SUCCESS");
      setFeedback({
        type: "success",
        message:
          newStatus === "RECEIVED"
            ? "Package status was updated back to Received."
            : updateAll
              ? "Full package was marked as loaded successfully."
              : `Partial load was applied successfully for ${manualQty} piece(s).`,
      });

      setTimeout(() => {
        setButtonStatus(buttonKey, "IDLE");
      }, 1200);

      onRefresh?.();
    } catch (err) {
      setButtonStatus(buttonKey, "ERROR");
      setFeedback({
        type: "error",
        message: err?.message || "Failed to update package status.",
      });

      setTimeout(() => {
        setButtonStatus(buttonKey, "IDLE");
      }, 1500);
    }
  };

  if (!pkg) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className={`absolute inset-0 ${theme.overlay}`} onClick={onClose} />

      <div
        className={`relative w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${theme.modal}`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${theme.header}`}
        >
          <div>
            <h3 className={`font-bold text-base ${theme.title}`}>
              Manage Package
            </h3>
            <p className={`text-xs mt-1 ${theme.bodyText}`}>
              Update loading or unload this package item.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg ${theme.closeButton}`}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Package Info */}
          <div className={`p-4 rounded-xl border ${theme.panelSurface}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <FontAwesomeIcon
                    icon={faBoxesStacked}
                    className={theme.accentText}
                  />
                  <span
                    className={`text-xs font-bold uppercase ${theme.label}`}
                  >
                    Package Details
                  </span>
                </div>

                <div className="font-mono text-sm text-amber-500 break-all">
                  {pkg.packageId}
                </div>

                <div className={`mt-2 text-sm ${theme.spanText}`}>
                  {pkg.description || "No description"}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div
                  className={`text-[10px] uppercase font-bold ${theme.label}`}
                >
                  Type
                </div>
                <div className={`text-xs mt-1 ${theme.bodyText}`}>
                  {pkg.packagingType || "Package"}
                </div>
              </div>
            </div>
          </div>

          {/* Quantity Section */}
          <div className={`p-4 rounded-xl border ${theme.statsCard}`}>
            <div className="flex items-center gap-2 mb-3">
              <FontAwesomeIcon icon={faCube} className={theme.accentText} />
              <span className={`text-xs font-bold uppercase ${theme.label}`}>
                Manual Quantity
              </span>
            </div>

            <label className={`text-[11px] ${theme.bodyText}`}>
              Set how many pieces to process for partial load. Max:{" "}
              <span className={theme.spanText}>{maxQty}</span>
            </label>

            <div className="flex gap-2 mt-3">
              <input
                type="number"
                min="1"
                max={maxQty}
                value={manualQty}
                onChange={(e) => setManualQty(clampQty(e.target.value))}
                className={`flex-1 px-3 py-2 rounded-lg border outline-none focus:border-blue-500 ${theme.input}`}
                disabled={isBusy}
              />

              <button
                type="button"
                onClick={() => setManualQty(maxQty)}
                disabled={isBusy}
                className={theme.secondaryButton}
              >
                MAX
              </button>
            </div>
          </div>

          {/* Feedback */}
          {feedback.message ? (
            <div
              className={
                feedback.type === "error"
                  ? theme.errorBox
                  : `text-xs border rounded-lg p-3 flex items-start gap-2 ${
                      isDark
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        : "text-emerald-700 bg-emerald-50 border-emerald-200"
                    }`
              }
            >
              <FontAwesomeIcon
                icon={
                  feedback.type === "error"
                    ? faExclamationTriangle
                    : faCheckCircle
                }
                className="mt-0.5"
              />
              <span>{feedback.message}</span>
            </div>
          ) : null}

          {/* Actions */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <StatusButton
                status={actionStatus.loadAll}
                onClick={() =>
                  handleAction({
                    buttonKey: "loadAll",
                    newStatus: "LOADED",
                    updateAll: true,
                  })
                }
                disabled={isBusy}
                variant="emerald"
                isDark={isDark}
                icon={faBoxesStacked}
                label="Load All"
                loadingLabel="Loading All..."
                successLabel="Loaded!"
                errorLabel="Failed"
                className="min-h-[52px]"
              />

              <StatusButton
                status={actionStatus.partialLoad}
                onClick={() =>
                  handleAction({
                    buttonKey: "partialLoad",
                    newStatus: "LOADED",
                    updateAll: false,
                  })
                }
                disabled={isBusy || maxQty === 1}
                variant="blue"
                isDark={isDark}
                icon={faCube}
                label={`Partial Load (${manualQty})`}
                loadingLabel="Processing..."
                successLabel="Updated!"
                errorLabel="Failed"
                className="min-h-[52px]"
              />
            </div>

            <StatusButton
              status={actionStatus.unload}
              onClick={() =>
                handleAction({
                  buttonKey: "unload",
                  newStatus: "RECEIVED",
                  updateAll: true,
                })
              }
              disabled={isBusy}
              variant="red"
              isDark={isDark}
              icon={faRotateLeft}
              label="Unload Package"
              loadingLabel="Unloading..."
              successLabel="Unloaded!"
              errorLabel="Failed"
              className="min-h-[52px]"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
