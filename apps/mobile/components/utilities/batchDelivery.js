import { canApplyOffloadCompletion } from "./scanner";
import { isCheckerCustodyPiece } from "./checkerDeliveryPool";

const BATCH_SCAN_STATUSES = new Set([
  "DELIVERED",
  "FAILED_DELIVERY",
  "RETURNED_TO_WAREHOUSE",
]);

const FAILABLE_PIECE_STATUSES = new Set([
  "OUT_FOR_DELIVERY",
  "LOADED_TO_DELIVERY_VEHICLE",
  "LOADED",
  "READY_FOR_DELIVERY",
  "PARTIALLY_LOADED",
]);

const RETURNABLE_PIECE_STATUSES = new Set([
  "FAILED_DELIVERY",
  "OUT_FOR_DELIVERY",
  "LOADED_TO_DELIVERY_VEHICLE",
  "LOADED",
  "READY_FOR_DELIVERY",
  "PARTIALLY_LOADED",
]);

function normalizeStatus(value) {
  return String(value || "").trim().toUpperCase();
}

export function isBatchScanMode(mode, scanActionStatus) {
  const status = normalizeStatus(scanActionStatus);
  if (!BATCH_SCAN_STATUSES.has(status)) return false;
  return mode === "delivery" || mode === "offloading";
}

export function isBatchDeliveryScanMode(mode, scanActionStatus) {
  return (
    normalizeStatus(scanActionStatus) === "DELIVERED" &&
    isBatchScanMode(mode, scanActionStatus)
  );
}

export function getBatchPieceLabel(pkg = {}, barcode = "") {
  const packageId = String(pkg?.packageId || pkg?.trackingNumber || barcode || "")
    .trim();
  const suffixMatch = packageId.match(/-(\d{2})$/);
  if (suffixMatch) {
    return `Package ${suffixMatch[1]}`;
  }
  return packageId || "Piece";
}

function assertDeliverablePiece(pkg, shipmentData, { mode, checkerUid }) {
  const packageId = String(pkg?.packageId || pkg?.trackingNumber || "").trim();
  if (!packageId) {
    throw new Error(
      "Scan an individual piece label to deliver. Master tracking alone cannot complete delivery.",
    );
  }

  const pieceStatus = normalizeStatus(pkg.status);
  const shipmentStatus = normalizeStatus(shipmentData?.status);

  if (mode === "delivery") {
    if (!checkerUid || !isCheckerCustodyPiece(pkg, checkerUid)) {
      throw new Error("This piece is not on your deliveries.");
    }
    if (
      !canApplyOffloadCompletion(pieceStatus) &&
      !canApplyOffloadCompletion(shipmentStatus)
    ) {
      throw new Error(
        "Piece must be out for delivery before it can be marked delivered.",
      );
    }
    return packageId;
  }

  if (mode === "offloading") {
    if (
      !canApplyOffloadCompletion(pieceStatus) &&
      !canApplyOffloadCompletion(shipmentStatus)
    ) {
      throw new Error(
        "This item must be out for delivery before it can be marked delivered.",
      );
    }
    return packageId;
  }

  throw new Error("Unsupported delivery scan mode.");
}

function assertFailablePiece(pkg, { checkerUid }) {
  const packageId = String(pkg?.packageId || pkg?.trackingNumber || "").trim();
  if (!packageId) {
    throw new Error(
      "Scan an individual piece label. Master tracking alone cannot mark failed delivery.",
    );
  }
  if (!checkerUid || !isCheckerCustodyPiece(pkg, checkerUid)) {
    throw new Error("This piece is not on your deliveries.");
  }
  const pieceStatus = normalizeStatus(pkg.status);
  if (!FAILABLE_PIECE_STATUSES.has(pieceStatus)) {
    throw new Error(
      "Piece must be out for delivery before it can be marked failed.",
    );
  }
  return packageId;
}

function assertReturnablePiece(pkg, { checkerUid }) {
  const packageId = String(pkg?.packageId || pkg?.trackingNumber || "").trim();
  if (!packageId) {
    throw new Error(
      "Scan an individual piece label. Master tracking alone cannot return to warehouse.",
    );
  }
  if (!checkerUid || !isCheckerCustodyPiece(pkg, checkerUid)) {
    throw new Error("This piece is not on your van.");
  }
  const pieceStatus = normalizeStatus(pkg.status);
  if (!RETURNABLE_PIECE_STATUSES.has(pieceStatus)) {
    throw new Error(
      "Mark failed delivery first, or load the piece before returning to warehouse.",
    );
  }
  return packageId;
}

export function assertPieceEligibleForBatchDelivery(
  pkg = {},
  shipmentData = {},
  options = {},
) {
  return assertDeliverablePiece(pkg, shipmentData, options);
}

export function assertPieceEligibleForBatchScan(
  pkg = {},
  shipmentData = {},
  { mode, scanActionStatus, checkerUid } = {},
) {
  const action = normalizeStatus(scanActionStatus);
  if (action === "DELIVERED") {
    return assertDeliverablePiece(pkg, shipmentData, { mode, checkerUid });
  }
  if (action === "FAILED_DELIVERY") {
    return assertFailablePiece(pkg, { checkerUid });
  }
  if (action === "RETURNED_TO_WAREHOUSE") {
    return assertReturnablePiece(pkg, { checkerUid });
  }
  throw new Error("Unsupported batch scan action.");
}

export function createEmptyBatchDeliverySession() {
  return null;
}

export function appendBatchDeliveryPiece(session, piece) {
  const pieces = Array.isArray(session?.pieces) ? session.pieces : [];
  if (pieces.some((row) => row.packageId === piece.packageId)) {
    return { session, added: false, duplicate: true };
  }
  return {
    session: {
      ...session,
      pieces: [...pieces, piece],
    },
    added: true,
    duplicate: false,
  };
}

export function getBatchScanCompleteLabel(scanActionStatus = "") {
  const action = normalizeStatus(scanActionStatus);
  if (action === "FAILED_DELIVERY") return "Complete scan & select reason";
  if (action === "RETURNED_TO_WAREHOUSE") return "Complete scan & confirm return";
  return "Complete scan & take POD";
}

export function getBatchScanSummaryEyebrow(scanActionStatus = "") {
  const action = normalizeStatus(scanActionStatus);
  if (action === "FAILED_DELIVERY") return "Failed delivery";
  if (action === "RETURNED_TO_WAREHOUSE") return "Return to warehouse";
  return "Delivered items";
}
