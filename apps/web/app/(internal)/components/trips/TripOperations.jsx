"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPlay,
  faPause,
  faTruckFast,
  faExclamationTriangle,
  faCheckCircle,
  faLock,
} from "@fortawesome/free-solid-svg-icons";
import {
  manualAssignShipmentToTrip,
  updateTripStatus,
  clearTruckDelay,
  setTruckDelay,
} from "@/app/utility/FirebaseFunctions";
import StatusButton from "../ui/StatusButton";
import NotifyToggle from "../messaging/NotifyToggle";
import { runAction, updatedBy } from "@/app/utility/utilities";
import { getWidgetThemeClasses } from "@/app/utility/constant/theme";
import {
  MANIFEST_STATUS,
  resolveManifestStatus,
} from "@/app/utility/manifestStatus";

const SHIPMENT_REF_PATTERN =
  /^AT-\d{8}-SHP-[A-Z0-9-]+(?:-\d{2})?$/i;

export default function TripOperations({
  tripId,
  manifestEditable = true,
  tripStatus = null,
  tripManifestStatus = null,
  tripReconciledAt = null,
  onSuccess,
  isDark = false,
  profile,
  user,
}) {
  const [assignId, setAssignId] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [lookupState, setLookupState] = useState({
    loading: false,
    valid: false,
    message: "",
    shipmentId: null,
    alreadyOnTrip: false,
  });
  const [delaySelect, setDelaySelect] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [statusSelect, setStatusSelect] = useState("");

  const [assignStatus, setAssignStatus] = useState("IDLE");
  const [delayStatus, setDelayStatus] = useState("IDLE");
  const [clearStatus, setClearStatus] = useState("IDLE");
  const [statusChangeStatus, setStatusChangeStatus] = useState("IDLE");

  const [notifySms, setNotifySms] = useState(false);
  const [notifyDelay, setNotifyDelay] = useState(false);

  const theme = getWidgetThemeClasses(isDark);
  const isManager = String(profile?.role || "").toLowerCase() === "manager";
  const isAdmin = String(profile?.role || "").toLowerCase() === "admin";
  const manifestLocked = !manifestEditable;

  const resolvedManifestStatus = resolveManifestStatus({
    manifestStatus: tripManifestStatus,
    reconciledAt: tripReconciledAt,
    manifestLocked,
  });

  const requiresAssignReason =
    resolvedManifestStatus === MANIFEST_STATUS.RECEIVING_IN_PROGRESS ||
    resolvedManifestStatus === MANIFEST_STATUS.RECONCILED ||
    String(tripStatus || "").toUpperCase() === "ARRIVED";

  const formatLooksValid = useMemo(
    () => SHIPMENT_REF_PATTERN.test(String(assignId || "").trim()),
    [assignId],
  );

  useEffect(() => {
    const code = String(assignId || "").trim();
    if (!code || !formatLooksValid || !user) {
      setLookupState({
        loading: false,
        valid: false,
        message: code && !formatLooksValid ? "Use a valid Atlas shipment or package label." : "",
        shipmentId: null,
        alreadyOnTrip: false,
      });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLookupState((prev) => ({ ...prev, loading: true }));
      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams({ code, tripId: tripId || "" });
        const res = await fetch(`/api/shipments/lookup?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;

        setLookupState({
          loading: false,
          valid: Boolean(data.valid || data.alreadyOnTrip),
          message:
            data.blockReason ||
            (data.alreadyOnTrip
              ? "Already on this trip — you can still confirm to repair manifest row."
              : data.found
                ? `Found ${data.shipmentId}${data.packageLabel ? ` (label ${data.packageLabel})` : ""}`
                : data.message || "Label not found."),
          shipmentId: data.shipmentId || null,
          alreadyOnTrip: Boolean(data.alreadyOnTrip),
        });
      } catch (error) {
        if (cancelled) return;
        setLookupState({
          loading: false,
          valid: false,
          message: error.message || "Could not validate label.",
          shipmentId: null,
          alreadyOnTrip: false,
        });
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [assignId, formatLooksValid, tripId, user]);

  const canSubmitAssign =
    isAdmin &&
    formatLooksValid &&
    lookupState.valid &&
    !lookupState.loading &&
    (!requiresAssignReason || String(assignReason || "").trim());

  const handleManualAssign = () => {
    if (!canSubmitAssign) return;

    runAction(
      setAssignStatus,
      () =>
        manualAssignShipmentToTrip({
          tripId,
          shipmentRef: assignId.trim(),
          reason:
            String(assignReason || "").trim() ||
            "Manual assignment from trip actions.",
        }),
      () => {
        setAssignId("");
        setAssignReason("");
        setLookupState({
          loading: false,
          valid: false,
          message: "",
          shipmentId: null,
          alreadyOnTrip: false,
        });
        onSuccess?.();
      },
    );
  };

  if (isManager) return null;

  return (
    <div className="space-y-4">
      {/* Manual Assignment */}
      <div className={`border rounded-xl p-5 shadow-lg ${theme.container}`}>
        <h3
          className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme.title}`}
        >
          <FontAwesomeIcon icon={faPlus} className="text-blue-500" />
          Manual Assignment
          {!isAdmin && (
            <span className="text-[10px] font-normal opacity-60">(Admin)</span>
          )}
        </h3>

        <p className={`text-xs mb-3 ${theme.bodyText}`}>
          {manifestLocked
            ? "Admin correction: add a missed shipment or package directly to this locked trip."
            : "Add a shipment by ID or package label (e.g. AT-20260612-SHP-677769-09)."}
        </p>

        {manifestLocked ? (
          <p
            className={`mb-3 flex items-center gap-2 text-[11px] font-medium ${
              isDark ? "text-amber-400" : "text-amber-700"
            }`}
          >
            <FontAwesomeIcon icon={faLock} className="shrink-0 opacity-80" />
            <span>
              Manifest is locked. Admin manual additions are allowed and will
              be recorded as a manifest amendment.
            </span>
          </p>
        ) : null}

        <div className="flex gap-2">
          <input
            value={assignId}
            onChange={(e) => setAssignId(e.target.value.trim())}
            placeholder="Shipment ID or package label..."
            className={`flex-1 border rounded-lg px-3 py-2.5 text-sm focus:border-blue-500 outline-none disabled:opacity-50 ${theme.input}`}
            disabled={!isAdmin}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmitAssign) {
                e.preventDefault();
                handleManualAssign();
              }
            }}
          />

          <div className="w-24">
            <StatusButton
              status={assignStatus}
              onClick={handleManualAssign}
              disabled={!canSubmitAssign}
              icon={faPlus}
              label="Add"
              loadingLabel="..."
              successLabel="OK"
              errorLabel="X"
            />
          </div>
        </div>

        {assignId && (
          <div className={`mt-2 text-[11px] flex items-center gap-2 ${theme.bodyText}`}>
            {lookupState.loading ? (
              <span className="opacity-70">Checking label...</span>
            ) : lookupState.valid ? (
              <>
                <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-500" />
                <span>{lookupState.message}</span>
              </>
            ) : (
              <span className="text-amber-600">{lookupState.message || "Enter a valid Atlas label."}</span>
            )}
          </div>
        )}

        {requiresAssignReason && (
          <div className="mt-3">
            <label className={`block text-[11px] font-bold mb-1.5 ${theme.bodyText}`}>
              Reason for manual assignment
            </label>
            <textarea
              value={assignReason}
              onChange={(e) => setAssignReason(e.target.value)}
              placeholder="e.g. Missing piece was on truck but not on manifest"
              className={`w-full border rounded-lg px-3 py-2 text-xs min-h-[72px] outline-none focus:border-blue-500 disabled:opacity-50 ${theme.input}`}
              disabled={!isAdmin}
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
            A shipment ID adds its eligible pieces; a package label adds only
            that piece. Added cargo is synchronized to the trip&apos;s current
            stage and logged in the trip audit trail.
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
                        tripId,
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
                        tripId,
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
