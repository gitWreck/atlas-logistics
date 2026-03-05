import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faTruckLoading,
  faCheckDouble,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export default function LoadPackagesModal({
  isOpen,
  onClose,
  shipment,
  tripId,
  onSuccess,
  isDark = true,
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

  // Theme-aware classes
  const modalPanel = isDark
    ? "bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]"
    : "bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]";
  const headerBg = isDark ? "p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950 rounded-t-xl" : "p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl";
  const headerTitle = isDark ? "font-bold text-white flex items-center gap-2" : "font-bold text-slate-900 flex items-center gap-2";
  const headerSub = isDark ? "text-xs text-slate-500 font-mono mt-1" : "text-xs text-slate-600 font-mono mt-1";
  const closeBtn = isDark ? "text-slate-500 hover:text-white" : "text-slate-500 hover:text-slate-900";
  const toolbar = isDark ? "p-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center" : "p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center";
  const toolbarLabel = isDark ? "text-xs font-bold text-slate-400" : "text-xs font-bold text-slate-600";
  const toolbarCount = isDark ? "text-white" : "text-slate-900";
  const toggleAllBtn = isDark ? "text-xs text-blue-400 hover:text-blue-300 font-bold underline" : "text-xs text-blue-600 hover:text-blue-700 font-bold underline";
  const itemChecked = isDark ? "bg-blue-600/10 border-blue-500/50" : "bg-blue-50 border-blue-300";
  const itemUnchecked = isDark ? "bg-slate-800 border-slate-700 hover:border-slate-600" : "bg-white border-slate-200 hover:border-slate-300";
  const checkboxChecked = isDark ? "bg-blue-500 border-blue-500 text-white" : "bg-blue-600 border-blue-600 text-white";
  const checkboxUnchecked = isDark ? "border-slate-600 bg-slate-900" : "border-slate-300 bg-slate-100";
  const itemDesc = isDark ? "text-xs font-bold text-slate-200" : "text-xs font-bold text-slate-800";
  const itemMono = isDark ? "text-[10px] text-slate-500 font-mono" : "text-[10px] text-slate-600 font-mono";
  const itemWeight = isDark ? "text-xs font-mono text-slate-500" : "text-xs font-mono text-slate-600";
  const footer = isDark ? "p-4 border-t border-slate-800 bg-slate-900 rounded-b-xl flex gap-3" : "p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex gap-3";
  const cancelBtn = isDark ? "flex-1 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 text-xs font-bold" : "flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold";

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
      <div className={modalPanel}>
        {/* HEADER */}
        <div className={headerBg}>
          <div>
            <h3 className={headerTitle}>
              <FontAwesomeIcon
                icon={faTruckLoading}
                className={isDark ? "text-blue-400" : "text-blue-600"}
              />
              Load Packages
            </h3>
            <div className={headerSub}>
              {shipment.trackingNumber}
            </div>
          </div>
          <button onClick={onClose} className={closeBtn}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* TOOLBAR */}
        <div className={toolbar}>
          <div className={toolbarLabel}>
            Selected: <span className={toolbarCount}>{selectedPkgs.length}</span>{" "}
            / {total}
          </div>
          <button
            onClick={toggleAll}
            className={toggleAllBtn}
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
                  ${isChecked ? itemChecked : itemUnchecked}
                `}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`
                    w-5 h-5 rounded flex items-center justify-center border
                    ${isChecked ? checkboxChecked : checkboxUnchecked}
                  `}
                  >
                    {isChecked && (
                      <FontAwesomeIcon icon={faCheckDouble} size="xs" />
                    )}
                  </div>
                  <div>
                    <div className={itemDesc}>
                      {pkg.description}
                    </div>
                    <div className={itemMono}>
                      {pkg.trackingNumber}
                    </div>
                  </div>
                </div>
                <div className={itemWeight}>
                  {pkg.weight}kg
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER ACTIONS */}
        <div className={footer}>
          <button
            onClick={onClose}
            className={cancelBtn}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Confirm Load"}
          </button>
        </div>
      </div>
    </div>
  );
}
