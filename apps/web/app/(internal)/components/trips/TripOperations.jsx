"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPlay,
  faPause,
  faTruckFast,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import {
  assignShipmentToTrip,
  updateTripStatus,
  clearTruckDelay,
  setTruckDelay,
} from "@/app/utility/FirebaseFunctions";
import StatusButton from "../ui/StatusButton";
import NotifyToggle from "../messaging/NotifyToggle";
import { runAction, updatedBy } from "@/app/utility/utilities";
import { getWidgetThemeClasses } from "@/app/utility/constant/theme";

export default function TripOperations({
  tripId,
  isLocked,
  onSuccess,
  isDark = false,
  profile,
}) {
  const [assignId, setAssignId] = useState("");
  const [delaySelect, setDelaySelect] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [statusSelect, setStatusSelect] = useState("");

  const [assignStatus, setAssignStatus] = useState("IDLE");
  const [delayStatus, setDelayStatus] = useState("IDLE");
  const [clearStatus, setClearStatus] = useState("IDLE");
  const [statusChangeStatus, setStatusChangeStatus] = useState("IDLE");

  const [notifySms, setNotifySms] = useState(true);
  const [notifyDelay, setNotifyDelay] = useState(true);

  const theme = getWidgetThemeClasses(isDark);

  return (
    <div className="space-y-4">
      {/* Manual Assignment */}
      <div className={`border rounded-xl p-5 shadow-lg ${theme.container}`}>
        <h3
          className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme.title}`}
        >
          <FontAwesomeIcon icon={faPlus} className="text-blue-500" />
          Manual Assignment
        </h3>

        <p className={`text-xs mb-4 ${theme.bodyText}`}>
          Add a shipment directly to this trip by entering its shipment ID.
        </p>

        <div className="flex gap-2">
          <input
            value={assignId}
            onChange={(e) => setAssignId(e.target.value.trim())}
            placeholder="Shipment ID..."
            className={`flex-1 border rounded-lg px-3 py-2.5 text-sm focus:border-blue-500 outline-none ${theme.input}`}
            disabled={isLocked}
            onKeyDown={(e) => {
              if (e.key === "Enter" && assignId) {
                e.preventDefault();
              }
            }}
          />

          <div className="w-24">
            <StatusButton
              status={assignStatus}
              onClick={() =>
                runAction(
                  setAssignStatus,
                  () =>
                    assignShipmentToTrip({
                      trackingShipmentId: assignId,
                      tripId: tripId,
                      updatedBy: updatedBy(profile),
                    }),
                  () => {
                    setAssignId("");
                    onSuccess?.();
                  },
                )
              }
              disabled={isLocked || !assignId}
              icon={faPlus}
              label="Add"
              loadingLabel="..."
              successLabel="OK"
              errorLabel="X"
            />
          </div>
        </div>

        <div
          className={`mt-3 flex items-start gap-2 text-[10px] p-2 rounded ${theme.noteBox}`}
        >
          <FontAwesomeIcon
            icon={faExclamationTriangle}
            className="text-slate-600 mt-0.5"
          />
          <span>
            Make sure the shipment is valid and still eligible for assignment
            before adding it to the trip.
          </span>
        </div>
      </div>

      {/* Force Status */}
      <div className={`border rounded-xl p-5 shadow-lg ${theme.container}`}>
        <h3
          className={`text-sm font-bold mb-3 flex items-center justify-between gap-2 ${theme.title}`}
        >
          <span className="flex items-center gap-2">
            <FontAwesomeIcon icon={faTruckFast} className="text-blue-500" />
            Force Status
          </span>

          <NotifyToggle
            checked={notifySms}
            onChange={setNotifySms}
            color="emerald"
            labelOff="Silent Update"
          />
        </h3>

        <p className={`text-xs mb-4 ${theme.bodyText}`}>
          Override the current trip status and optionally notify customers.
        </p>

        <div className="flex gap-2">
          <select
            className={`flex-1 border rounded-lg px-3 py-2.5 text-sm focus:border-blue-500 outline-none ${theme.input}`}
            value={statusSelect}
            onChange={(e) => setStatusSelect(e.target.value)}
          >
            <option value="">Select Status...</option>
            <option value="CREATED">Created</option>
            <option value="LOADING">Loading</option>
            <option value="LOADED">Loaded</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="ARRIVED">Arrived</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <div className="w-24">
            <StatusButton
              status={statusChangeStatus}
              label="Set"
              icon={faTruckFast}
              disabled={!statusSelect}
              onClick={() =>
                runAction(
                  setStatusChangeStatus,
                  () =>
                    updateTripStatus({
                      tripId,
                      status: statusSelect,
                      notify: notifySms,
                      updatedBy: updatedBy(profile),
                    }),
                  () => {
                    setStatusSelect("");
                    setNotifySms(true);
                    onSuccess?.();
                  },
                )
              }
            />
          </div>
        </div>
      </div>

      {/* Delay Controls */}
      <div className={`border rounded-xl p-5 shadow-lg ${theme.container}`}>
        <h3
          className={`text-sm font-bold mb-3 flex items-center justify-between gap-2 ${theme.title}`}
        >
          <span className="flex items-center gap-2">
            <FontAwesomeIcon icon={faPause} className="text-amber-500" />
            Delay Controls
          </span>

          <NotifyToggle
            checked={notifyDelay}
            onChange={setNotifyDelay}
            color="amber"
            labelOff="Silent Log"
          />
        </h3>

        <p className={`text-xs mb-4 ${theme.bodyText}`}>
          Mark the trip as delayed, log a reason, or clear the active delay.
        </p>

        <div className="flex gap-2">
          <select
            value={delaySelect}
            onChange={(e) => setDelaySelect(e.target.value)}
            className={`flex-1 border rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 outline-none ${theme.input}`}
          >
            <option value="">Select Reason...</option>
            <option value="WEATHER">Weather</option>
            <option value="MECHANICAL">Mechanical</option>
            <option value="PORT_CONGESTION">Port Congestion</option>
            <option value="TRAFFIC">Heavy Traffic</option>
            <option value="OTHER">Other / Custom...</option>
          </select>

          <div className="flex gap-2 shrink-0">
            <div className="w-24">
              <StatusButton
                status={delayStatus}
                icon={faPause}
                label="Set Delay"
                variant="amber"
                onClick={() => {
                  const finalReason =
                    delaySelect === "OTHER" ? customReason : delaySelect;

                  if (!finalReason) return;

                  runAction(
                    setDelayStatus,
                    () =>
                      setTruckDelay({
                        tripId: tripId,
                        reason: finalReason,
                        notify: notifyDelay,
                        updatedBy: updatedBy(profile),
                      }),
                    () => {
                      setDelaySelect("");
                      setCustomReason("");
                      setNotifyDelay(true);
                      onSuccess?.();
                    },
                  );
                }}
                disabled={
                  !delaySelect ||
                  (delaySelect === "OTHER" && !customReason.trim())
                }
              />
            </div>

            <div className="w-24">
              <StatusButton
                status={clearStatus}
                icon={faPlay}
                label="Clear"
                loadingLabel="..."
                successLabel="OK"
                variant="emerald"
                onClick={() =>
                  runAction(
                    setClearStatus,
                    () =>
                      clearTruckDelay({
                        tripId: tripId,
                        notify: notifyDelay,
                        updatedBy: updatedBy(profile),
                      }),
                    () => {
                      setDelaySelect("");
                      setCustomReason("");
                      setNotifyDelay(true);
                      onSuccess?.();
                    },
                  )
                }
              />
            </div>
          </div>
        </div>

        {delaySelect === "OTHER" && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200 mt-3">
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Type specific reason..."
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 outline-none ${theme.warningInput}`}
            />
          </div>
        )}

        <div
          className={`mt-3 flex items-start gap-2 text-[10px] p-2 rounded ${theme.noteBox}`}
        >
          <FontAwesomeIcon
            icon={faExclamationTriangle}
            className="text-slate-600 mt-0.5"
          />
          <span>
            Delay notifications can be sent to customers, or logged silently for
            internal tracking only.
          </span>
        </div>
      </div>
    </div>
  );
}
