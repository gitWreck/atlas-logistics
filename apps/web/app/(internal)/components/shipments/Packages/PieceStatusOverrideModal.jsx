"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faRoute } from "@fortawesome/free-solid-svg-icons";
import { overrideShipmentPieceStatus } from "@/app/utility/FirebaseFunctions";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { PIECE_STATUS_OPTIONS } from "@/app/utility/packageStatus";
import StatusButton from "../../ui/StatusButton";
import StatusBadge from "../../ui/StatusBadge";
import { runAction } from "@/app/utility/utilities";

export default function PieceStatusOverrideModal({
  pkg,
  shipmentId,
  onClose,
  isDark = false,
  onRefresh,
}) {
  const theme = getModalThemeClasses(isDark);
  const [statusSelect, setStatusSelect] = useState("");
  const [opStatus, setOpStatus] = useState("IDLE");

  if (!pkg) return null;

  const pieceId = pkg.packageId || pkg.trackingNumber;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className={`absolute inset-0 ${theme.overlay}`} onClick={onClose} />

      <div
        className={`relative w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${theme.modal}`}
      >
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${theme.header}`}
        >
          <div>
            <h3 className={`font-bold text-base flex items-center gap-2 ${theme.title}`}>
              <FontAwesomeIcon icon={faRoute} className="text-blue-500" />
              Piece Status Override
            </h3>
            <p className={`text-xs mt-1 font-mono text-amber-500`}>{pieceId}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg ${theme.closeButton}`}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className={`text-xs ${theme.bodyText}`}>
            Manually update this piece&apos;s status. The shipment master status
            will be re-derived from all pieces.
          </p>

          <div className="flex items-center gap-2">
            <span className={`text-xs ${theme.label}`}>Current:</span>
            <StatusBadge status={pkg.status} size="xs" isDark={isDark} />
          </div>

          <select
            value={statusSelect}
            onChange={(e) => setStatusSelect(e.target.value)}
            disabled={opStatus === "LOADING"}
            className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors ${theme.input}`}
          >
            <option value="">Select new piece status...</option>
            {PIECE_STATUS_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.value === pkg.status}
              >
                {option.label}
                {option.value === pkg.status ? " (Current)" : ""}
              </option>
            ))}
          </select>

          <StatusButton
            status={opStatus}
            label="Update Piece Status"
            disabled={!statusSelect || opStatus === "LOADING"}
            variant="blue"
            isDark={isDark}
            onClick={() =>
              runAction(
                setOpStatus,
                () =>
                  overrideShipmentPieceStatus({
                    shipmentId,
                    packageId: pieceId,
                    newStatus: statusSelect,
                    sourceUI: "SHIPMENT_DRAWER",
                  }),
                () => {
                  setStatusSelect("");
                  onRefresh?.();
                  onClose?.();
                },
              )
            }
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
