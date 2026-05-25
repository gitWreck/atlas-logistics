import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsSplitUpAndLeft,
  faCircleNotch,
} from "@fortawesome/free-solid-svg-icons";
import { updateShipmentPackages } from "@/app/utility/FirebaseFunctions";

export default function SplitShipmentModal({
  isOpen,
  onClose,
  selectedItems, // The actual package objects selected
  allPackages,
  originalShipmentId,
  shipmentCode,
  onSuccess,
  isDark,
}) {
  const [splitData, setSplitData] = useState(
    selectedItems
      .filter((pkg) => Number(pkg.quantity || 1) > 1)
      .map((pkg) => ({
        packageId: pkg.packageId,
        trackingNumber: pkg.trackingNumber,
        description: pkg.description,
        maxQty: pkg.quantity || 1,
        splitQty: Math.max(
          1,
          Math.min((pkg.quantity || 1) - 1, pkg.quantity || 1),
        ),
        packagingType: pkg.packagingType,
      })),
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleQtyChange = (index, val) => {
    const updated = [...splitData];
    const num = Math.min(updated[index].maxQty - 1, Math.max(1, Number(val)));
    updated[index].splitQty = num;
    setSplitData(updated);
  };

  const handleConfirmSplit = async () => {
    try {
      setIsSaving(true);
      const splitMap = new Map(
        splitData.map((item) => [item.packageId || item.trackingNumber, item]),
      );
      const usedIds = new Set(
        allPackages
          .map((pkg) => pkg.packageId || pkg.trackingNumber)
          .filter(Boolean),
      );
      let nextSequence =
        allPackages.reduce((max, pkg) => {
          const seq = Number(pkg.sequence);
          return Number.isFinite(seq) ? Math.max(max, seq) : max;
        }, 0) + 1;

      const nextPackageIdentity = () => {
        let packageId = `${shipmentCode}-${String(nextSequence).padStart(2, "0")}`;
        while (usedIds.has(packageId)) {
          nextSequence += 1;
          packageId = `${shipmentCode}-${String(nextSequence).padStart(2, "0")}`;
        }
        usedIds.add(packageId);
        nextSequence += 1;
        return {
          packageId,
          trackingNumber: packageId,
          sequence: nextSequence - 1,
        };
      };

      const updatedPackages = allPackages.flatMap((pkg) => {
        const split = splitMap.get(pkg.packageId || pkg.trackingNumber);
        if (!split) return [pkg];

        const originalQty = Math.max(Number(pkg.quantity) || 1, 1);
        const splitQty = Math.min(
          originalQty - 1,
          Math.max(1, Number(split.splitQty) || 1),
        );
        const remainingQty = originalQty - splitQty;
        const identity = nextPackageIdentity();

        return [
          {
            ...pkg,
            quantity: remainingQty,
            updatedAt: new Date().toISOString(),
          },
          {
            ...pkg,
            ...identity,
            quantity: splitQty,
            loadedQty: 0,
            receivedQty: 0,
            missingQty: 0,
            damagedQty: 0,
            currentTripId: null,
            loadedOnTrip: null,
            parentPackageId: pkg.parentPackageId || pkg.packageId || null,
            splitFromPackageId: pkg.packageId || pkg.trackingNumber || null,
            status: "RECEIVED",
            updatedAt: new Date().toISOString(),
          },
        ];
      });

      await updateShipmentPackages({
        shipmentId: originalShipmentId,
        packages: updatedPackages,
        remarks: "Manual package quantity split from View Packages UI",
      });

      alert("Package quantity split successfully.");
      onSuccess(); // Triggers refresh and closes both modals
    } catch (err) {
      alert("Split failed: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border ${
          isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
        }`}
      >
        <div className="p-6 border-b border-slate-700/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
            <FontAwesomeIcon icon={faArrowsSplitUpAndLeft} />
          </div>
          <div>
            <h3
              className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Split Package Quantity
            </h3>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              Keep the same shipment ID
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
          {splitData.map((item, idx) => (
            <div
              key={item.packageId || item.trackingNumber || idx}
              className={`p-3 rounded-xl border ${
                isDark
                  ? "bg-slate-950/50 border-slate-800"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono text-amber-500">
                  {item.trackingNumber || item.packageId}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    isDark
                      ? "bg-slate-800 text-slate-400"
                      : "bg-white border text-slate-500"
                  }`}
                >
                  {item.packagingType}
                </span>
              </div>
              <p
                className={`text-xs font-bold mb-3 ${isDark ? "text-slate-300" : "text-slate-700"}`}
              >
                {item.description}
              </p>

              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500 font-bold uppercase">
                  Qty to Move:
                </span>
                <input
                  type="number"
                  value={item.splitQty}
                  onChange={(e) => handleQtyChange(idx, e.target.value)}
                  className={`w-24 px-2 py-1 rounded border text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none ${
                    isDark
                      ? "bg-slate-900 border-slate-700 text-white"
                      : "bg-white border-slate-300 text-slate-900"
                  }`}
                />
                <span className="text-[10px] text-slate-500">
                  / {item.maxQty - 1} max
                </span>
              </div>
            </div>
          ))}
        </div>

        <div
          className={`p-6 border-t flex gap-3 ${isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"}`}
        >
          <button
            onClick={onClose}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${
              isDark
                ? "text-slate-400 hover:bg-slate-800"
                : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            Cancel
          </button>
          <button
            disabled={isSaving}
            onClick={handleConfirmSplit}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {isSaving ? (
              <FontAwesomeIcon icon={faCircleNotch} spin />
            ) : (
              "Confirm Split"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
