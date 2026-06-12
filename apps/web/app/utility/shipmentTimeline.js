"use strict";

/**
 * Map live shipment statuses (including derived master codes) to timeline steps.
 */
const TIMELINE_STATUS_ALIASES = Object.freeze({
  RELEASED_FOR_DELIVERY: "AVAILABLE_FOR_DELIVERY",
  AVAILABLE_AT_ODIONGAN_WAREHOUSE: "ARRIVED",
  AVAILABLE_AT_WAREHOUSE: "ARRIVED",
  RECEIVED_AT_DIVISORIA: "RECEIVED",
  ARRIVED_AT_ODIONGAN: "ARRIVED",
  LOADED_TO_TRIP: "LOADED",
  LOADED_TO_DELIVERY_VEHICLE: "OUT_FOR_DELIVERY",
  PARTIALLY_ON_CHECKER_VAN: "PARTIALLY_AVAILABLE_FOR_DELIVERY",
});

function normalizeStatus(status = "") {
  return String(status || "").trim().toUpperCase();
}

/**
 * Resolve drawer / tracking timeline position for a shipment status.
 * @returns {{ index: number, step: string|null, rawStatus: string, isKnown: boolean }}
 */
export function getShipmentTimelinePosition(status = "", steps = []) {
  const rawStatus = normalizeStatus(status);
  const mapped = TIMELINE_STATUS_ALIASES[rawStatus] || rawStatus;

  let index = steps.indexOf(mapped);
  if (index >= 0) {
    return { index, step: steps[index], rawStatus, isKnown: true };
  }

  if (mapped.startsWith("PARTIALLY_")) {
    const base = mapped.slice("PARTIALLY_".length);
    const partialIndex = steps.indexOf(mapped);
    if (partialIndex >= 0) {
      return {
        index: partialIndex,
        step: steps[partialIndex],
        rawStatus,
        isKnown: true,
      };
    }
    const baseIndex = steps.indexOf(base);
    if (baseIndex >= 0) {
      return {
        index: baseIndex,
        step: steps[baseIndex],
        rawStatus,
        isKnown: true,
        isPartial: true,
      };
    }
  }

  return { index: -1, step: null, rawStatus, isKnown: false };
}
