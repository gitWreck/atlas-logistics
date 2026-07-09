export function normalizeTrackingCode(code = "") {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

/** Piece labels like AT-...-SHP-583090-01 → parent shipment AT-...-SHP-583090 */
export function deriveParentShipmentCode(code = "") {
  const normalized = normalizeTrackingCode(code);
  const match = normalized.match(/^(AT-\d{8}-SHP-\d+)-(\d+)$/);
  return match ? match[1] : null;
}

/** Ordered lookup keys: exact label first, then parent shipment when input is a piece. */
export function getTrackingLookupCandidates(code = "") {
  const normalized = normalizeTrackingCode(code);
  if (!normalized) return [];

  const candidates = [normalized];
  const parent = deriveParentShipmentCode(normalized);
  if (parent) {
    candidates.push(parent);
  }

  return [...new Set(candidates)];
}
