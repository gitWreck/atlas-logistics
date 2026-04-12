import { useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleNotch } from "@fortawesome/free-solid-svg-icons";
import { updatePackageStatus } from "@/app/utility/FirebaseFunctions";

export default function PackageActionModal({
  pkg,
  shipmentId,
  onClose,
  isDark,
}) {
  const [manualQty, setManualQty] = useState(pkg.quantity || 1);
  const [loadingAction, setLoadingAction] = useState(null);

  const handleAction = async (actionType, updateAll = false) => {
    const actionKey = `${actionType}-${updateAll}`;
    setLoadingAction(actionKey);

    try {
      await updatePackageStatus({
        shipmentId,
        packageId: pkg.packageId,
        newStatus: actionType,
        manualQty: updateAll ? pkg.quantity : manualQty,
        updateAll: updateAll,
      });

      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const isLoading = (key) => loadingAction === key;
  const isDisabled = loadingAction !== null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-sm rounded-2xl shadow-2xl border p-6 space-y-6 ${
          isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <h3
            className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}
          >
            Manage Package
          </h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-red-500"
          >
            ✕
          </button>
        </div>

        {/* Package Info */}
        <div
          className={`p-3 rounded-lg border text-xs ${
            isDark
              ? "bg-slate-950 border-slate-800"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div className="flex justify-between font-mono text-amber-500 mb-1">
            <span>{pkg.packageId}</span>
            <span className="text-slate-500">{pkg.packagingType}</span>
          </div>
          <div className={isDark ? "text-slate-400" : "text-slate-600"}>
            {pkg.description}
          </div>
        </div>

        {/* Quantity Input */}
        <div className="space-y-2">
          <label
            className={`text-[10px] font-bold uppercase tracking-wider ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}
          >
            Manual Quantity (Max: {pkg.quantity})
          </label>

          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              max={pkg.quantity}
              value={manualQty}
              onChange={(e) => {
                const val = Number(e.target.value);
                setManualQty(Math.min(pkg.quantity, Math.max(1, val)));
              }}
              className={`flex-1 px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${
                isDark
                  ? "bg-slate-800 border-slate-700 text-white"
                  : "bg-white border-slate-300"
              }`}
            />

            <button
              onClick={() => setManualQty(pkg.quantity)}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {/* Load All */}
          <button
            disabled={isDisabled}
            onClick={() => handleAction("LOADED", true)}
            className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
          >
            {isLoading("LOAD-true") ? (
              <FontAwesomeIcon icon={faCircleNotch} spin className="text-xl" />
            ) : (
              <>
                <span className="text-sm font-bold">Load All</span>
                <span className="text-[9px] uppercase font-bold opacity-70">
                  Full Package
                </span>
              </>
            )}
          </button>

          {/* Partial Load */}
          <button
            disabled={isDisabled}
            onClick={() => handleAction("LOADED", false)}
            className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-blue-500/20 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-all disabled:opacity-50"
          >
            {isLoading("LOAD-false") ? (
              <FontAwesomeIcon icon={faCircleNotch} spin className="text-xl" />
            ) : (
              <>
                <span className="text-sm font-bold">Partial Load</span>
                <span className="text-[9px] uppercase font-bold opacity-70">
                  {manualQty} Pieces
                </span>
              </>
            )}
          </button>
        </div>

        {/* Reset / Unload */}
        <button
          disabled={isDisabled}
          onClick={() => handleAction("UNLOADED", true)}
          className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-500 text-xs font-bold hover:bg-red-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading("UNLOAD-true") && (
            <FontAwesomeIcon icon={faCircleNotch} spin />
          )}
          <span>
            {isLoading("UNLOAD-true") ? "Processing..." : "Unload Package"}
          </span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
