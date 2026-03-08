import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLock,
  faUnlock,
  faPrint,
  faTimes,
  faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";
import StatusButton from "../ui/StatusButton";
import {
  generateTripManifest,
  reopenTrip,
  unlockTripManifest,
} from "@/app/utility/FirebaseFunctions";
import { runAction } from "@/app/utility/utilities";
import ExportTripButton from "../exports/ExportTripManifest";

export default function TripDrawerFooter({
  data,
  onClose,
  shipments,
  isDark = false,
  onSuccess,
}) {
  // --- Loading States for StatusButtons ---
  const [lockStatus, setLockStatus] = useState("IDLE");
  const [unlockStatus, setUnlockStatus] = useState("IDLE");
  const [reopenStatus, setReopenStatus] = useState("IDLE");

  // --- UI States for Unlock Reason ---
  const [showUnlockReason, setShowUnlockReason] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

  if (!data) return null;

  const isLocked = data.manifestLocked;

  // Helper to reset unlock UI after success
  const handleUnlockSuccess = () => {
    setTimeout(() => {
      setShowUnlockReason(false);
      setUnlockReason("");
    }, 1500);
  };

  return (
    <div
      className={`p-4 border-t flex flex-col gap-3 ${
        isDark
          ? "border-slate-800 bg-slate-950"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      {/* 1. CONDITIONAL UNLOCK REASON TEXTAREA */}
      {showUnlockReason && (
        <div
          className={`p-3 rounded-xl border animate-in slide-in-from-bottom-2 duration-200 ${
            isDark
              ? "bg-slate-900 border-slate-800"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-bold uppercase text-amber-500 tracking-wider">
              Reason for Unlocking Manifest
            </label>
            <button
              onClick={() => {
                setShowUnlockReason(false);
                setUnlockReason("");
              }}
              className="text-slate-500 hover:text-red-500 transition-colors"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          <textarea
            autoFocus
            value={unlockReason}
            onChange={(e) => setUnlockReason(e.target.value)}
            placeholder="Please explain why the manifest is being unlocked..."
            className={`w-full p-3 rounded-lg text-xs min-h-[80px] outline-none focus:ring-1 focus:ring-amber-500 transition-all ${
              isDark
                ? "bg-slate-950 border-slate-800 text-white"
                : "bg-slate-50 border-slate-300 text-slate-900"
            }`}
          />
        </div>
      )}

      {/* 2. PRIMARY ACTIONS ROW */}
      <div className="flex gap-3">
        {/* LOCK BUTTON */}
        <StatusButton
          status={lockStatus}
          label="Lock Manifest"
          loadingLabel="Locking..."
          successLabel="Locked!"
          icon={faLock}
          idleColor="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30"
          disabled={isLocked || showUnlockReason}
          onClick={() =>
            runAction(
              setLockStatus,
              () => generateTripManifest({ tripDocId: data.tripId }),
              () => onSuccess(),
            )
          }
        />

        {/* UNLOCK BUTTON TOGGLE / CONFIRM */}
        {!showUnlockReason ? (
          <button
            disabled={!isLocked}
            onClick={() => setShowUnlockReason(true)}
            className="flex-1 py-2 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-600/20 text-xs font-bold disabled:opacity-30 transition-colors flex justify-center items-center gap-2"
          >
            <FontAwesomeIcon icon={faUnlock} /> Unlock Manifest
          </button>
        ) : (
          <StatusButton
            status={unlockStatus}
            label="Confirm Unlock"
            loadingLabel="Unlocking..."
            successLabel="Unlocked!"
            icon={faUnlock}
            idleColor="bg-amber-600 text-white shadow-lg shadow-amber-600/20"
            disabled={!unlockReason.trim()}
            onClick={() =>
              runAction(
                setUnlockStatus,
                () =>
                  unlockTripManifest({
                    tripDocId: data.tripId,
                    reason: unlockReason,
                  }),
                () => {
                  onSuccess();
                  handleUnlockSuccess();
                },
              )
            }
          />
        )}

        {/* REOPEN BUTTON */}
        <StatusButton
          status={reopenStatus}
          label="Reopen"
          loadingLabel="..."
          successLabel="Reopened!"
          icon={faRotateLeft}
          idleColor="border border-red-500/30 text-red-400 hover:bg-red-600/20"
          disabled={!isLocked || showUnlockReason}
          onClick={() => {
            if (
              confirm(
                "Are you sure? This will invalidate the current certificate.",
              )
            ) {
              runAction(
                setReopenStatus,
                () => reopenTrip({ tripDocId: data.tripId }),
                () => {},
              );
            }
          }}
        />
      </div>

      {/* 3. SECONDARY ACTIONS ROW (PRINT & EXPORT) */}
      <div className="flex gap-3 pt-1">
        <button
          disabled={showUnlockReason}
          onClick={() =>
            window.open(
              `/components/print/manifest?tripId=${data.tripId}`,
              "_blank",
            )
          }
          className={`flex-1 py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
            isDark
              ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              : "bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300"
          } ${showUnlockReason ? "opacity-30 pointer-events-none" : ""}`}
        >
          <FontAwesomeIcon icon={faPrint} /> Print Manifest
        </button>

        <ExportTripButton trip={data} shipments={shipments} />
      </div>
    </div>
  );
}
