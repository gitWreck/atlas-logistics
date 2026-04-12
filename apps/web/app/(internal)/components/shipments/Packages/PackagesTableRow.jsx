"use client";

import React, { useState } from "react";
import ShipmentLabel from "../ShipmentLabel";
import StatusBadge from "../../ui/StatusBadge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faQrcode,
  faEllipsisV,
  faWineGlass,
  faSnowflake,
} from "@fortawesome/free-solid-svg-icons";
import PackageActionModal from "./PackageActionModal";
import { getRowThemeClasses } from "@/app/utility/constant/theme";

export default function PackageTableRow({
  pkg,
  idx,
  shipmentData,
  isDark = false,
}) {
  const [showQR, setShowQR] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);

  const theme = getRowThemeClasses(isDark);

  const sequenceLabel = pkg.sequence || idx + 1;
  const description = pkg.description || "No Description";
  const packagingType = pkg.packagingType || "Package";
  const quantityLabel = pkg.quantity ? `${pkg.quantity} qty` : "N/A";

  const qrButtonClass = showQR
    ? theme.iconActionButtonActive
    : theme.iconActionButton;

  return (
    <>
      <tr className={`transition-colors group ${theme.rowDefaultHover}`}>
        <td className="p-4 text-center">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded border text-xs font-mono font-bold transition-colors ${theme.packageIndexBadge}`}
          >
            {sequenceLabel}
          </span>
        </td>

        <td className="p-4">
          <div className={`font-medium text-sm ${theme.primaryText}`}>
            {description}
          </div>

          <div className={`text-xs ${theme.mutedText}`}>
            {packagingType} • {quantityLabel}
          </div>

          {(pkg.isFragile || pkg.isPerishable) && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {pkg.isFragile && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${theme.fragileBadge}`}
                >
                  <FontAwesomeIcon icon={faWineGlass} className="text-[8px]" />
                  Fragile
                </span>
              )}

              {pkg.isPerishable && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${theme.perishableBadge}`}
                >
                  <FontAwesomeIcon icon={faSnowflake} className="text-[8px]" />
                  Perishable
                </span>
              )}
            </div>
          )}
        </td>

        <td className="p-4">
          <div className={theme.trackingBadge}>{pkg.packageId}</div>
        </td>

        <td className="p-4">
          <StatusBadge status={pkg.status} size="xs" isDark={isDark} />
        </td>

        <td className="p-4 text-right">
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setShowQR((prev) => !prev)}
              className={`w-8 h-8 rounded inline-flex items-center justify-center transition-all ${qrButtonClass}`}
              title="Toggle QR Code"
            >
              <FontAwesomeIcon icon={faQrcode} />
            </button>

            <button
              type="button"
              onClick={() => setShowActionModal(true)}
              className={`w-8 h-8 rounded inline-flex items-center justify-center transition-all ${theme.iconActionButton}`}
              title="Action"
            >
              <FontAwesomeIcon icon={faEllipsisV} />
            </button>
          </div>
        </td>
      </tr>

      {showQR && (
        <tr
          className={`animate-in fade-in zoom-in-95 duration-200 ${theme.expandedRow}`}
        >
          <td colSpan="5" className="p-4">
            <div
              className={`flex items-center gap-6 border rounded-xl p-4 max-w-lg mx-auto shadow-inner ${theme.expandedCard}`}
            >
              <ShipmentLabel
                shipment={shipmentData}
                packages={pkg}
                index={idx}
              />
            </div>
          </td>
        </tr>
      )}

      {showActionModal && (
        <PackageActionModal
          pkg={pkg}
          shipmentId={shipmentData.id}
          onClose={() => setShowActionModal(false)}
          isDark={isDark}
        />
      )}
    </>
  );
}
