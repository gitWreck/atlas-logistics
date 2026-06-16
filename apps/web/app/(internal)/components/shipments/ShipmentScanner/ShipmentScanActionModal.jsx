"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faUndo,
  faCircleNotch,
  faCheck,
  faCamera,
  faClipboardCheck,
  faArrowRight,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";
import { getScannerErrorGuidance } from "@/app/utility/shipmentScannerGuidance";

import useScannerLogic from "./useScannerLogic";
import {
  NextTripPrompt,
  ArrivalPrompt,
  StartReceivingPrompt,
  CorrectionDispatchPrompt,
  UnlockPrompt,
  LoadedStatusPrompt,
  LockPrompt,
  AssignmentPrompt,
  HandoffPrompt,
} from "./Prompts";
import {
  ActionSelector,
  CameraScanner,
  ManualInput,
  ScanStatusSelector,
  ScannerEngineSelect,
} from "./ScannerControls";
import ManifestPanel from "./ManifestPanel";
import StatusBadge from "../../ui/StatusBadge";
import { getTripPackageStats } from "@/app/utility/tripStats";

function TripScanDetailsCard({ trip, theme, isDark, manifestShipments = [] }) {
  const tripWithShipments =
    manifestShipments.length > 0
      ? { ...trip, shipments: manifestShipments }
      : trip;
  const stats = getTripPackageStats(tripWithShipments);

  return (
    <div className={`rounded-xl border p-4 ${theme.panelSurface}`}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase opacity-60">
            Trip Status
          </div>
          <div className="mt-1">
            <StatusBadge status={trip?.status || "UNKNOWN"} isDark={isDark} />
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase opacity-60">
            Loaded Packages
          </div>
          <div className="mt-1 text-sm font-bold">{stats.displayLoaded}</div>
        </div>
        <div className="col-span-2">
          <div className="text-[10px] font-bold uppercase opacity-60">
            Total Shipments
          </div>
          <div className="mt-1 text-sm font-bold">{stats.shipmentCount}</div>
        </div>
      </div>
    </div>
  );
}

