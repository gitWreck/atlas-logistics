"use client";

import React, { useState } from "react";
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

export default function UnassignShipmentModal({
  isOpen,
  onClose,
  shipment,
  tripId,
  onSuccess,
  isDark = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const theme = getModalThemeClasses(isDark);
  const action = getModalActionClasses();

  if (!isOpen || !shipment) return null;

  const handleUnassign = async () => {
    setLoading(true);
    setError("");

    try {
      await unassignShipmentFromTrip({
        trackingShipmentId: shipment.id,
        tripId: tripId,
      });

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      setError(
        formatCallableError(err, "Failed to unassign shipment."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={`absolute inset-0 ${theme.overlay}`} onClick={onClose} />

      <div
        className={`relative border rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 ${theme.modal} ${action.dangerBorder}`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b rounded-t-xl flex justify-between items-center ${theme.header}`}
        >
          <h3 className={`font-bold flex items-center gap-2 ${theme.title}`}>
            <FontAwesomeIcon icon={faMinusCircle} className="text-red-500" />
            Unassign Shipment
          </h3>

          <button type="button" onClick={onClose} className={theme.closeButton}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
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
                  {shipment.shipmentId || "Shipment #" + shipment.id}
                </span>{" "}
                from this trip. It will be returned to{" "}
                <b>Received / Warehouse</b> status.
              </div>
            </div>
          </div>

          <div className="text-center">
            <div className={`text-3xl font-bold mb-1 ${theme.title}`}>
              {shipment.totalItems || 0}
            </div>
            <div
              className={`text-[10px] uppercase font-bold tracking-widest ${theme.label}`}
            >
              Items in shipment
            </div>
          </div>

          {error && (
            <div className={theme.errorBox}>
              <div className="text-center">{error}</div>
            </div>
          )}

          {/* Actions */}
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
              onClick={handleUnassign}
              disabled={loading}
              className={action.danger}
            >
              {loading ? <span>Processing...</span> : <>Confirm Removal</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
