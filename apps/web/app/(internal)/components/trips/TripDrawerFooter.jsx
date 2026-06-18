"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArchive,
  faBan,
  faClipboardList,
  faLock,
  faUnlock,
  faPrint,
  faTimes,
  faTruck,
  faTruckRampBox,
} from "@fortawesome/free-solid-svg-icons";
import StatusButton from "../ui/StatusButton";
import {
  archiveTruckTrip,
  cancelTruckTrip,
  generateTripManifest,
  unlockTripManifest,
  startReceiving,
  dispatchTrip,
} from "@/app/utility/FirebaseFunctions";
import {
  canArchiveTrip,
  canCancelTrip,
  canManageTripLifecycle,
  canViewTripAuditLog,
} from "@/app/utility/tripLifecycle";
import TripReasonConfirmModal from "./TripReasonConfirmModal";
import TripAuditLogModal from "./TripAuditLogModal";
import {
  canStartReceiving,
  canDispatchTrip,
  canDispatchCorrectionTrip,
  canResumeReceiving,
  canUnlockManifest,
  getDispatchTripBlockReason,
  getManifestStatusLabel,
  isHubTransferTrip,
  isManifestEditable,
  MANIFEST_STATUS,
  resolveManifestStatus,
} from "@/app/utility/manifestStatus";
import { runAction, updatedBy } from "@/app/utility/utilities";
import { getDrawerThemeClasses } from "@/app/utility/constant/theme";
import ExportTripButton from "../exports/ExportTripManifest";

