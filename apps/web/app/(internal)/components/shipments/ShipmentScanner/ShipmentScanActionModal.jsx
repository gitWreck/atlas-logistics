"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faUndo,
  faCircleNotch,
  faCheck,
  faCamera,
} from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";

import useScannerLogic from "./useScannerLogic";
import {
  NextTripPrompt,
  ArrivalPrompt,
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
  ScannerEngineSelect,
} from "./ScannerControls";
import ManifestPanel from "./ManifestPanel";

export default function ShipmentScanActionModal({
  isOpen = false,
  onClose,
  trip = null,
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

  const { state, actions } = useScannerLogic({
    trip,
    onResolveScan,
    onConfirmOperation,
    onClose,
    onRefresh,
    user,
    profile,
  });

  if (!isOpen) return null;

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

          {state.successNotice && !state.error && (
            <div
              className={`rounded-xl border p-4 flex items-start gap-3 ${theme.panelSurface}`}
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-emerald-500">
                  Successfully scanned
                </div>
                <div className="mt-1 text-xs opacity-70">
                  {state.successNotice.action} completed for{" "}
                  <span className="font-mono font-bold">
                    {state.successNotice.code}
                  </span>
                  {state.successNotice.totalQuantity > 0
                    ? ` (${state.successNotice.totalQuantity} item${state.successNotice.totalQuantity === 1 ? "" : "s"})`
                    : ""}
                </div>
              </div>
            </div>
          )}

          {state.action === "UNLOAD" &&
            !state.needsHandoff &&
            !state.needsNextTrip &&
            !state.needsArrival &&
            !state.needsUnlock &&
            !state.resolvedItem &&
            !state.needsAssignmentItem && (
              <button
                type="button"
                onClick={actions.handleReviewHandoff}
                disabled={state.loading}
                className={`w-full rounded-xl border px-4 py-3 text-sm font-bold text-left ${theme.panelSurface}`}
              >
                Review manifest handoff
                <span className="block text-[11px] font-normal opacity-60">
                  Manifest reconciliation
                </span>
              </button>
            )}

          {state.needsHandoff ? (
            <HandoffPrompt
              theme={theme}
              summary={state.handoffSummary}
              trips={state.availableTrips}
              selectedTrip={state.selectedNextTrip}
              onSelectTrip={actions.setSelectedNextTrip}
              missingRemarks={state.missingRemarks}
              onRemarkChange={(shipmentId, value) =>
                actions.setMissingRemarks((prev) => ({
                  ...prev,
                  [shipmentId]: value,
                }))
              }
              onAssign={actions.handleAssignNextTrip}
              onRefresh={actions.handleReviewHandoff}
              btnStatus={state.btnStatus}
            />
          ) : state.needsNextTrip ? (
            <NextTripPrompt
              theme={theme}
              item={state.resolvedItem}
              trips={state.availableTrips}
              selectedTrip={state.selectedNextTrip}
              onSelectTrip={actions.setSelectedNextTrip}
              onAssign={actions.handleAssignNextTrip}
              onSkip={() => {
                onClose();
                actions.resetFlow();
              }}
              btnStatus={state.btnStatus}
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
          ) : state.resolvedItem ? (
            <ManifestPanel
              item={state.resolvedItem}
              action={state.action}
              quantities={state.quantities}
              setQuantities={actions.setQuantities}
              theme={theme}
            />
          ) : state.action ? (
            <div className="space-y-4">
              <ScannerEngineSelect
                value={scannerEngine}
                onChange={(value) => {
                  actions.setError("");
                  setScannerEngine(value);
                }}
                theme={theme}
              />

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
                  key={scannerEngine}
                  scannerEngine={scannerEngine}
                  onDetected={async (code) => {
                    setCameraOpen(false);
                    await actions.handleResolveScan(code);
                  }}
                  onClose={() => setCameraOpen(false)}
                  setError={actions.setError}
                />
              )}
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
              {state.error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex gap-3 ${theme.header}`}>
          {state.resolvedItem || state.needsAssignmentItem ? (
            <>
              <button
                onClick={actions.resetFlow}
                className={`flex-1 ${theme.secondaryButton}`}
              >
                <FontAwesomeIcon icon={faUndo} className="mr-2" /> Reset
              </button>
              {state.resolvedItem && !state.needsAssignmentItem && (
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
                  Confirm {state.action}
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
