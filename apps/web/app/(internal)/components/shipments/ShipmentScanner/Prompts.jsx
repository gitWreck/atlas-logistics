"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruckRampBox,
  faCheck,
  faLock,
  faUnlock,
  faTriangleExclamation,
  faRoute,
} from "@fortawesome/free-solid-svg-icons";
import StatusButton from "../../ui/StatusButton"; // Adjust path

function getTripSearchLabel(trip) {
  if (!trip) return "";

  return `${trip.id}${trip.route ? ` - ${trip.route}` : ""}`;
}

export function InterceptorPrompt({
  theme,
  icon,
  iconColor,
  title,
  description,
  children,
}) {
  return (
    <div
      className={`rounded-xl border p-6 text-center space-y-4 ${theme.panelSurface}`}
    >
      <div className={`${iconColor} mb-2`}>
        <FontAwesomeIcon icon={icon} size="3x" />
      </div>
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-sm opacity-80 mb-4">{description}</p>
      {children}
    </div>
  );
}

export function NextTripPrompt({
  theme,
  item,
  trips,
  selectedTrip,
  onSelectTrip,
  onAssign,
  onSkip,
  btnStatus,
}) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faTruckRampBox}
      iconColor="text-blue-500"
      title="Unload Successful!"
      description={`Shipment ${item.shipmentId} received. Assign to a delivery trip now?`}
    >
      <TripSearchSelect
        theme={theme}
        trips={trips}
        selectedTrip={selectedTrip}
        onSelectTrip={onSelectTrip}
      />
      <div className="space-y-2">
        <StatusButton
          status={btnStatus}
          label="Assign to Next Trip"
          icon={faCheck}
          variant="blue"
          onClick={onAssign}
        />
        <button onClick={onSkip} className="text-xs opacity-60 underline mt-2">
          Skip (Leave in Warehouse)
        </button>
      </div>
    </InterceptorPrompt>
  );
}

