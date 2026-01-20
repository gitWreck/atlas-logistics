import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  faTimes,
  faMinusCircle,
} from "@fortawesome/free-solid-svg-icons";
import { unassignShipmentFromTruckTrip } from "@/apps/web/app/utility/FirebaseFunctions";

export default function UnassignShipmentModal({
  isOpen,
  onClose,
  shipment,
  tripId,
  onSuccess,
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
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 rounded-t-xl flex justify-between items-center bg-slate-950">
          <h3 className="font-bold text-slate-200 flex items-center gap-2">
            <FontAwesomeIcon icon={faMinusCircle} className="text-red-500" />
            Unassign Shipment
          </h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex gap-3 items-start">
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className="text-red-400 mt-0.5"
            />
            <div className="text-xs text-red-200">
              <strong className="block mb-1 text-red-400 font-bold uppercase">
                Warning
              </strong>
              You are removing{" "}
              <span className="font-mono bg-black/20 px-1 rounded">
                {shipment.trackingNumber}
              </span>{" "}
              from this trip. It will be returned to <b>Received / Warehouse</b>{" "}
              status.
            </div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-white mb-1">
              {shipment.totalItems || 0}
            </div>
            <div className="text-xs uppercase text-slate-500 font-bold tracking-wider">
              Items in shipment
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-xs text-center bg-red-950/50 p-2 rounded border border-red-900">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 font-bold text-sm transition-colors"
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
