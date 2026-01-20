"use strict";

/* ======================================================
   CANONICAL DELAY REASONS — BACKEND (COMMONJS)
   ------------------------------------------------------
   Single source of truth for:
   • SMS wording
   • Backend logic
   • Analytics categorization
   • Escalation & severity modeling

   ⚠️  Backend-only (Node / Firebase Functions)
   ⚠️  DO NOT import directly into frontend
====================================================== */

/* ======================================================
   INTERNAL HELPERS
====================================================== */

/**
 * Deep-freeze an object to prevent mutation at runtime.
 * @param {object} obj
 * @returns {object}
 */
function deepFreeze(obj) {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = obj[prop];
    if (
      value &&
      typeof value === "object" &&
      !Object.isFrozen(value)
    ) {
      deepFreeze(value);
    }
  });
  return obj;
}

/* ======================================================
   DELAY CATEGORIES (CANONICAL)
====================================================== */

/**
 * @readonly
 * @enum {string}
 */
const DELAY_CATEGORIES = deepFreeze({
  PORT: "PORT",
  EXTERNAL: "EXTERNAL",
  FLEET: "FLEET",
  ADMIN: "ADMIN",
  OTHER: "OTHER"
});

/* ======================================================
   DELAY REASON REGISTRY
====================================================== */

/**
 * @typedef {Object} DelayReason
 * @property {string} label       - Human-readable label (SMS/UI safe)
 * @property {string} category    - One of DELAY_CATEGORIES
 * @property {number} severity    - 1 (low) → 5 (critical)
 */

/**
 * @type {Readonly<Record<string, DelayReason>>}
 */
const DELAY_REASON_REGISTRY = deepFreeze({
  RORO_FULL: {
    label: "RORO vessel is full",
    category: DELAY_CATEGORIES.PORT,
    severity: 2
  },
  WEATHER: {
    label: "Weather advisory",
    category: DELAY_CATEGORIES.EXTERNAL,
    severity: 3
  },
  TRUCK_REPAIR: {
    label: "Truck under repair",
    category: DELAY_CATEGORIES.FLEET,
    severity: 2
  },
  PORT_CONGESTION: {
    label: "Port congestion",
    category: DELAY_CATEGORIES.PORT,
    severity: 2
  },
  DOCUMENT_ISSUE: {
    label: "Documentation issue",
    category: DELAY_CATEGORIES.ADMIN,
    severity: 1
  }
});

/* ======================================================
   BACKWARD-COMPATIBLE MAP (LABELS ONLY)
   ------------------------------------------------------
   Used by legacy code, SMS builders, and lightweight UIs
====================================================== */

/**
 * @type {Readonly<Record<string, string>>}
 */
const DELAY_REASONS = deepFreeze(
  Object.fromEntries(
    Object.entries(DELAY_REASON_REGISTRY).map(
      ([key, value]) => [key, value.label]
    )
  )
);

/* ======================================================
   SAFE ACCESSORS (NEVER THROW)
====================================================== */

/**
 * Get human-readable label for a delay reason.
 * @param {string} key
 * @returns {string}
 */
function getDelayReasonLabel(key) {
  return (
    DELAY_REASON_REGISTRY[key]?.label ||
    "Operational delay"
  );
}

/**
 * Get category for a delay reason.
 * @param {string} key
 * @returns {string}
 */
function getDelayReasonCategory(key) {
  return (
    DELAY_REASON_REGISTRY[key]?.category ||
    DELAY_CATEGORIES.OTHER
  );
}

/**
 * Get severity level for a delay reason.
 * @param {string} key
 * @returns {number}
 */
function getDelaySeverity(key) {
  return (
    DELAY_REASON_REGISTRY[key]?.severity ?? 1
  );
}

/* ======================================================
   MODULE EXPORTS (CANONICAL)
====================================================== */

module.exports = {
  // enums / registries
  DELAY_CATEGORIES,
  DELAY_REASON_REGISTRY,
  DELAY_REASONS,

  // helpers
  getDelayReasonLabel,
  getDelayReasonCategory,
  getDelaySeverity
};