export default function TripDrawerFooter({
  data,
  onClose,
  shipments,
  isDark = false,
  onSuccess,
  user,
  profile,
}) {
  const [lockStatus, setLockStatus] = useState("IDLE");
  const [unlockStatus, setUnlockStatus] = useState("IDLE");
  const [dispatchStatus, setDispatchStatus] = useState("IDLE");
  const [receivingStatus, setReceivingStatus] = useState("IDLE");

  const [showUnlockReason, setShowUnlockReason] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const theme = getDrawerThemeClasses(isDark);

  if (!data) return null;

  const isLocked = data.manifestLocked;
  const tripDocId = data.id || data.tripId;
  const manifestStatus = resolveManifestStatus(data);
  const manifestStatusLabel = getManifestStatusLabel(data);
  const role = String(profile?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const canViewManifestControls = isAdmin || isManager;
  const canEditManifestControls = isAdmin || isManager;
  const manifestEditable = isManifestEditable(data);
  const canUnlock =
    canUnlockManifest(data, { isAdmin }) &&
    (isLocked || manifestStatus === MANIFEST_STATUS.RECONCILED);
  const isHubTrip = isHubTransferTrip(data);
  const showDispatchTrip = canEditManifestControls && canDispatchTrip(data);
  const showDispatchCorrection =
    canEditManifestControls && canDispatchCorrectionTrip(data);
  const showStartReceiving = canEditManifestControls && canStartReceiving(data);
  const showResumeReceiving =
    canEditManifestControls && canResumeReceiving(data);
  const dispatchBlockReason =
    canEditManifestControls && isHubTrip
      ? getDispatchTripBlockReason(data)
      : null;

  const canManageLifecycle = canManageTripLifecycle(profile, user);
  const canAudit = canViewTripAuditLog(profile, user);
  const showCancelTrip = canManageLifecycle && canCancelTrip(data);
  const showArchiveTrip = canManageLifecycle && canArchiveTrip(data);
  const showLifecycleSection = showCancelTrip || showArchiveTrip || canAudit;
  const completedTrip = String(data.status || "").toUpperCase() === "COMPLETED" ||
    String(data.status || "").toUpperCase() === "DELIVERED";

  const handleUnlockSuccess = () => {
    setTimeout(() => {
      setShowUnlockReason(false);
      setUnlockReason("");
    }, 1500);
  };

  if (completedTrip) return null;

  return (
    <div className={`p-4 border-t flex flex-col gap-3 ${theme.footerPanel}`}>
      <div className={`rounded-lg border px-3 py-2 text-xs ${theme.footerPanel}`}>
        <span className="font-bold uppercase opacity-60">Manifest</span>
        <span className="ml-2 font-semibold">{manifestStatusLabel}</span>
        <span className="ml-2 opacity-50">({manifestStatus})</span>
        {manifestStatus === MANIFEST_STATUS.RECONCILED && !isAdmin && (
          <p className="mt-2 text-[11px] opacity-70">
            Reconciled manifests can only be unlocked by an Admin.
          </p>
        )}
        {manifestEditable && manifestStatus !== MANIFEST_STATUS.OPEN && (
          <p className="mt-2 text-[11px] text-amber-500">
            Manifest is open for edits. Add shipments, scan loads/unloads, then
            lock again when done.
          </p>
        )}
      </div>

      {canEditManifestControls && isHubTrip && (
        <div className="flex flex-col gap-2">
          {showDispatchCorrection ? (
            <StatusButton
              status={dispatchStatus}
              label="Dispatch Correction"
              loadingLabel="Dispatching..."
              successLabel="Dispatched!"
              icon={faTruck}
              variant="blue"
              onClick={() =>
                runAction(
                  setDispatchStatus,
                  () =>
                    dispatchTrip({
                      tripId: tripDocId,
                      updatedBy: updatedBy(profile),
                    }),
                  () => onSuccess?.(),
                )
              }
            />
          ) : showDispatchTrip ? (
            <StatusButton
              status={dispatchStatus}
              label="Dispatch Trip"
              loadingLabel="Dispatching..."
              successLabel="Dispatched!"
              icon={faTruck}
              variant="blue"
              onClick={() =>
                runAction(
                  setDispatchStatus,
                  () =>
                    dispatchTrip({
                      tripId: tripDocId,
                      updatedBy: updatedBy(profile),
                    }),
                  () => onSuccess?.(),
                )
              }
            />
          ) : (
            manifestStatus === MANIFEST_STATUS.LOCKED &&
            dispatchBlockReason && (
              <p className={`text-xs px-1 ${theme.mutedText}`}>
                {dispatchBlockReason}
              </p>
            )
          )}

          {showResumeReceiving ? (
            <StatusButton
              status={receivingStatus}
              label="Resume Receiving"
              loadingLabel="Resuming..."
              successLabel="Receiving resumed!"
              icon={faTruckRampBox}
              variant="emerald"
              onClick={() =>
                runAction(
                  setReceivingStatus,
                  () =>
                    startReceiving({
                      tripId: tripDocId,
                      updatedBy: updatedBy(profile),
                    }),
                  () => onSuccess?.(),
                )
              }
            />
          ) : showStartReceiving ? (
            <StatusButton
              status={receivingStatus}
              label="Start Receiving"
              loadingLabel="Starting..."
              successLabel="Receiving started!"
              icon={faTruckRampBox}
              variant="emerald"
              onClick={() =>
                runAction(
                  setReceivingStatus,
                  () =>
                    startReceiving({
                      tripId: tripDocId,
                      updatedBy: updatedBy(profile),
                    }),
                  () => onSuccess?.(),
                )
              }
            />
          ) : null}
        </div>
      )}

      {canEditManifestControls && showUnlockReason && (
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

      {canViewManifestControls && (
        <div className="flex gap-3">
          <StatusButton
            status={lockStatus}
            label="Lock Manifest"
            loadingLabel="Locking..."
            successLabel="Locked!"
            icon={faLock}
            // idleColor="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30"
            variant="emerald"
            disabled={!canEditManifestControls || isLocked || showUnlockReason}
            onClick={() =>
              runAction(
                setLockStatus,
                () =>
                  generateTripManifest({
                    tripId: tripDocId,
                    updatedBy: updatedBy(profile),
                  }),
                () => onSuccess?.(),
              )
            }
          />

          {!showUnlockReason ? (
            <button
              type="button"
              disabled={!canEditManifestControls || !canUnlock}
              onClick={() => setShowUnlockReason(true)}
              className={theme.warningOutlineButton}
              title={
                manifestStatus === MANIFEST_STATUS.RECONCILED && !isAdmin
                  ? "Only Admin can unlock a reconciled manifest"
                  : undefined
              }
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
                      tripId: tripDocId,
                      reason: unlockReason,
                      updatedBy: updatedBy(profile),
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
      )}

      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="button"
          disabled={showUnlockReason}
          onClick={() =>
            window.open(
              `/components/print/manifest?tripId=${tripDocId}`,
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

        {data.latestAmendmentId ? (
          <button
            type="button"
            disabled={showUnlockReason}
            onClick={() =>
              window.open(
                `/components/print/manifest-amendment?amendmentId=${data.latestAmendmentId}`,
                "_blank",
              )
            }
            className={`${theme.secondaryActionButton} ${
              showUnlockReason ? "opacity-30 pointer-events-none" : ""
            }`}
          >
            <FontAwesomeIcon icon={faPrint} />
            Print Addendum
            {data.latestAmendmentVersion
              ? ` (${data.latestAmendmentVersion})`
              : ""}
          </button>
        ) : null}

        <ExportTripButton trip={data} user={user} />
      </div>

      {showLifecycleSection && (
        <div
          className={`rounded-lg border px-3 py-3 flex flex-col gap-2 ${theme.footerPanel}`}
        >
          <span className="text-[10px] font-bold uppercase opacity-60">
            Trip Lifecycle
          </span>
          <div className="flex flex-wrap gap-2">
            {showCancelTrip && (
              <button
                type="button"
                disabled={showUnlockReason}
                onClick={() => setCancelOpen(true)}
                className={theme.warningOutlineButton}
              >
                <FontAwesomeIcon icon={faBan} />
                Cancel Trip
              </button>
            )}
            {showArchiveTrip && (
              <button
                type="button"
                disabled={showUnlockReason}
                onClick={() => setArchiveOpen(true)}
                className={theme.secondaryActionButton}
              >
                <FontAwesomeIcon icon={faArchive} />
                Archive Trip
              </button>
            )}
            {canAudit && (
              <button
                type="button"
                disabled={showUnlockReason}
                onClick={() => setAuditOpen(true)}
                className={theme.secondaryActionButton}
              >
                <FontAwesomeIcon icon={faClipboardList} />
                View Audit Log
              </button>
            )}
          </div>
        </div>
      )}

      <TripReasonConfirmModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel Trip"
        entityLabel={data.tripId || data.id}
        description={`Cancel ${data.tripId || data.id}? Shipments stay in the system and are detached from this trip.`}
        confirmLabel="Cancel Trip"
        isDark={isDark}
        onConfirm={async (reason) => {
          await cancelTruckTrip({ tripId: data.id || data.tripId, reason });
          onSuccess?.();
        }}
      />

      <TripReasonConfirmModal
        isOpen={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive Trip"
        entityLabel={data.tripId || data.id}
        description={`Archive ${data.tripId || data.id}? The record is kept for audit but hidden from the active board.`}
        confirmLabel="Archive Trip"
        confirmVariant="red"
        isDark={isDark}
        onConfirm={async (reason) => {
          await archiveTruckTrip({ tripId: data.id || data.tripId, reason });
          onSuccess?.();
        }}
      />

      <TripAuditLogModal
        isOpen={auditOpen}
        onClose={() => setAuditOpen(false)}
        trip={data}
        isDark={isDark}
      />
    </div>
  );
}
