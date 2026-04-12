"use client";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCut,
  faTimes,
  faArrowRight,
  faBoxOpen,
  faTruckLoading,
} from "@fortawesome/free-solid-svg-icons";
import {
  splitShipments,
  unassignShipmentFromTrip,
  assignShipmentToTrip,
} from "@/app/utility/FirebaseFunctions";
import {
  getModalThemeClasses,
  getModalActionClasses,
} from "@/app/utility/constant/theme";

export default function SplitShipmentModal({
  isOpen,
  onClose,
  shipment,
  tripId,
  onSuccess,
  isDark = false,
}) {
  const [splitCount, setSplitCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("");

  const theme = getModalThemeClasses(isDark);
  const action = getModalActionClasses();

  useEffect(() => {
    if (isOpen) {
      setSplitCount(1);
      setError("");
      setStep("");
    }
  }, [isOpen]);

  if (!isOpen || !shipment) return null;

  const totalItems = shipment.totalItems || 0;
  const maxMove = totalItems > 1 ? totalItems - 1 : 0;

  const activeTripId = shipment?.currentTruckTripId || tripId;
  const isOnTrip = !!activeTripId;

  const handleSplit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isOnTrip) {
        const currentTripId = activeTripId;

        setStep("Offloading shipment...");
        await unassignShipmentFromTrip({
          trackingShipmentId: shipment.id,
          tripId: currentTripId,
        });

        setStep("Splitting items...");
        await splitShipments({
          originalShipmentId: shipment.id,
          itemsToSplit: Number(splitCount),
        });

        setStep("Loading remaining items back...");
        await assignShipmentToTrip({
          trackingShipmentId: shipment.id,
          tripId: currentTripId,
        });
      } else {
        setStep("Processing split...");
        await splitShipments({
          originalShipmentId: shipment.id,
          itemsToSplit: Number(splitCount),
        });
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to split shipment.");
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={`absolute inset-0 ${theme.overlay}`} onClick={onClose} />

      <div
        className={`relative border rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${theme.modal}`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b rounded-t-xl flex justify-between items-center ${theme.header}`}
        >
          <h3 className={`font-bold flex items-center gap-2 ${theme.title}`}>
            <FontAwesomeIcon
              icon={isOnTrip ? faTruckLoading : faCut}
              className={isOnTrip ? "text-blue-500" : "text-amber-500"}
            />
            {isOnTrip ? "Partial Offload" : "Split Shipment"}
          </h3>

          <button type="button" onClick={onClose} className={theme.closeButton}>
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSplit} className="p-6 space-y-6">
          <div className={`text-sm ${theme.bodyText}`}>
            {isOnTrip ? (
              <>
                Removing items from <b>Trip</b>.
                <br />
                <span className={`font-bold ${theme.title}`}>
                  {totalItems - splitCount} items
                </span>{" "}
                will stay on the truck.
                <br />
                <span className="text-amber-500 font-bold">
                  {splitCount} items
                </span>{" "}
                will be offloaded & unassigned.
              </>
            ) : (
              <>
                Splitting{" "}
                <span className={`font-mono font-bold ${theme.title}`}>
                  {shipment.trackingNumber}
                </span>
                . Selected items move to a <b>new</b> ID.
              </>
            )}
          </div>

          {/* Visual Splitter */}
          <div
            className={`rounded-lg p-4 border flex items-center justify-between gap-2 ${theme.panelSurface || (isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200")}`}
          >
            <div className="text-center w-1/3">
              <div
                className={`text-[10px] uppercase font-bold mb-1 ${theme.label}`}
              >
                {isOnTrip ? "Stays on Trip" : "Original ID"}
              </div>
              <div className={`text-2xl font-bold ${theme.title}`}>
                {totalItems - splitCount}
              </div>
              <div className={`text-xs ${theme.bodyText}`}>Items</div>
            </div>

            <FontAwesomeIcon icon={faArrowRight} className={theme.helperText} />

            <div className="text-center w-1/3">
              <div className="text-[10px] uppercase font-bold text-amber-500 mb-1">
                {isOnTrip ? "Offloads" : "New ID"}
              </div>
              <div className="text-3xl font-bold text-amber-400">
                {splitCount}
              </div>
              <div className="text-xs text-amber-400/70">Items</div>
            </div>
          </div>

          {/* Input Section */}
          <div className="space-y-2">
            <label
              className={`text-xs font-bold uppercase flex justify-between ${theme.label}`}
            >
              <span>Items to {isOnTrip ? "Offload" : "Split"}</span>
              <span>Max: {maxMove}</span>
            </label>

            <input
              type="range"
              min="1"
              max={maxMove}
              value={splitCount}
              onChange={(e) => setSplitCount(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-amber-500 bg-slate-700"
              disabled={maxMove === 0}
            />

            <div className="flex justify-center mt-2">
              <div className="relative">
                <FontAwesomeIcon
                  icon={faBoxOpen}
                  className={`absolute left-3 top-2.5 text-xs ${theme.helperText}`}
                />
                <input
                  type="number"
                  min="1"
                  max={maxMove}
                  value={splitCount}
                  onChange={(e) => setSplitCount(Number(e.target.value))}
                  className={`w-24 border rounded text-center py-1 pl-8 font-bold outline-none focus:border-amber-500 ${theme.input}`}
                />
              </div>
            </div>
          </div>

          {/* Status/Error */}
          {maxMove === 0 && (
            <div className={theme.errorBox}>
              Cannot split: Shipment has only 1 item. Use "Unassign" instead.
            </div>
          )}

          {error && <div className={theme.errorBox}>{error}</div>}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={theme.secondaryButton}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || maxMove === 0}
              className="flex-1 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-500/20 disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading ? (
                <span className="animate-pulse">{step || "Processing..."}</span>
              ) : isOnTrip ? (
                "Confirm Offload"
              ) : (
                "Confirm Split"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
