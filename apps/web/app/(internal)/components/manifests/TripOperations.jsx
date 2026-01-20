import React, { useState } from "react";
import { faPlus, faPause, faPlay } from "@fortawesome/free-solid-svg-icons";
import {
  assignShipmentToTruckTrip,
  clearTruckDelay,
  setTruckDelay,
} from "@/app/utility/FirebaseFunctions";
import StatusButton from "../ui/StatusButton";
import { runAction } from "@/app/utility/utilities";

export default function TripOperations({ tripId, isLocked, onSuccess }) {
  // --- INTERNAL STATE (Parent doesn't need to know this) ---
  const [assignId, setAssignId] = useState("");
  const [delaySelect, setDelaySelect] = useState("");
  const [customReason, setCustomReason] = useState("");

  // --- INTERNAL LOADING STATES ---
  const [assignStatus, setAssignStatus] = useState("IDLE");
  const [delayStatus, setDelayStatus] = useState("IDLE");
  const [clearStatus, setClearStatus] = useState("IDLE");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
      {/* ASSIGNMENT CARD */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
        <h4 className="text-xs font-bold text-slate-500 uppercase">
          Manual Assignment
        </h4>
        <input
          value={assignId}
          onChange={(e) => setAssignId(e.target.value)}
          placeholder="Paste Shipment ID..."
          className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-blue-500"
          disabled={isLocked}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            runAction(
              setAssignStatus,
              () =>
                assignShipmentToTruckTrip({
                  trackingDocId: assignId,
                  truckTripId: tripId,
                }),
              () => setAssignId(""),
            )
          }
        />
        <div className="flex gap-2">
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
                  onSuccess();
                },
              )
            }
            disabled={isLocked || !assignId}
            icon={faPlus}
            label="Assign"
            loadingLabel="Assigning..."
            successLabel="Assigned!"
            errorLabel="Failed"
          />
        </div>
      </div>

      {/* DELAY CARD */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
        <h4 className="text-xs font-bold text-slate-500 uppercase">
          Delay Controls
        </h4>
        <select
          value={delaySelect}
          onChange={(e) => setDelaySelect(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:border-amber-500 outline-none"
        >
          <option value="">Select Reason...</option>
          <option value="WEATHER">Weather</option>
          <option value="MECHANICAL">Mechanical</option>
          <option value="PORT_CONGESTION">Port Congestion</option>
          <option value="TRAFFIC">Heavy Traffic</option>
          <option value="OTHER">Other / Custom...</option> {/* NEW OPTION */}
        </select>

        {delaySelect === "OTHER" && (
          <input
            type="text"
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Type specific reason..."
            className="w-full bg-slate-950 border border-amber-500/50 rounded p-2 text-xs text-white"
          />
        )}

        <div className="flex gap-2">
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
                  onSuccess();
                },
              );
            }}
            disabled={
              !delaySelect || (delaySelect === "OTHER" && !customReason.trim())
            }
          />
          <StatusButton
            status={clearStatus}
            onClick={() =>
              runAction(
                setClearStatus,
                () => clearTruckDelay({ truckTripId: tripId }),
                () => {
                  setDelaySelect("");
                  setCustomReason("");
                  onSuccess();
                },
              )
            }
            icon={faPlay}
            label="Clear"
            loadingLabel="Clearing..."
            successLabel="Cleared!"
            idleColor="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30"
          />
        </div>
      </div>
    </div>
  );
}
