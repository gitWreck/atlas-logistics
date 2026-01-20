import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBan,
  faTimes,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { disableTruckTrip } from "@/apps/web/app/utility/FirebaseFunctions";

export default function DisableTripModal({ isOpen, onClose, trip, onSuccess }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen || !trip) return null;

  const handleDisable = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await disableTruckTrip({ tripDocId: trip.id, reason });
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-red-900/50 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="p-4 border-b border-slate-800 rounded-t-xl flex justify-between items-center bg-slate-950">
          <h3 className="font-bold text-red-400 flex items-center gap-2">
            <FontAwesomeIcon icon={faBan} /> Disable Trip
          </h3>
          <button onClick={onClose}>
            <FontAwesomeIcon
              icon={faTimes}
              className="text-slate-500 hover:text-white"
            />
          </button>
        </div>

        <form onSubmit={handleDisable} className="p-6 space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded text-red-200 text-xs flex gap-2 items-start">
            <FontAwesomeIcon icon={faExclamationTriangle} className="mt-0.5" />
            <div>
              You are about to cancel trip <b>{trip.tripId}</b>. This action
              cannot be undone easily.
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">
              Reason
            </label>
            <textarea
              required
              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-xs h-20 outline-none focus:border-red-500"
              placeholder="Why is this trip being cancelled?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 font-bold text-xs"
            >
              Keep Trip
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-900/20"
            >
              {loading ? "Disabling..." : "Confirm Disable"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
