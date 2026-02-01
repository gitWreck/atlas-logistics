import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPause,
  faPlay,
  faTruckFast,
} from "@fortawesome/free-solid-svg-icons";
import {
  assignShipmentToTruckTrip,
  clearTruckDelay,
  setTruckDelay,
  updateTripStatus, // <--- New function needed for Status Change
} from "@/app/utility/FirebaseFunctions";
import StatusButton from "../ui/StatusButton"; // Ensure path
import { runAction } from "@/app/utility/utilities"; // Ensure path

export default function TripOperations({ tripId, isLocked, onSuccess }) {
  // --- INTERNAL STATE ---
  const [assignId, setAssignId] = useState("");
  const [delaySelect, setDelaySelect] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [statusSelect, setStatusSelect] = useState("");

  // --- INTERNAL LOADING STATES ---
  const [assignStatus, setAssignStatus] = useState("IDLE");
  const [delayStatus, setDelayStatus] = useState("IDLE");
  const [clearStatus, setClearStatus] = useState("IDLE");
  const [statusChangeStatus, setStatusChangeStatus] = useState("IDLE"); // New

  return (
    <div className="space-y-6">
      {/* 1. MANUAL ASSIGNMENT CARD */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
        <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
          <FontAwesomeIcon icon={faPlus} /> Manual Assignment
        </h4>
        <div className="flex gap-2">
          <input
            value={assignId}
            onChange={(e) => setAssignId(e.target.value)}
            placeholder="Paste Shipment ID..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors"
            disabled={isLocked}
            onKeyDown={(e) => {
              if (e.key === "Enter" && assignId) {
                // Trigger click logic
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
                    assignShipmentToTruckTrip({
                      trackingDocId: assignId,
                      truckTripId: tripId,
                    }),
                  () => {
                    setAssignId("");
                    if (onSuccess) onSuccess();
                  },
                )
              }
              disabled={isLocked || !assignId}
              icon={faPlus}
              label="Add"
              loadingLabel="..."
              successLabel="Done"
              errorLabel="X"
            />
          </div>
        </div>
      </div>

      {/* 2. STATUS CONTROL (NEW: Change Trip Status) */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
        <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
          <FontAwesomeIcon icon={faTruckFast} /> Force Status Change
        </h4>
        <div className="flex gap-2">
          <select
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none"
            value={statusSelect}
            onChange={(e) => setStatusSelect(e.target.value)}
          >
            <option value="">Select Status...</option>
            <option value="PLANNED">Planned</option>
            <option value="LOADED">Loaded</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <div className="w-24">
            <StatusButton
              status={statusChangeStatus}
              label="Update"
              icon={faTruckFast}
              disabled={!statusSelect}
              onClick={() =>
                runAction(
                  setStatusChangeStatus,
                  () => updateTripStatus({ tripId, status: statusSelect }), // You need to implement this backend function
                  () => {
                    setStatusSelect("");
                    if (onSuccess) onSuccess();
                  },
                )
              }
            />
          </div>
        </div>
      </div>

      {/* 3. DELAY CONTROLS */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
        <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
          <FontAwesomeIcon icon={faPause} /> Delay Controls
        </h4>

        {/* Delay Reason Selector */}
        <select
          value={delaySelect}
          onChange={(e) => setDelaySelect(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
        >
          <option value="">Select Reason...</option>
          <option value="WEATHER">Weather</option>
          <option value="MECHANICAL">Mechanical</option>
          <option value="PORT_CONGESTION">Port Congestion</option>
          <option value="TRAFFIC">Heavy Traffic</option>
          <option value="OTHER">Other / Custom...</option>
        </select>

        {/* Custom Reason Input */}
        {delaySelect === "OTHER" && (
          <input
            type="text"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Type specific reason..."
            className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
          />
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 mt-1">
          <div className="flex-1">
            <StatusButton
              status={delayStatus}
              icon={faPause}
              label="Set Delay"
              idleColor="bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-500/30"
              onClick={() => {
                const finalReason =
                  delaySelect === "OTHER" ? customReason : delaySelect;
                if (!finalReason) return;
                runAction(
                  setDelayStatus,
                  () =>
                    setTruckDelay({ truckTripId: tripId, reason: finalReason }),
                  () => {
                    setDelaySelect("");
                    setCustomReason("");
                    if (onSuccess) onSuccess();
                  },
                );
              }}
              disabled={
                !delaySelect ||
                (delaySelect === "OTHER" && !customReason.trim())
              }
            />
          </div>

          <div className="flex-1">
            <StatusButton
              status={clearStatus}
              onClick={() =>
                runAction(
                  setClearStatus,
                  () => clearTruckDelay({ truckTripId: tripId }),
                  () => {
                    setDelaySelect("");
                    setCustomReason("");
                    if (onSuccess) onSuccess();
                  },
                )
              }
              icon={faPlay}
              label="Clear Delay"
              loadingLabel="Clearing..."
              successLabel="Cleared!"
              idleColor="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