export function HandoffPrompt({
  theme,
  summary,
  trips,
  selectedTrip,
  onSelectTrip,
  missingRemarks,
  onRemarkChange,
  onAssign,
  onRefresh,
  onBack,
  btnStatus,
}) {
  const totals = summary?.totals || {};
  const missingShipments = summary?.missingShipments || [];
  const unloadedShipments = summary?.unloadedShipments || [];
  const hasMissing = missingShipments.length > 0;
  const remarksComplete = missingShipments.every((item) =>
    String(missingRemarks?.[item.id] || "").trim(),
  );
  const canAssign =
    trips.length > 0 && selectedTrip && (!hasMissing || remarksComplete);

  return (
    <InterceptorPrompt
      theme={theme}
      icon={hasMissing ? faTriangleExclamation : faTruckRampBox}
      iconColor={hasMissing ? "text-amber-500" : "text-emerald-500"}
      title="Manifest Reconciliation"
      description={
        hasMissing
          ? "Some manifest shipments still need remarks before handoff."
          : "All manifest shipments are accounted for and ready for delivery."
      }
    >
      <div className="grid grid-cols-3 gap-2 text-left">
        <MetricCard
          label="Manifest"
          value={totals.manifestShipments || 0}
          theme={theme}
        />
        <MetricCard
          label="Unloaded"
          value={totals.unloadedShipments || 0}
          theme={theme}
        />
        <MetricCard
          label="Missing"
          value={totals.missingShipments || 0}
          theme={theme}
        />
      </div>

      {hasMissing ? (
        <div className="space-y-3 text-left">
          <div className="text-[10px] font-bold uppercase opacity-60">
            Missing Remarks
          </div>
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {missingShipments.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 ${theme.panelSurface}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-bold truncate">
                      {item.shipmentId}
                    </div>
                    <div className="text-[11px] opacity-60 truncate">
                      {item.recipientName} - {item.destination}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold text-amber-500">
                    {item.remainingLoaded} left
                  </span>
                </div>
                <textarea
                  value={missingRemarks[item.id] || ""}
                  onChange={(e) => onRemarkChange(item.id, e.target.value)}
                  rows={2}
                  placeholder="Add a remark for this missing shipment..."
                  className={`mt-3 w-full rounded-lg border px-3 py-2 text-xs ${theme.input}`}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-left">
          <div className="text-[10px] font-bold uppercase opacity-60 mb-2">
            Ready Shipments
          </div>
          <div className="max-h-36 overflow-y-auto rounded-lg border divide-y divide-white/5">
            {unloadedShipments.map((item) => (
              <div
                key={item.id}
                className="p-2 flex justify-between gap-3 text-xs"
              >
                <span className="font-mono font-bold truncate">
                  {item.shipmentId}
                </span>
                <span className="opacity-60 shrink-0">
                  {item.unloadedCount}/{item.expectedCount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <TripSearchSelect
        theme={theme}
        trips={trips}
        selectedTrip={selectedTrip}
        onSelectTrip={onSelectTrip}
      />

      <div className="space-y-2">
        <StatusButton
          status={btnStatus}
          label="Assign to Delivery Trip"
          loadingLabel="Assigning..."
          successLabel="Handoff Complete"
          icon={faCheck}
          variant="blue"
          disabled={!canAssign}
          onClick={onAssign}
        />
        <div className="flex items-center justify-center gap-4">
          <button onClick={onBack} className="text-xs opacity-60 underline">
            Back to scanning
          </button>
          <button onClick={onRefresh} className="text-xs opacity-60 underline">
            Refresh reconciliation
          </button>
        </div>
      </div>
    </InterceptorPrompt>
  );
}

function TripSearchSelect({ theme, trips, selectedTrip, onSelectTrip }) {
  const [tripQuery, setTripQuery] = useState("");
  const [showTripSuggestions, setShowTripSuggestions] = useState(false);

  const selectedTripItem = useMemo(
    () => trips.find((trip) => trip.id === selectedTrip) || null,
    [selectedTrip, trips],
  );

  const filteredTripOptions = useMemo(() => {
    const keyword = tripQuery.trim().toLowerCase();
    if (!keyword) return trips;

    return trips.filter((trip) =>
      `${trip.id} ${trip.driverName || ""} ${trip.truckPlate || ""} ${
        trip.route || ""
      } ${trip.status || ""}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [tripQuery, trips]);

  useEffect(() => {
    setTripQuery(getTripSearchLabel(selectedTripItem));
  }, [selectedTripItem]);

  const handleTripType = (text) => {
    setTripQuery(text);
    setShowTripSuggestions(true);

    const exactMatch = trips.find(
      (trip) =>
        trip.id.toLowerCase() === text.trim().toLowerCase() ||
        getTripSearchLabel(trip).toLowerCase() === text.trim().toLowerCase(),
    );

    onSelectTrip(exactMatch?.id || "");
  };

  const handleTripSelect = (trip) => {
    onSelectTrip(trip?.id || "");
    setTripQuery(getTripSearchLabel(trip));
    setShowTripSuggestions(false);
  };

  return (
    <div className="text-left">
      <label className="text-[10px] font-bold uppercase opacity-60">
        Delivery Trip
      </label>
      <div className="relative mt-2">
        <input
          type="text"
          value={tripQuery}
          autoComplete="off"
          placeholder={
            trips.length === 0
              ? "No DELIVERY trips available"
              : "Type to search delivery trip..."
          }
          disabled={trips.length === 0}
          onChange={(e) => handleTripType(e.target.value)}
          onFocus={() => setShowTripSuggestions(true)}
          onBlur={() => setTimeout(() => setShowTripSuggestions(false), 200)}
          className={`w-full rounded-lg border px-3 py-2 text-sm font-bold outline-none transition-colors focus:border-blue-500 disabled:opacity-60 ${theme.input}`}
        />

        {showTripSuggestions && trips.length > 0 && (
          <div
            className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 max-h-56 overflow-y-auto ${theme.modal || theme.panelSurface}`}
          >
            {filteredTripOptions.length > 0 ? (
              filteredTripOptions.map((trip) => (
                <button
                  key={trip.id}
                  type="button"
                  onMouseDown={() => handleTripSelect(trip)}
                  className={`w-full text-left px-3 py-2 border-b last:border-b-0 transition-colors hover:bg-slate-500/10 ${theme.divider || ""}`}
                >
                  <div
                    className={`text-sm font-semibold flex items-center gap-2 ${theme.title}`}
                  >
                    <FontAwesomeIcon icon={faRoute} />
                    {trip.id}
                  </div>
                  <div className={`text-[11px] mt-0.5 ${theme.helperText}`}>
                    {trip.driverName || "Unassigned Driver"} -{" "}
                    {trip.truckPlate || "No Plate"} - {trip.status || "CREATED"}
                  </div>
                  {trip.route && (
                    <div className={`text-[11px] mt-0.5 ${theme.helperText}`}>
                      {trip.route}
                    </div>
                  )}
                </button>
              ))
            ) : (
              <div
                className={`p-3 text-center text-xs italic ${theme.helperText}`}
              >
                No matching trips found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, theme }) {
  return (
    <div className={`rounded-lg border p-3 ${theme.panelSurface}`}>
      <div className="text-[10px] font-bold uppercase opacity-50">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

export function ArrivalPrompt({ theme, btnStatus, onMarkArrived }) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faTruckRampBox}
      iconColor="text-blue-500"
      title="Mark Trip as Arrived"
      description="This trip is still in transit. Mark it as arrived, then continue unloading."
    >
      <StatusButton
        status={btnStatus}
        label="Mark as Arrived"
        icon={faCheck}
        variant="blue"
        onClick={onMarkArrived}
      />
    </InterceptorPrompt>
  );
}

export function UnlockPrompt({ theme, btnStatus, onUnlock }) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faLock}
      iconColor="text-amber-500"
      title="Manifest Locked"
      description="The manifest is locked. Unlock it before scanning items out."
    >
      <StatusButton
        status={btnStatus}
        label="Unlock Manifest"
        loadingLabel="Unlocking..."
        successLabel="Unlocked!"
        icon={faUnlock}
        variant="amber"
        onClick={onUnlock}
      />
    </InterceptorPrompt>
  );
}

export function LoadedStatusPrompt({ theme, btnStatus, onSetLoaded, onSkip }) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faCheck}
      iconColor="text-emerald-500"
      title="Trip is Fully Loaded"
      description="All pending items are loaded. Set the trip to LOADED before locking the manifest or dispatching."
    >
      <div className="space-y-2">
        <StatusButton
          status={btnStatus}
          label="Set to LOADED"
          icon={faTruckRampBox}
          variant="emerald"
          onClick={onSetLoaded}
        />
        <button onClick={onSkip} className="text-xs opacity-60 underline mt-2">
          Skip & load extra items
        </button>
      </div>
    </InterceptorPrompt>
  );
}

export function LockPrompt({ theme, trip, btnStatus, onLock, onSkip }) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faLock}
      iconColor="text-emerald-500"
      title="Ready for Dispatch"
      description="The trip is loaded. Lock the manifest to prevent further changes before dispatch."
    >
      <div className="space-y-2">
        <StatusButton
          status={btnStatus}
          label="Lock Manifest"
          loadingLabel="Locking..."
          successLabel="Locked!"
          icon={faLock}
          variant="emerald"
          onClick={onLock}
        />
        <button onClick={onSkip} className="text-xs opacity-60 underline mt-2">
          Skip & load extra items
        </button>
      </div>
    </InterceptorPrompt>
  );
}

export function AssignmentPrompt({ theme, item, loading, action, onAssign }) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faTruckRampBox}
      iconColor="text-amber-500"
      title="Assignment Required"
      description={`Shipment ${item.shipmentId} is not assigned to this trip. You must assign it before you can ${action?.toLowerCase()} its packages.`}
    >
      <button
        onClick={onAssign}
        disabled={loading}
        className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${loading ? "bg-gray-500" : "bg-blue-600 hover:bg-blue-500"}`}
      >
        {loading ? "Assigning..." : "Assign Shipment Now"}
      </button>
    </InterceptorPrompt>
  );
}
