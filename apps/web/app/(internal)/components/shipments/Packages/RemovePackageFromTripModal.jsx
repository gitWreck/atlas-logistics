"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  faTimes,
  faMinusCircle,
} from "@fortawesome/free-solid-svg-icons";
import { unassignShipmentFromTrip } from "@/app/utility/FirebaseFunctions";
import { formatCallableError } from "@/app/utility/utilities";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";

export default function RemovePackageFromTripModal({
  isOpen,
  onClose,
  shipment,
  pkg,
  tripId,
  onSuccess,
  isDark = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const theme = getModalThemeClasses(isDark);
  const action = getModalActionClasses();

  if (!isOpen || !shipment || !pkg || !tripId) return null;

  const packageId = String(pkg.packageId || pkg.trackingNumber || "").trim();
  const quantity = Math.max(Number(pkg.quantity) || 1, 1);

  const handleRemove = async () => {
    if (!packageId) {
      setError("This package has no tracking ID and cannot be removed safely.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await unassignShipmentFromTrip({
        trackingShipmentId: shipment.id,
        tripId,
        packageId,
      });

      onSuccess?.(result?.data || {});
      onClose?.();
    } catch (err) {
      console.error(err);
      setError(
        formatCallableError(err, "Failed to remove package from trip."),
      );
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 ${theme.overlay}`}
        onClick={loading ? undefined : onClose}
      />

      <div
        className={`relative border rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 ${theme.modal} ${action.dangerBorder}`}
      >
        <div
          className={`p-4 border-b rounded-t-xl flex justify-between items-center ${theme.header}`}
        >
          <h3 className={`font-bold flex items-center gap-2 ${theme.title}`}>
            <FontAwesomeIcon icon={faMinusCircle} className="text-red-500" />
            Remove Package
          </h3>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={theme.closeButton}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className={theme.errorBox}>
            <div className="flex gap-3 items-start">
              <FontAwesomeIcon
                icon={faTriangleExclamation}
                className="text-red-500 mt-0.5"
              />
              <div className="text-xs">
                <strong className="block mb-1 text-red-500 font-bold uppercase">
                  Warning
                </strong>
                You are removing{" "}
                <span
                  className={`font-mono px-1 rounded ${
                    isDark
                      ? "bg-black/20"
                      : "bg-red-500/5 border border-red-500/10"
                  }`}
                >
                  {packageId || "this package"}
                </span>{" "}
                from this trip. It will restart at{" "}
                <b>Received at Divisoria</b>. Trip counters will be corrected
                and the action will remain in the audit history.
              </div>
            </div>
          </div>

          <div className="text-center">
            <div className={`text-3xl font-bold mb-1 ${theme.title}`}>
              {quantity}
            </div>
            <div
              className={`text-[10px] uppercase font-bold tracking-widest ${theme.label}`}
            >
              Piece quantity
            </div>
            {pkg.description ? (
              <div className={`mt-2 text-xs ${theme.bodyText}`}>
                {pkg.description}
                {pkg.packagingType ? ` · ${pkg.packagingType}` : ""}
              </div>
            ) : null}
          </div>

          {error && (
            <div className={theme.errorBox}>
              <div className="text-center">{error}</div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={theme.secondaryButton}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleRemove}
              disabled={loading}
              className={action.danger}
            >
              {loading ? <span>Processing...</span> : <>Confirm Removal</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
