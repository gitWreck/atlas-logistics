"use strict";

/**
 * =========================================================
 * ⛔ CANONICAL DELAY REASONS (SINGLE SOURCE OF TRUTH)
 * ---------------------------------------------------------
 * - Backend authoritative
 * - Used by SMS, UI, audit logs
 * - Keys are STABLE ENUMS
 * =========================================================
 */

const DELAY_REASONS = Object.freeze({
  WEATHER: "Weather conditions",
  RORO_FULL: "No available RORO vessel",
  PORT_CONGESTION: "Port congestion",
  MECHANICAL: "Truck mechanical issue",
  HOLIDAY: "Holiday operational delay",
  FORCE_MAJEURE: "Unforeseen circumstances"
});

module.exports = {
  DELAY_REASONS
};
