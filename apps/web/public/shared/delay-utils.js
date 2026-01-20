/**
 * Get delay duration as a human-readable string
 *
 * Accepts:
 * - Firestore Timestamp
 * - JS Date
 * - Milliseconds (number)
 * - ISO date string
 *
 * Returns:
 * - "just now"
 * - "5 min"
 * - "1h 10m"
 * - null (if invalid)
 */
export function getDelayDuration(delayStartedAt) {
  const start = normalizeDate(delayStartedAt);
  if (!start) return null;

  const diffMs = Date.now() - start.getTime();
  if (diffMs <= 0) return "just now";

  const mins = Math.floor(diffMs / 60000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;

  const h = Math.floor(mins / 60);
  const m = mins % 60;

  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/* ======================================================
   INTERNAL: SAFE DATE NORMALIZER
====================================================== */
function normalizeDate(input) {
  if (!input) return null;

  // Firestore Timestamp
  if (typeof input.toDate === "function") {
    const d = input.toDate();
    return isNaN(d.getTime()) ? null : d;
  }

  // JS Date
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  // Milliseconds
  if (typeof input === "number") {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO string
  if (typeof input === "string") {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}
