"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBarcode } from "@fortawesome/free-solid-svg-icons";

export default function ManifestPanel({
  item,
  action,
  quantities,
  setQuantities,
  theme,
}) {
  const isShipment = item.scanType === "SHIPMENT";
  const getPackageKey = (pkg) => pkg?.packageId || pkg?.trackingNumber || "";
  const isScannedPackage = (pkg) => {
    const target = String(item.packageId || item.trackingNumber || "").trim();
    return (
      target &&
      [pkg?.packageId, pkg?.trackingNumber]
        .map((value) => String(value || "").trim())
        .includes(target)
    );
  };

  const displayPackages = isShipment
    ? item.packages || []
    : item.packages?.filter(isScannedPackage) || [];

  const getAvailableForPkg = (pkg) => {
    const totalQty = Math.max(Number(pkg?.quantity) || 1, 1);
    const rawLoadedQty = Number(pkg?.loadedQty);
    const hasLoadedQty = Number.isFinite(rawLoadedQty) && rawLoadedQty >= 0;
    const status = String(pkg?.status || "").toUpperCase();
    const loadedQty = Math.min(
      hasLoadedQty
        ? rawLoadedQty
        : status === "LOADED" || status === "DELIVERED"
          ? totalQty
          : 0,
      totalQty,
    );

    if (action === "LOAD") return Math.max(0, totalQty - loadedQty);
    return Math.max(0, loadedQty);
  };

  const handleQtyChange = (pkgId, value, maxAllowed) => {
    let num = parseInt(value, 10);
    if (isNaN(num) || num < 0) num = 0;
    if (num > maxAllowed) num = maxAllowed;
    setQuantities((prev) => ({ ...prev, [pkgId]: num }));
  };

  const handleAddAll = () => {
    const maxedOut = {};
    displayPackages.forEach((pkg) => {
      const packageKey = getPackageKey(pkg);
      if (packageKey) maxedOut[packageKey] = getAvailableForPkg(pkg);
    });
    setQuantities(maxedOut);
  };

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl border p-4 flex justify-between items-start gap-2 ${theme.panelSurface}`}
      >
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase opacity-50 flex items-center gap-2">
            <FontAwesomeIcon icon={faBarcode} /> {item.scanType}
          </div>
          <h3 className={`font-bold text-lg truncate ${theme.title}`}>
            {item.label}
          </h3>
          <div className="text-xs opacity-60 mt-1 truncate">
            Dest: {item.destination}
          </div>
        </div>
        <button
          onClick={handleAddAll}
          className="shrink-0 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
        >
          Add All Available
        </button>
      </div>

      <div
        className={`rounded-xl border overflow-hidden ${theme.panelSurface}`}
      >
        <div className="bg-black/10 p-3 border-b border-white/5 text-[10px] font-bold uppercase opacity-60">
          Manifest ({displayPackages.length} Items)
        </div>
        <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
          {displayPackages.map((pkg) => {
            const packageKey = getPackageKey(pkg);
            const available = getAvailableForPkg(pkg);
            const currentVal = quantities[packageKey] || "";
            const isFullyProcessed = available <= 0;
            const totalQty = Math.max(Number(pkg.quantity) || 1, 1);

            return (
              <div
                key={packageKey}
                className="p-3 flex justify-between items-center gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-mono font-bold truncate">
                    {packageKey}
                  </div>
                  <div className="flex gap-2 text-[10px] opacity-60 mt-0.5">
                    <span>Tot: {totalQty}</span> •{" "}
                    <span
                      className={
                        isFullyProcessed ? "text-amber-500" : "text-green-500"
                      }
                    >
                      {available} avail
                    </span>
                  </div>
                </div>
                <div className="w-20 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max={available}
                    disabled={isFullyProcessed}
                    value={currentVal}
                    onChange={(e) =>
                      handleQtyChange(packageKey, e.target.value, available)
                    }
                    placeholder="0"
                    className={`w-full rounded-lg border px-2 py-2 text-center font-bold text-sm transition-colors ${isFullyProcessed ? "opacity-30 bg-gray-500/10" : theme.input}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
