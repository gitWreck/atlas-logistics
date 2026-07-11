"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faSnowflake,
  faWineGlass,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../ui/StatusBadge";
import { resolvePublicPackageDescription } from "@/lib/publicTrackingPackages";

const ITEMS_PER_PAGE = 5;

function PieceRow({ pkg, rowNumber }) {
  const trackingNo = pkg.trackingNumber || pkg.packageId || "—";
  const description =
    resolvePublicPackageDescription(pkg) ||
    pkg.trackingNumber ||
    pkg.packageId ||
    "—";
  const packagingType = pkg.packagingType || "Package";
  const quantityLabel = pkg.quantity ? `${pkg.quantity} qty` : "1 qty";

  return (
    <tr className="transition-colors hover:bg-slate-50/80">
      <td className="px-4 py-3 text-center">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-slate-100 text-xs font-mono font-bold text-slate-600">
          {pkg.sequence || rowNumber}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-slate-900">{description}</div>
        <div className="text-xs text-slate-500">
          {packagingType} • {quantityLabel}
        </div>
        {(pkg.isFragile || pkg.isPerishable) && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {pkg.isFragile && (
              <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                <FontAwesomeIcon icon={faWineGlass} className="text-[8px]" />
                Fragile
              </span>
            )}
            {pkg.isPerishable && (
              <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-700">
                <FontAwesomeIcon icon={faSnowflake} className="text-[8px]" />
                Perishable
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="w-fit rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 font-mono text-xs text-amber-700">
          {trackingNo}
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={pkg.status} compact />
      </td>
    </tr>
  );
}

function PieceCard({ pkg, rowNumber }) {
  const trackingNo = pkg.trackingNumber || pkg.packageId || "—";
  const description =
    resolvePublicPackageDescription(pkg) ||
    pkg.trackingNumber ||
    pkg.packageId ||
    "—";
  const packagingType = pkg.packagingType || "Package";
  const quantityLabel = pkg.quantity ? `${pkg.quantity} qty` : "1 qty";

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-slate-100 text-xs font-mono font-bold text-slate-600">
            {pkg.sequence || rowNumber}
          </span>
          <div>
            <div className="text-sm font-medium text-slate-900">{description}</div>
            <div className="text-xs text-slate-500">
              {packagingType} • {quantityLabel}
            </div>
          </div>
        </div>
        <StatusBadge status={pkg.status} compact />
      </div>
      <div className="w-fit rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 font-mono text-xs text-amber-700">
        {trackingNo}
      </div>
    </div>
  );
}

export default function PublicShipmentPieces({ packages = [], loading = false }) {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [packages]);

  const totalPages = Math.max(1, Math.ceil(packages.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const currentPackages = useMemo(
    () => packages.slice(startIndex, startIndex + ITEMS_PER_PAGE),
    [packages, startIndex],
  );

  if (!loading && packages.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-slate-200 px-6 py-5">
      <div className="mb-3 text-[10px] font-bold uppercase text-slate-500">
        Shipment pieces
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Loading pieces...
          </div>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="w-12 px-4 py-3 text-center">#</th>
                    <th className="px-4 py-3">Item Details</th>
                    <th className="px-4 py-3">Tracking No.</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {currentPackages.map((pkg, index) => (
                    <PieceRow
                      key={pkg.packageId || `${startIndex + index}`}
                      pkg={pkg}
                      rowNumber={startIndex + index + 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-200 sm:hidden">
              {currentPackages.map((pkg, index) => (
                <PieceCard
                  key={pkg.packageId || `${startIndex + index}`}
                  pkg={pkg}
                  rowNumber={startIndex + index + 1}
                />
              ))}
            </div>

            {packages.length > 0 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:flex-row">
                <span>
                  Showing{" "}
                  <span className="font-bold text-slate-700">
                    {startIndex + 1}
                  </span>
                  -
                  <span className="font-bold text-slate-700">
                    {Math.min(startIndex + ITEMS_PER_PAGE, packages.length)}
                  </span>{" "}
                  of {packages.length}
                </span>

                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((page) => Math.max(1, page - 1))
                      }
                      disabled={safePage === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Previous page"
                    >
                      <FontAwesomeIcon icon={faChevronLeft} size="xs" />
                    </button>

                    <div className="flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">
                      Page {safePage} of {totalPages}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
                      disabled={safePage === totalPages}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Next page"
                    >
                      <FontAwesomeIcon icon={faChevronRight} size="xs" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
