import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faTruckLoading,
  faCheckDouble,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/apps/web/lib/firebase";

export default function LoadPackagesModal({
  isOpen,
  onClose,
  shipment,
  tripId,
  onSuccess,
}) {
  const [selectedPkgs, setSelectedPkgs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Initialize checklist based on current data
  useEffect(() => {
    if (isOpen && shipment?.packages) {
      // Pre-select items that are already LOADED
      const loadedIds = shipment.packages
        .filter((p) => p.status === "LOADED")
        .map((p) => p.trackingNumber);
      setSelectedPkgs(loadedIds);
    }
  }, [isOpen, shipment]);

  if (!isOpen || !shipment) return null;

  const total = shipment.packages?.length || 0;

  // Toggle Logic
  const togglePkg = (id) => {
    setSelectedPkgs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    if (selectedPkgs.length === total) {
      setSelectedPkgs([]); // Deselect All
    } else {
      setSelectedPkgs(shipment.packages.map((p) => p.trackingNumber)); // Select All
    }
  };

  // Save Logic
  const handleSave = async () => {
    setLoading(true);
    try {
      const allIds = shipment.packages.map((p) => p.trackingNumber);

      // We need to send two requests: one to LOAD selected, one to UNLOAD deselected
      // Or simply overwrite. Here is the logic for "Syncing state"

      const toLoad = selectedPkgs;
      const toUnload = allIds.filter((id) => !selectedPkgs.includes(id));

      const fn = httpsCallable(functions, "updatePackageStatus");

      // Batch 1: Load
      if (toLoad.length > 0) {
        await fn({
          shipmentId: shipment.id,
          truckTripId: tripId,
          packageBarcodes: toLoad,
          action: "LOAD",
        });
      }

      // Batch 2: Unload (if you unticked something previously loaded)
      if (toUnload.length > 0) {
        await fn({
          shipmentId: shipment.id,
          truckTripId: tripId,
          packageBarcodes: toUnload,
          action: "UNLOAD",
        });
      }

      onSuccess(); // Refresh table
      onClose();
    } catch (err) {
      alert("Failed to update: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
        {/* HEADER */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950 rounded-t-xl">
          <div>
            <h3 className="font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon
                icon={faTruckLoading}
                className="text-blue-400"
              />
              Load Packages
            </h3>
            <div className="text-xs text-slate-500 font-mono mt-1">
              {shipment.trackingNumber}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* TOOLBAR */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
          <div className="text-xs font-bold text-slate-400">
            Selected: <span className="text-white">{selectedPkgs.length}</span>{" "}
            / {total}
          </div>
          <button
            onClick={toggleAll}
            className="text-xs text-blue-400 hover:text-blue-300 font-bold underline"
          >
            {selectedPkgs.length === total ? "Deselect All" : "Select All"}
          </button>
        </div>

        {/* SCROLLABLE LIST */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {shipment.packages?.map((pkg) => {
            const isChecked = selectedPkgs.includes(pkg.trackingNumber);
            return (
              <div
                key={pkg.trackingNumber}
                onClick={() => togglePkg(pkg.trackingNumber)}
                className={`
                  p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all
                  ${
                    isChecked
                      ? "bg-blue-600/10 border-blue-500/50"
                      : "bg-slate-800 border-slate-700 hover:border-slate-600"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`
                    w-5 h-5 rounded flex items-center justify-center border
                    ${isChecked ? "bg-blue-500 border-blue-500 text-white" : "border-slate-600 bg-slate-900"}
                  `}
                  >
                    {isChecked && (
                      <FontAwesomeIcon icon={faCheckDouble} size="xs" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200">
                      {pkg.description}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {pkg.trackingNumber}
                    </div>
                  </div>
                </div>
                <div className="text-xs font-mono text-slate-500">
                  {pkg.weight}kg
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 rounded-b-xl flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 text-xs font-bold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-900/20"
          >
            {loading ? "Saving..." : "Confirm Load"}
          </button>
        </div>
      </div>
    </div>
  );
}
