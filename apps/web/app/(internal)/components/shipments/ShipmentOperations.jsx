"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRoute,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import StatusButton from "../ui/StatusButton";
import NotifyToggle from "../messaging/NotifyToggle";
import { runAction, updatedBy } from "@/app/utility/utilities";
import { SHIPMENT_STATUS } from "@/app/utility/constant/templates";
import { getWidgetThemeClasses } from "@/app/utility/constant/theme";
import { updateShipmentStatus } from "@/app/utility/FirebaseFunctions";

export default function ShipmentOperations({
  shipmentId,
  currentStatus,
  isDark = false,
  onRefresh,
  profile,
}) {
  const [statusSelect, setStatusSelect] = useState("");
  const [remarks, setRemarks] = useState("");
  const [notifySms, setNotifySms] = useState(true);
  const [opStatus, setOpStatus] = useState("IDLE");

  const theme = getWidgetThemeClasses(isDark);

  return (
    <div className={`border rounded-xl p-5 shadow-lg ${theme.container}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3
          className={`text-sm font-bold flex items-center gap-2 ${theme.title}`}
        >
          <FontAwesomeIcon icon={faRoute} className="text-blue-500" />
          Shipment Status Override
        </h3>

        <NotifyToggle
          checked={notifySms}
          onChange={setNotifySms}
          color="blue"
          labelOff="Silent"
        />
      </div>

      <p className={`text-xs mb-4 ${theme.bodyText}`}>
        Manually update the shipment status and optionally notify the customer
        by SMS.
      </p>

      <div className="space-y-3">
        <select
          value={statusSelect}
          onChange={(e) => setStatusSelect(e.target.value)}
          className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 transition-colors ${theme.input}`}
        >
          <option value="">Select New Status...</option>
          {SHIPMENT_STATUS.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.value === currentStatus}
            >
              {option.label} {option.value === currentStatus ? "(Current)" : ""}
            </option>
          ))}
        </select>

        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Reason for manual update (optional)..."
          className={`w-full border rounded-lg p-3 text-sm outline-none focus:border-blue-500 resize-none h-24 ${theme.textarea}`}
        />
      </div>

      {statusSelect === "CANCELLED" && (
        <div
          className={`mt-4 flex items-start gap-2 text-[10px] p-2 rounded ${theme.noteBox}`}
        >
          <FontAwesomeIcon
            icon={faExclamationTriangle}
            className="text-red-500 mt-0.5"
          />
          <span className="text-red-400">
            Warning: Cancelling this shipment will stop all tracking. This
            action is logged.
          </span>
        </div>
      )}

      <div className="mt-4">
        <StatusButton
          status={opStatus}
          label="Update Shipment Status"
          disabled={!statusSelect || opStatus === "LOADING"}
          variant="blue"
          isDark={isDark}
          onClick={() =>
            runAction(
              setOpStatus,
              () =>
                updateShipmentStatus({
                  shipmentId,
                  newStatus: statusSelect,
                  notify: notifySms,
                  remarks,
                  updatedBy: updatedBy(profile),
                }),
              () => {
                setStatusSelect("");
                setRemarks("");
                onRefresh?.();
              },
            )
          }
        />
      </div>
    </div>
  );
}
