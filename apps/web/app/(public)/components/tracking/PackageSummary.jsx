"use client";

import React, { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faCopy,
  faTruck,
  faBox,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { getPackageStatusLabel } from "@/app/utility/packageStatus";

function formatPackageLabel(pkg = {}, index = 0) {
  const sequence = Number(pkg.sequence);
  if (Number.isFinite(sequence) && sequence > 0) {
    return `Package ${String(sequence).padStart(2, "0")}`;
  }

  const packageId = String(pkg.packageId || "").trim();
  const suffixMatch = packageId.match(/-(\d{2})$/);
  if (suffixMatch) {
    return `Package ${suffixMatch[1]}`;
  }

  return `Package ${String(index + 1).padStart(2, "0")}`;
}

function isDelivered(pkg = {}) {
  const code = String(pkg.statusCode || pkg.status || "")
    .toUpperCase()
    .replace(/\s+/g, "_");
  return code === "DELIVERED" || code === "COMPLETED";
}

function isOutForDelivery(pkg = {}) {
  const code = String(pkg.statusCode || pkg.status || "")
    .toUpperCase()
    .replace(/\s+/g, "_");
  return [
    "OUT_FOR_DELIVERY",
    "LOADED_TO_DELIVERY_VEHICLE",
    "READY_FOR_DELIVERY",
    "PARTIALLY_OUT_FOR_DELIVERY",
  ].includes(code);
}

function PackageStatusIcon({ pkg }) {
  if (isDelivered(pkg)) {
    return (
      <FontAwesomeIcon icon={faCheck} className="text-emerald-600 text-sm" />
    );
  }

  if (isOutForDelivery(pkg)) {
    return <FontAwesomeIcon icon={faTruck} className="text-purple-600 text-sm" />;
  }

  return <FontAwesomeIcon icon={faBox} className="text-slate-400 text-sm" />;
}

export default function PackageSummary({
  shipmentId,
  packages = [],
  highlightedPackageId = null,
}) {
  const [copied, setCopied] = useState(false);

  const visiblePackages = useMemo(
    () =>
      packages.filter((pkg) => String(pkg.packageId || "").trim()),
    [packages],
  );

  const highlightedPackage = useMemo(() => {
    if (!highlightedPackageId) return null;
    return (
      visiblePackages.find(
        (pkg) =>
          String(pkg.packageId || "").trim().toUpperCase() ===
          String(highlightedPackageId).trim().toUpperCase(),
      ) || null
    );
  }, [visiblePackages, highlightedPackageId]);

  const deliveredCount = visiblePackages.filter(isDelivered).length;
  const showPackageFocus = Boolean(highlightedPackage);

  const handleCopy = async () => {
    if (!shipmentId) return;
    try {
      await navigator.clipboard.writeText(shipmentId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable in some browsers.
    }
  };

  if (!visiblePackages.length) return null;

  return (
    <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Shipment
            </div>
            <div className="mt-1 break-all font-mono text-sm font-bold text-slate-950">
              {shipmentId}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            title={copied ? "Copied" : "Copy shipment ID"}
            aria-label="Copy shipment ID"
          >
            <FontAwesomeIcon icon={faCopy} className="text-sm" />
          </button>
        </div>

        {showPackageFocus && (
          <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50/70 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-purple-700">
              Viewing
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {formatPackageLabel(highlightedPackage)}
            </div>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Package Status
            </div>
            <div className="mt-1 text-sm font-semibold text-purple-800">
              {getPackageStatusLabel(highlightedPackage)}
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {showPackageFocus
              ? `Other Packages (${visiblePackages.length})`
              : `Packages (${visiblePackages.length})`}
          </div>

          <ul className="mt-3 space-y-2">
            {visiblePackages.map((pkg, index) => {
              const packageId = String(pkg.packageId || "").trim();
              const isHighlighted =
                highlightedPackageId &&
                packageId.toUpperCase() ===
                  String(highlightedPackageId).trim().toUpperCase();

              return (
                <li
                  key={packageId || index}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    isHighlighted
                      ? "border-purple-300 bg-purple-50/80"
                      : "border-slate-200 bg-slate-50/70"
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white">
                    {isHighlighted ? (
                      <FontAwesomeIcon
                        icon={faChevronRight}
                        className="text-purple-600 text-sm"
                      />
                    ) : (
                      <PackageStatusIcon pkg={pkg} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">
                      {formatPackageLabel(pkg, index)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {getPackageStatusLabel(pkg)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {visiblePackages.length > 1 && (
          <div className="mt-4 border-t border-slate-200 pt-3 text-xs font-semibold text-slate-600">
            {deliveredCount} of {visiblePackages.length} packages delivered
          </div>
        )}
      </div>
    </div>
  );
}
