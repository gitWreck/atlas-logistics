import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock, faUnlock, faPrint } from "@fortawesome/free-solid-svg-icons";
import StatusButton from "../ui/StatusButton";
import {
  generateTripManifest,
  reopenTrip,
} from "@/app/utility/FirebaseFunctions";
import { runAction } from "@/app/utility/utilities";
import ExportTripButton from "../exports/ExportTripManifest";

export default function TripDrawerFooter({ data, onClose, shipments }) {
  const [lockStatus, setLockStatus] = useState("IDLE");

  // Safety Check
  if (!data) return null;

  // Determine current state of the trip document
  const isLocked = data.manifestLocked;
  const isCertified = !!data.certificate; // Assuming 'certificate' field exists if generated

  // Helper for non-StatusButton actions (simple async wrapper)
  const handleAction = async (actionType) => {
    console.log(`Action Triggered: ${actionType} for Trip ID: ${data.tripId}`);
    try {
      if (actionType === "reopenTrip") {
        if (
          !confirm(
            "Are you sure? This will invalidate the current certificate.",
          )
        )
          return;
        await reopenTrip({ tripDocId: data.tripId });
      }
      // Ideally, trigger a data refresh here
    } catch (e) {
      console.error(e);
      alert("Action failed: " + e.message);
    }
  };

  return (
    <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-3">
      {/* ROW 1: LIFE CYCLE ACTIONS (Lock -> Certify -> Reopen) */}
      <div className="flex gap-3">
        {/* 1. LOCK MANIFEST */}
        <StatusButton
          status={lockStatus}
          label="Lock Manifest"
          icon={faLock}
          idleColor="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30"
          disabled={isLocked}
          onClick={() =>
            runAction(
              setLockStatus,
              () => generateTripManifest({ tripDocId: data.tripId }),
              () => {
                /* Optional Success Callback */
              },
            )
          }
        />

        {/* 3. REOPEN TRIP */}
        <button
          disabled={!isLocked}
          onClick={() => handleAction("reopenTrip")}
          className="flex-1 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-600/20 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex justify-center items-center gap-2"
        >
          <FontAwesomeIcon icon={faUnlock} /> Reopen
        </button>
      </div>

      {/* ROW 2: REPORTING & PRINTING */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            // Opens the manifest page in a new tab
            window.open(
              `/components/print/manifest?tripId=${data.tripId}`,
              "_blank",
            );
          }}
          className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          <FontAwesomeIcon icon={faPrint} /> Print Manifest
        </button>

        {/* <button className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
          <FontAwesomeIcon icon={faFilePdf} /> Trip Report
        </button> */}
        <ExportTripButton trip={data} shipments={shipments} />
      </div>
    </div>
  );
}
