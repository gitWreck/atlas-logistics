/* ======================================================
   CANONICAL DELAY REASONS REGISTRY
   ------------------------------------------------------
   Single source of truth for:
   - UI labels
   - SMS wording
   - Analytics categorization
   - Future escalation logic
====================================================== */

/* ===============================
   DELAY CATEGORIES (CANONICAL)
================================ */
export const DELAY_CATEGORIES = Object.freeze({
  PORT: "PORT",
  EXTERNAL: "EXTERNAL",
  FLEET: "FLEET",
  ADMIN: "ADMIN",
  OTHER: "OTHER"
});

/* ===============================
   DELAY REASON REGISTRY
================================ */
export const DELAY_REASON_REGISTRY = Object.freeze({
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
   BACKWARD-COMPATIBLE EXPORTS
   (DO NOT REMOVE — USED BY EXISTING CODE)
====================================================== */

// Canonical labels (UI + SMS)
export const DELAY_REASONS = Object.freeze(
  Object.fromEntries(
    Object.entries(DELAY_REASON_REGISTRY)
      .map(([key, value]) => [key, value.label])
  )
);

// Metadata for dashboards / analytics
export const DELAY_REASON_META = Object.freeze(
  Object.fromEntries(
    Object.entries(DELAY_REASON_REGISTRY)
      .map(([key, value]) => [
        key,
        { category: value.category, severity: value.severity }
      ])
  )
);

/* ======================================================
   SAFE HELPERS (HARDENED)
====================================================== */

export function getDelayReasonLabel(key) {
  return DELAY_REASON_REGISTRY[key]?.label || "Operational delay";
}

export function getDelayReasonCategory(key) {
  return DELAY_REASON_REGISTRY[key]?.category || DELAY_CATEGORIES.OTHER;
}

export function getDelaySeverity(key) {
  return DELAY_REASON_REGISTRY[key]?.severity ?? 1;
}
