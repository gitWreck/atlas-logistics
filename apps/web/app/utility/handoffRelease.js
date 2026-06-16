/**
 * Client-safe handoff release helpers (no firebase-admin).
 */

export function getReleasableHandoffShipments(summary = {}) {
  const allRows =
    Array.isArray(summary.shipments) && summary.shipments.length
      ? summary.shipments
      : [
          ...(summary.unloadedShipments || []),
          ...(summary.missingShipments || []),
        ];

  const seen = new Set();
  return allRows.filter((row) => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return (Number(row.unloadedCount) || 0) > 0;
  });
}

export function hasReleasableHandoffPieces(summary = {}) {
  const totals = summary.totals || {};
  if ((Number(totals.unloadedPieces) || 0) > 0) return true;
  return getReleasableHandoffShipments(summary).length > 0;
}
