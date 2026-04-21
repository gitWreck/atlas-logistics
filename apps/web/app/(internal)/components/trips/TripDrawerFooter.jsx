"use client";

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
import { getDrawerThemeClasses } from "@/app/utility/constant/theme";
import ExportTripButton from "../exports/ExportTripManifest";

export default function TripDrawerFooter({
  data,
  onClose,
  shipments,
  isDark = false,
  onSuccess,
  user,
}) {
  const [lockStatus, setLockStatus] = useState("IDLE");
  const [unlockStatus, setUnlockStatus] = useState("IDLE");
  const [reopenStatus, setReopenStatus] = useState("IDLE");

  const [showUnlockReason, setShowUnlockReason] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

  const theme = getDrawerThemeClasses(isDark);

  if (!data) return null;

  const isLocked = data.manifestLocked;

  const handleUnlockSuccess = () => {
    setTimeout(() => {
      setShowUnlockReason(false);
      setUnlockReason("");
    }, 1500);
  };

  return (
    <div className={`p-4 border-t flex flex-col gap-3 ${theme.footerPanel}`}>
      {showUnlockReason && (
        <div
          className={`p-3 rounded-xl border animate-in slide-in-from-bottom-2 duration-200 ${theme.reasonBox}`}
        >
          <div className="flex justify-between items-center mb-2">
            <label className={theme.reasonLabel}>
              Reason for Unlocking Manifest
            </label>

            <button
              type="button"
              onClick={() => {
                setShowUnlockReason(false);
                setUnlockReason("");
              }}
              className={theme.closeButton}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          <textarea
            autoFocus
            value={unlockReason}
            onChange={(e) => setUnlockReason(e.target.value)}
            placeholder="Please explain why the manifest is being unlocked..."
            className={`w-full p-3 rounded-lg text-xs min-h-[80px] outline-none focus:ring-1 focus:ring-amber-500 transition-all border ${theme.textarea}`}
          />
        </div>
      )}

      <div className="flex gap-3">
        <StatusButton
          status={lockStatus}
          label="Lock Manifest"
          loadingLabel="Locking..."
          successLabel="Locked!"
          icon={faLock}
          // idleColor="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30"
          variant="emerald"
          disabled={isLocked || showUnlockReason}
          onClick={() =>
            runAction(
              setLockStatus,
              () => generateTripManifest({ tripId: data.tripId }),
              () => onSuccess?.(),
            )
          }
        />

        {!showUnlockReason ? (
          <button
            type="button"
            disabled={!isLocked}
            onClick={() => setShowUnlockReason(true)}
            className={theme.warningOutlineButton}
          >
            <FontAwesomeIcon icon={faUnlock} />
            Unlock Manifest
          </button>
        ) : (
          <StatusButton
            status={unlockStatus}
            label="Confirm Unlock"
            loadingLabel="Unlocking..."
            successLabel="Unlocked!"
            icon={faUnlock}
            // idleColor="bg-amber-600 text-white shadow-lg shadow-amber-600/20"
            variant="amber"
            disabled={!unlockReason.trim()}
            onClick={() =>
              runAction(
                setUnlockStatus,
                () =>
                  unlockTripManifest({
                    tripId: data.tripId,
                    reason: unlockReason,
                  }),
                () => {
                  onSuccess?.();
                  handleUnlockSuccess();
                },
              )
            }
          />
        )}

        {/* <StatusButton
          status={reopenStatus}
          label="Reopen"
          loadingLabel="..."
          successLabel="Reopened!"
          icon={faRotateLeft}
          // idleColor="border border-red-500/30 text-red-400 hover:bg-red-600/20"
          variant="red"
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
        /> */}
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          disabled={showUnlockReason}
          onClick={() =>
            window.open(
              `/components/print/manifest?tripId=${data.tripId}`,
              "_blank",
            )
          }
          className={`${theme.secondaryActionButton} ${
            showUnlockReason ? "opacity-30 pointer-events-none" : ""
          }`}
        >
          <FontAwesomeIcon icon={faPrint} />
          Print Manifest
        </button>

        <ExportTripButton trip={data} user={user} />
      </div>
    </div>
  );
}
