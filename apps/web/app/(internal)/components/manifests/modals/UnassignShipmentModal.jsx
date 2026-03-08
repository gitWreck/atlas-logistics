import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  faTimes,
  faMinusCircle,
} from "@fortawesome/free-solid-svg-icons";
import { unassignShipmentFromTruckTrip } from "@/app/utility/FirebaseFunctions";

export default function UnassignShipmentModal({
  isOpen,
  onClose,
  shipment,
  tripId,
  onSuccess,
  isDark = false, // Added isDark prop
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !shipment) return null;

  const handleUnassign = async () => {
    setLoading(true);
    setError("");

    try {
      await unassignShipmentFromTruckTrip({
        trackingDocId: shipment.id,
        truckTripId: tripId,
      });

      onSuccess(); // Refresh the list
      onClose(); // Close modal
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to unassign shipment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className={`border rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 ${
          isDark
            ? "bg-slate-900 border-slate-700 text-white"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b rounded-t-xl flex justify-between items-center ${
            isDark
              ? "border-slate-800 bg-slate-950"
              : "border-slate-100 bg-slate-50"
          }`}
        >
          <h3
            className={`font-bold flex items-center gap-2 ${isDark ? "text-slate-200" : "text-slate-800"}`}
          >
            <FontAwesomeIcon icon={faMinusCircle} className="text-red-500" />
            Unassign Shipment
          </h3>
          <button
            onClick={onClose}
            className={`transition-colors ${isDark ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-slate-600"}`}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex gap-3 items-start">
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className="text-red-500 mt-0.5"
            />
            <div
              className={`text-xs ${isDark ? "text-red-200" : "text-red-800"}`}
            >
              <strong className="block mb-1 text-red-500 font-bold uppercase">
                Warning
              </strong>
              You are removing{" "}
              <span
                className={`font-mono px-1 rounded ${isDark ? "bg-black/20" : "bg-red-500/5 border border-red-500/10"}`}
              >
                {shipment.trackingNumber}
              </span>{" "}
              from this trip. It will be returned to <b>Received / Warehouse</b>{" "}
              status.
            </div>
          </div>

          <div className="text-center">
            <div
              className={`text-3xl font-bold mb-1 ${isDark ? "text-white" : "text-slate-900"}`}
            >
              {shipment.totalItems || 0}
            </div>
            <div
              className={`text-[10px] uppercase font-bold tracking-widest ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              Items in shipment
            </div>
          </div>

          {error && (
            <div
              className={`text-xs text-center p-2 rounded border ${
                isDark
                  ? "text-red-400 bg-red-950/50 border-red-900"
                  : "text-red-600 bg-red-50 border-red-200"
              }`}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className={`flex-1 py-2.5 rounded-lg border font-bold text-sm transition-colors ${
                isDark
                  ? "border-slate-700 text-slate-400 hover:bg-slate-800"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleUnassign}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-900/20 transition-all flex justify-center items-center gap-2"
            >
              {loading ? <span>Processing...</span> : <>Confirm Removal</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
