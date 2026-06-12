"use client";

import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArchive,
  faBan,
  faClipboardList,
  faEllipsisV,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/app/context/AuthContext";
import {
  canArchiveTrip,
  canCancelTrip,
  canManageTripLifecycle,
  canViewTripAuditLog,
} from "@/app/utility/tripLifecycle";
import {
  archiveTruckTrip,
  cancelTruckTrip,
} from "@/app/utility/FirebaseFunctions";
import TripReasonConfirmModal from "./TripReasonConfirmModal";
import TripAuditLogModal from "./TripAuditLogModal";

export default function TripLifecycleMenu({
  trip,
  profile,
  onOpenTrip,
  onSuccess,
  isDark = false,
  buttonClassName = "",
}) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const menuRef = useRef(null);

  const canManage = canManageTripLifecycle(profile, user);
  const canAudit = canViewTripAuditLog(profile);
  const showCancel = canManage && canCancelTrip(trip);
  const showArchive = canManage && canArchiveTrip(trip);
  const showAdminSection = showCancel || showArchive || canAudit;

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const tripDocId = trip.id;
  const entityLabel = trip.tripId || tripDocId;

  const menuPanelClass = isDark
    ? "bg-slate-900 border-slate-700 text-slate-100 shadow-xl"
    : "bg-white border-slate-200 text-slate-900 shadow-lg";

  const menuItemClass = isDark
    ? "hover:bg-slate-800 text-slate-200"
    : "hover:bg-slate-100 text-slate-700";

  const dividerClass = isDark ? "border-slate-700" : "border-slate-200";

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          title="Trip actions"
          aria-label="Trip actions"
          className={`p-2 rounded-full transition-colors ${buttonClassName}`}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          <FontAwesomeIcon icon={faEllipsisV} className="text-sm" />
        </button>

        {menuOpen && (
          <div
            className={`absolute right-0 top-full mt-1 z-20 min-w-[190px] rounded-lg border py-1 ${menuPanelClass}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 ${menuItemClass}`}
              onClick={() => {
                setMenuOpen(false);
                onOpenTrip?.();
              }}
            >
              <FontAwesomeIcon icon={faFolderOpen} className="text-slate-400" />
              View trip details
            </button>

            {showAdminSection && (
              <div className={`my-1 border-t ${dividerClass}`} />
            )}

            {showCancel && (
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 ${menuItemClass}`}
                onClick={() => {
                  setMenuOpen(false);
                  setCancelOpen(true);
                }}
              >
                <FontAwesomeIcon icon={faBan} className="text-amber-500" />
                Cancel trip
              </button>
            )}

            {showArchive && (
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 ${menuItemClass}`}
                onClick={() => {
                  setMenuOpen(false);
                  setArchiveOpen(true);
                }}
              >
                <FontAwesomeIcon icon={faArchive} className="text-slate-400" />
                Archive trip
              </button>
            )}

            {canAudit && (
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 ${menuItemClass}`}
                onClick={() => {
                  setMenuOpen(false);
                  setAuditOpen(true);
                }}
              >
                <FontAwesomeIcon
                  icon={faClipboardList}
                  className="text-blue-400"
                />
                View audit log
              </button>
            )}
          </div>
        )}
      </div>

      <TripReasonConfirmModal
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel Trip"
        entityLabel={entityLabel}
        description={`Cancel ${entityLabel}? Shipments stay in the system and are detached from this trip. This works even when the manifest is locked.`}
        confirmLabel="Cancel Trip"
        confirmVariant="amber"
        isDark={isDark}
        onConfirm={async (reason) => {
          await cancelTruckTrip({ tripId: tripDocId, reason });
          onSuccess?.();
        }}
      />

      <TripReasonConfirmModal
        isOpen={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive Trip"
        entityLabel={entityLabel}
        description={`Archive ${entityLabel}? The record is kept for audit but hidden from the active board.`}
        confirmLabel="Archive Trip"
        confirmVariant="red"
        isDark={isDark}
        onConfirm={async (reason) => {
          await archiveTruckTrip({ tripId: tripDocId, reason });
          onSuccess?.();
        }}
      />

      <TripAuditLogModal
        isOpen={auditOpen}
        onClose={() => setAuditOpen(false)}
        trip={trip}
        isDark={isDark}
      />
    </>
  );
}
