"use client";

import React, { useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBarcode } from "@fortawesome/free-solid-svg-icons";

export default function ManifestPanel({
  item,
  action,
  scanStatus,
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

  const displayPackages = useMemo(
    () =>
      isShipment
        ? item.packages || []
        : item.packages?.filter(isScannedPackage) || [],
    [isShipment, item.packages, item.packageId, item.trackingNumber],
  );

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

    if (scanStatus === "MISSING" || scanStatus === "DAMAGED") {
      return action === "LOAD"
        ? Math.max(0, totalQty - loadedQty)
        : Math.max(0, loadedQty);
    }

    if (action === "LOAD") return Math.max(0, totalQty - loadedQty);
    return Math.max(0, loadedQty);
  };

  useEffect(() => {
    if (!item) return;

    const autoQuantities = {};
    displayPackages.forEach((pkg) => {
      const packageKey = getPackageKey(pkg);
      const available = getAvailableForPkg(pkg);
      if (packageKey && available > 0) {
        autoQuantities[packageKey] = available;
      }
    });
    setQuantities(autoQuantities);
  }, [displayPackages, action, scanStatus, setQuantities]);

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${theme.panelSurface}`}>
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
            const qtyToProcess = quantities[packageKey] ?? available;
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
                <div
                  className={`w-14 shrink-0 text-center text-lg font-bold tabular-nums ${isFullyProcessed ? "opacity-30" : ""}`}
                >
                  {isFullyProcessed ? "—" : qtyToProcess}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
