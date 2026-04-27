"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruckRampBox,
  faCheck,
  faLock,
  faUnlock,
} from "@fortawesome/free-solid-svg-icons";
import StatusButton from "../../ui/StatusButton"; // Adjust path

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
      <select
        value={selectedTrip}
        onChange={(e) => onSelectTrip(e.target.value)}
        className={`w-full p-3 rounded-lg border mb-4 font-bold ${theme.input}`}
      >
        {trips.map((t) => (
          <option key={t.id} value={t.id}>
            {t.id} ({t.driverName})
          </option>
        ))}
      </select>
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

export function ArrivalPrompt({ theme, btnStatus, onMarkArrived }) {
  return (
    <InterceptorPrompt
      theme={theme}
      icon={faTruckRampBox}
      iconColor="text-blue-500"
      title="Mark Trip as Arrived"
      description="You must mark this trip as arrived before unloading."
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
      description="You must unlock the manifest before you can scan items out."
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
      description="All pending items are loaded. Change status to LOADED?"
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
      description="The trip is loaded. Lock the manifest to prevent further changes."
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
        {trip?.status?.toUpperCase() !== "LOADED" && (
          <button
            onClick={onSkip}
            className="text-xs opacity-60 underline mt-2"
          >
            Skip & load extra items
          </button>
        )}
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