export default function ShipmentScanActionModal({
  isOpen = false,
  onClose,
  trip = null,
  manifestShipments = [],
  isDark = false,
  onResolveScan,
  onConfirmOperation,
  onRefresh,
  user,
  profile,
}) {
  const theme = getModalThemeClasses(isDark);
  const actionTheme = getModalActionClasses();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scannerEngine, setScannerEngine] = useState("barcode-detector");
  const [scannerSession, setScannerSession] = useState(0);

  const { state, actions } = useScannerLogic({
    isOpen,
    trip,
    onResolveScan,
    onConfirmOperation,
    onClose,
    onRefresh,
    user,
    profile,
  });

  if (!isOpen) return null;

  const selectedScanStatusLabel =
    state.scanStatusOptions.find((opt) => opt.value === state.scanStatus)
      ?.label || state.scanStatus;
  const scannerStatusMessage = selectedScanStatusLabel
    ? `Scan will mark as ${selectedScanStatusLabel}`
    : "";
  const errorGuidance = getScannerErrorGuidance(state.error, state, trip);
  const canShowLoadedStatusPromptButton =
    state.action === "LOAD" &&
    !state.needsHandoff &&
    !state.needsNextTrip &&
    !state.needsArrival &&
    !state.needsStartReceiving &&
    !state.needsResumeReceiving &&
    !state.needsCorrectionDispatch &&
    !state.needsUnlock &&
    !state.needsLoadedStatus &&
    !state.needsLock &&
    !state.resolvedItem &&
    !state.needsAssignmentItem;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center sm:p-4">
      <div className={`absolute inset-0 ${theme.overlay}`} onClick={onClose} />

      <div
        className={`relative w-full max-w-lg h-full sm:h-auto sm:max-h-[92vh] flex flex-col sm:rounded-2xl border overflow-hidden ${theme.modal}`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b flex items-center justify-between ${theme.header}`}
        >
          <div className="min-w-0">
            <h2 className={`font-bold text-lg ${theme.title}`}>Scan Package</h2>
            <p className={`text-xs truncate ${theme.helperText}`}>
              {state.tripId}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${theme.closeButton}`}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content Router */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <ActionSelector
            action={state.action}
            trip={trip}
            theme={theme}
            actions={actions}
          />

          {state.alreadyLoadedNotice && !state.error && (
            <div
              className={`rounded-xl border p-4 flex items-start gap-3 ${
                isDark
                  ? "border-amber-400/40 bg-amber-500/10"
                  : "border-amber-300 bg-amber-50"
              }`}
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                <FontAwesomeIcon icon={faExclamationTriangle} />
              </div>
              <div className="min-w-0 space-y-2 text-xs">
                <div className="text-sm font-bold text-amber-600">
                  Package Already Loaded
                </div>
                <div>
                  <span className="opacity-60">Package:</span>
                  <div className="font-mono font-bold text-sm">
                    {state.alreadyLoadedNotice.packageId}
                  </div>
                </div>
                <div>
                  <span className="opacity-60">Trip:</span>
                  <div className="font-mono font-bold text-sm">
                    {state.alreadyLoadedNotice.tripId}
                  </div>
                </div>
                {state.alreadyLoadedNotice.loadedBy && (
                  <div>
                    <span className="opacity-60">Loaded By:</span>
                    <div className="font-semibold">
                      {state.alreadyLoadedNotice.loadedBy}
                    </div>
                  </div>
                )}
                {state.alreadyLoadedNotice.loadedByRole && (
                  <div>
                    <span className="opacity-60">Role:</span>
                    <div className="font-semibold">
                      {state.alreadyLoadedNotice.loadedByRole}
                    </div>
                  </div>
                )}
                {state.alreadyLoadedNotice.location && (
                  <div>
                    <span className="opacity-60">Location:</span>
                    <div className="font-semibold">
                      {state.alreadyLoadedNotice.location}
                    </div>
                  </div>
                )}
                {state.alreadyLoadedNotice.truckName && (
                  <div>
                    <span className="opacity-60">Truck:</span>
                    <div className="font-semibold">
                      {state.alreadyLoadedNotice.truckName}
                      {state.alreadyLoadedNotice.truckPlate
                        ? ` (${state.alreadyLoadedNotice.truckPlate})`
                        : ""}
                    </div>
                  </div>
                )}
                {state.alreadyLoadedNotice.loadedAt && (
                  <div>
                    <span className="opacity-60">Time:</span>
                    <div className="font-semibold">
                      {state.alreadyLoadedNotice.loadedAt}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {state.successNotice && !state.error && !state.needsHandoff && (
            <div
              className={`rounded-xl border p-4 flex items-start gap-3 animate-in fade-in duration-200 ${theme.panelSurface}`}
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-emerald-500">
                  Successfully Scanned
                </div>
                <div className="mt-2 space-y-2 text-xs opacity-80">
                  <p>
                    {state.successNotice.action} completed for
                  </p>
                  <p className="font-mono font-bold text-sm opacity-100">
                    {state.successNotice.code}
                  </p>
                  <p>Added to Manifest:</p>
                  <p className="font-mono font-bold text-sm opacity-100">
                    {state.successNotice.tripId || state.tripId}
                  </p>
                </div>
              </div>
            </div>
          )}

          {canShowLoadedStatusPromptButton && (
            <button
              type="button"
              onClick={() => actions.setNeedsLoadedStatus(true)}
              className={`group w-full rounded-xl border px-4 py-4 text-left transition-all ${
                isDark
                  ? "border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/15"
                  : "border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <FontAwesomeIcon icon={faCheck} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-emerald-600">
                    Trip is Fully Loaded
                  </div>
                  <span className={`mt-0.5 block text-xs ${theme.helperText}`}>
                    Set the trip to LOADED before locking or dispatching.
                  </span>
                </div>
                <FontAwesomeIcon
                  icon={faArrowRight}
                  className="shrink-0 text-emerald-500 transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </button>
          )}

          {state.action === "UNLOAD" &&
            !state.needsHandoff &&
            !state.needsNextTrip &&
            !state.needsArrival &&
            !state.needsStartReceiving &&
            !state.needsResumeReceiving &&
            !state.needsCorrectionDispatch &&
            !state.needsUnlock &&
            !state.resolvedItem &&
            !state.needsAssignmentItem && (
              <button
                type="button"
                onClick={actions.handleReviewHandoff}
                disabled={state.loading}
                className={`group w-full rounded-xl border px-4 py-4 text-left transition-all disabled:opacity-70 ${
                  isDark
                    ? "border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/15"
                    : "border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
                    {state.loading ? (
                      <FontAwesomeIcon icon={faCircleNotch} spin />
                    ) : (
                      <FontAwesomeIcon icon={faClipboardCheck} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-emerald-600">
                        Reconcile & release shipments
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          isDark
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-white text-emerald-700"
                        }`}
                      >
                        Reconcile
                      </span>
                    </div>
                    <span className={`mt-0.5 block text-xs ${theme.helperText}`}>
                      Check unloaded and missing rows, then release shipment(s) for
                      checker scan-to-load.
                    </span>
                  </div>
                  <FontAwesomeIcon
                    icon={faArrowRight}
                    className="shrink-0 text-emerald-500 transition-transform group-hover:translate-x-0.5"
                  />
                </div>
              </button>
            )}

          {state.needsHandoff ? (
            <HandoffPrompt
              theme={theme}
              summary={state.handoffSummary}
              tripId={state.tripId}
              missingRemarks={state.missingRemarks}
              isAdmin={state.isAdmin}
              onRemarkChange={(shipmentId, value) =>
                actions.setMissingRemarks((prev) => ({
                  ...prev,
                  [shipmentId]: value,
                }))
              }
              onRelease={actions.handleReleaseShipmentsFromTrip}
              onRefresh={actions.handleReviewHandoff}
              onBack={actions.resetScanResult}
              btnStatus={state.btnStatus}
            />
          ) : state.needsNextTrip ? (
            <NextTripPrompt
              theme={theme}
              item={state.resolvedItem}
              onAssign={actions.handleReleaseSingleShipment}
              onSkip={() => {
                onClose();
                actions.resetFlow();
              }}
              btnStatus={state.btnStatus}
            />
          ) : state.needsCorrectionDispatch ? (
            <CorrectionDispatchPrompt
              theme={theme}
              btnStatus={state.btnStatus}
              onDispatch={actions.handleCorrectionDispatch}
            />
          ) : state.needsResumeReceiving ? (
            <StartReceivingPrompt
              theme={theme}
              btnStatus={state.btnStatus}
              mode="resume"
              onStartReceiving={actions.handleStartReceiving}
            />
          ) : state.needsStartReceiving ? (
            <StartReceivingPrompt
              theme={theme}
              btnStatus={state.btnStatus}
              onStartReceiving={actions.handleStartReceiving}
            />
          ) : state.needsArrival ? (
            <ArrivalPrompt
              theme={theme}
              btnStatus={state.btnStatus}
              onMarkArrived={actions.handleMarkArrived}
            />
          ) : state.needsUnlock ? (
            <UnlockPrompt
              theme={theme}
              btnStatus={state.btnStatus}
              onUnlock={actions.handleUnlockManifest}
            />
          ) : state.needsLoadedStatus ? (
            <LoadedStatusPrompt
              theme={theme}
              btnStatus={state.btnStatus}
              onSetLoaded={actions.handleSetTripLoaded}
              onSkip={() => actions.setNeedsLoadedStatus(false)}
            />
          ) : state.needsLock ? (
            <LockPrompt
              theme={theme}
              trip={trip}
              btnStatus={state.btnStatus}
              onLock={actions.handleLockManifest}
              onSkip={() => actions.setNeedsLock(false)}
            />
          ) : state.needsAssignmentItem ? (
            <AssignmentPrompt
              theme={theme}
              item={state.needsAssignmentItem}
              loading={state.loading}
              action={state.action}
              onAssign={actions.handleAssignShipment}
            />
          ) : state.resolvedItem && state.action !== "LOAD" ? (
            <ManifestPanel
              item={state.resolvedItem}
              action={state.action}
              scanStatus={state.scanStatus}
              quantities={state.quantities}
              setQuantities={actions.setQuantities}
              theme={theme}
            />
          ) : state.action ? (
            <div className="space-y-4">
              {!cameraOpen ? (
                <button
                  onClick={() => {
                    actions.setError("");
                    setCameraOpen(true);
                  }}
                  className={`w-full rounded-xl border p-6 flex flex-col items-center gap-2 font-bold ${theme.panelSurface}`}
                >
                  <FontAwesomeIcon icon={faCamera} size="lg" />{" "}
                  <span>Open Phone Camera</span>
                </button>
              ) : (
                <CameraScanner
                  key={`${scannerEngine}-${scannerSession}`}
                  scannerEngine={scannerEngine}
                  onDetected={async (code) => {
                    await actions.handleResolveScan(code);
                    setScannerSession((current) => current + 1);
                  }}
                  onClose={() => setCameraOpen(false)}
                  setError={actions.setError}
                  statusMessage={scannerStatusMessage}
                />
              )}

              <ScanStatusSelector
                action={state.action}
                value={state.scanStatus}
                options={state.scanStatusOptions}
                onChange={actions.setScanStatus}
                theme={theme}
              />

              <TripScanDetailsCard
                trip={trip}
                manifestShipments={manifestShipments}
                theme={theme}
                isDark={isDark}
              />

              <ScannerEngineSelect
                value={scannerEngine}
                onChange={(value) => {
                  actions.setError("");
                  setScannerEngine(value);
                }}
                theme={theme}
              />

              <ManualInput
                value={state.manualCode}
                onChange={(val) => {
                  actions.setError("");
                  actions.setManualCode(val);
                }}
                onSubmit={() => actions.handleResolveScan(state.manualCode)}
                loading={state.loading}
                theme={theme}
              />
            </div>
          ) : null}

          {state.error && (
            <div className={`${theme.errorBox} p-3 rounded-lg text-sm`}>
              <div>{state.error}</div>
              {errorGuidance && (
                <div className="mt-2 text-xs opacity-80">
                  <span className="font-semibold">Try this:</span>{" "}
                  {errorGuidance}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex gap-3 ${theme.header}`}>
          {state.needsAssignmentItem ||
          (state.resolvedItem && state.action !== "LOAD") ? (
            <>
              <button
                onClick={actions.resetFlow}
                className={`flex-1 ${theme.secondaryButton}`}
              >
                <FontAwesomeIcon icon={faUndo} className="mr-2" /> Reset
              </button>
              {state.resolvedItem &&
                !state.needsAssignmentItem &&
                state.action !== "LOAD" && (
                  <button
                    onClick={actions.handleConfirm}
                    disabled={state.loading}
                    className={`flex-[2] ${actionTheme.primary}`}
                  >
                    {state.loading ? (
                      <FontAwesomeIcon
                        icon={faCircleNotch}
                        spin
                        className="mr-2"
                      />
                    ) : (
                      <FontAwesomeIcon icon={faCheck} className="mr-2" />
                    )}
                    Confirm{" "}
                    {state.scanStatusOptions.find(
                      (opt) => opt.value === state.scanStatus,
                    )?.label || state.action}
                  </button>
                )}
            </>
          ) : (
            <button
              onClick={onClose}
              className={`w-full ${theme.secondaryButton}`}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
