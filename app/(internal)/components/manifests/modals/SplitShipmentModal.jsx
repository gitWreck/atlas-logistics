import React, { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCut,
  faTimes,
  faArrowRight,
  faBoxOpen,
} from "@fortawesome/free-solid-svg-icons";

export default function SplitShipmentModal({
  isOpen,
  onClose,
  shipment,
  onSuccess,
}) {
  const [splitCount, setSplitCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSplitCount(1);
      setError("");
    }
  }, [isOpen]);

  if (!isOpen || !shipment) return null;

  const totalItems = shipment.totalItems || 0;
  // Maximum items you can move (must leave at least 1 behind)
  const maxMove = totalItems > 1 ? totalItems - 1 : 0;

  const handleSplit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const fn = httpsCallable(functions, "splitShipment");

      await fn({
        originalShipmentId: shipment.id,
        itemsToSplit: Number(splitCount),
      });

      onSuccess(); // Refresh parent list
      onClose(); // Close modal
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to split shipment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <h3 className="font-bold text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faCut} className="text-amber-500" />
            Split Shipment
          </h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSplit} className="p-6 space-y-6">
          <div className="text-sm text-slate-400">
            Splitting{" "}
            <span className="font-mono text-white font-bold">
              {shipment.trackingNumber}
            </span>
            . The items you select will be moved to a <b>new</b> shipment ID.
          </div>

          {/* Visual Splitter */}
          <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 flex items-center justify-between gap-2">
            {/* Left: Original (Remaining) */}
            <div className="text-center w-1/3">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                Stays on Truck
              </div>
              <div className="text-2xl font-bold text-white">
                {totalItems - splitCount}
              </div>
              <div className="text-xs text-slate-400">Items</div>
            </div>

            <FontAwesomeIcon icon={faArrowRight} className="text-slate-600" />

            {/* Right: New (Moved) */}
            <div className="text-center w-1/3">
              <div className="text-[10px] uppercase font-bold text-amber-500 mb-1">
                Moves to New ID
              </div>
              <div className="text-3xl font-bold text-amber-400">
                {splitCount}
              </div>
              <div className="text-xs text-amber-400/70">Items</div>
            </div>
          </div>

          {/* Slider / Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase flex justify-between">
              <span>Items to separate</span>
              <span>Max: {maxMove}</span>
            </label>
            <input
              type="range"
              min="1"
              max={maxMove}
              value={splitCount}
              onChange={(e) => setSplitCount(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              disabled={maxMove === 0}
            />
            <div className="flex justify-center mt-2">
              <div className="relative">
                <FontAwesomeIcon
                  icon={faBoxOpen}
                  className="absolute left-3 top-2.5 text-slate-500 text-xs"
                />
                <input
                  type="number"
                  min="1"
                  max={maxMove}
                  value={splitCount}
                  onChange={(e) => setSplitCount(Number(e.target.value))}
                  className="w-24 bg-slate-800 border border-slate-600 rounded text-center py-1 text-white font-bold focus:border-amber-500 outline-none"
                />
              </div>
            </div>
          </div>

          {maxMove === 0 && (
            <div className="text-red-400 text-xs text-center bg-red-500/10 p-2 rounded">
              Cannot split: Shipment has only 1 item. Unassign it instead.
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 font-bold text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || maxMove === 0}
              className="flex-1 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:grayscale"
            >
              {loading ? "Splitting..." : "Confirm Split"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
