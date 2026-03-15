import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRoute,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { updateShipmentStatus } from "@/app/utility/FirebaseFunctions"; // Ensure this exists
import StatusButton from "../ui/StatusButton";
import { runAction } from "@/app/utility/utilities";
import NotifyToggle from "../messaging/NotifyToggle";

export default function ShipmentOperations({
  shipmentId,
  currentStatus,
  isDark = false,
  onRefresh, // Callback to refresh shipment data after an operation
}) {
  const [statusSelect, setStatusSelect] = useState("");
  const [remarks, setRemarks] = useState("");
  const [notifySms, setNotifySms] = useState(true);
  const [opStatus, setOpStatus] = useState("IDLE");

  console.log("ShipmentOperations Rendered with shipmentId:", shipmentId);
  console.log("Current Status:", currentStatus);
  console.log("Selected Status:", statusSelect);

  const STATUS_OPTIONS = [
    { value: "PENDING_PICKUP", label: "Pending Pickup" },
    { value: "PICKED_UP", label: "Picked Up" },
    { value: "RECEIVED", label: "Received at Hub" },
    { value: "LOADED", label: "Loaded on Truck" },
    { value: "IN_TRANSIT", label: "In Transit" },
    // { value: "ARRIVED", label: "Arrived at Destination" },
    { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
    { value: "DELIVERED", label: "Delivered" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  return (
    <div className="space-y-4">
      <div
        className={`border rounded-xl p-4 flex flex-col gap-4 shadow-sm ${
          isDark
            ? "bg-slate-900/50 border-slate-800"
            : "bg-slate-50 border-slate-200"
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center">
          <h4
            className={`text-xs font-bold uppercase flex items-center gap-2 ${
              isDark ? "text-slate-500" : "text-slate-600"
            }`}
          >
            <FontAwesomeIcon icon={faRoute} /> Status Override
          </h4>
          <NotifyToggle
            checked={notifySms}
            onChange={setNotifySms}
            color="blue"
            labelOff="Silent"
          />
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <select
            value={statusSelect}
            onChange={(e) => setStatusSelect(e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 transition-colors ${
              isDark
                ? "bg-slate-950 border-slate-700 text-white"
                : "bg-white border-slate-300 text-slate-900"
            }`}
          >
            <option value="">Select New Status...</option>
            {STATUS_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.value === currentStatus}
              >
                {opt.label} {opt.value === currentStatus ? "(Current)" : ""}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Reason for manual update (Optional)..."
            className={`w-full border rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500 ${
              isDark
                ? "bg-slate-950 border-slate-700 text-white"
                : "bg-white border-slate-300 text-slate-900"
            }`}
          />
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2 border-t border-dashed border-slate-700/50">
          <div className="w-full sm:w-32">
            <StatusButton
              status={opStatus}
              label="Update"
              disabled={!statusSelect || opStatus === "LOADING"}
              onClick={() =>
                runAction(
                  setOpStatus,
                  () =>
                    updateShipmentStatus({
                      shipmentId,
                      newStatus: statusSelect,
                      notify: notifySms,
                      remarks: remarks,
                    }),
                  () => {
                    setStatusSelect("");
                    setRemarks("");
                    if (onRefresh) onRefresh();
                  },
                )
              }
            />
          </div>
        </div>
      </div>

      {/* Warning for Critical Actions */}
      {statusSelect === "CANCELLED" && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-in slide-in-from-top-2">
          <FontAwesomeIcon
            icon={faExclamationTriangle}
            className="text-red-500"
          />
          <p className="text-[10px] text-red-400 font-medium leading-tight">
            Warning: Cancelling this shipment will stop all tracking. This
            action is logged.
          </p>
        </div>
      )}
    </div>
  );
}
