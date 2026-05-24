import {
  DEFAULT_DETAILS_SHEET_HEIGHT,
  ISSUE_SCAN_ACTIONS,
  MAX_DETAILS_SHEET_HEIGHT,
  MIN_DETAILS_SHEET_HEIGHT,
  MODE_SCAN_ACTIONS,
  OFFLOAD_COMPLETION_SOURCE_STATUSES,
} from "../constants/scanner";

export const clampSheetHeight = (height) =>
  Math.max(
    MIN_DETAILS_SHEET_HEIGHT,
    Math.min(height, MAX_DETAILS_SHEET_HEIGHT),
  );

export const normalizeProofImages = (images) => {
  if (!images) return [];
  return Array.isArray(images)
    ? images.filter(Boolean)
    : [images].filter(Boolean);
};

export const getDefaultScanStatus = (mode) =>
  MODE_SCAN_ACTIONS[mode]?.[0]?.status ?? null;

export const isIssueStatus = (status) =>
  ISSUE_SCAN_ACTIONS.some((action) => action.status === status);

export const canApplyOffloadCompletion = (status) =>
  OFFLOAD_COMPLETION_SOURCE_STATUSES.includes(
    String(status || "").toUpperCase(),
  );

export const clampProgress = (value, total) => {
  if (!total) return 0;
  return Math.max(0, Math.min(value, total));
};

export const getShipmentTotal = (shipment = {}) => {
  const total =
    shipment.totalItems ??
    shipment.packageCount ??
    shipment.totals?.totalContentQty ??
    shipment.totals?.totalItems ??
    shipment.packageBarcodes?.length ??
    shipment.packages?.length ??
    0;

  return Math.max(Number(total) || 0, 0);
};

export const getShipmentScannedCount = (shipment = {}, mode = "") => {
  const total = getShipmentTotal(shipment);
  const loaded = Number(shipment.loadedCount ?? shipment.totals?.loaded ?? 0);
  const missing = Number(
    shipment.missingCount ?? shipment.totals?.missing ?? 0,
  );
  const damaged = Number(
    shipment.damagedCount ?? shipment.totals?.damaged ?? 0,
  );
  const received = Number(
    shipment.receivedCount ??
      shipment.deliveredCount ??
      shipment.totals?.received ??
      shipment.totals?.delivered ??
      0,
  );

  if (mode === "offloading") {
    return clampProgress(received + missing + damaged, total);
  }

  if (mode === "loading") {
    return clampProgress(loaded + missing + damaged, total);
  }

  return clampProgress(Math.max(loaded, received) + missing + damaged, total);
};

export const getShipmentLoadedCount = (shipment = {}) => {
  const total = getShipmentTotal(shipment);
  const loaded = Number(shipment.loadedCount ?? shipment.totals?.loaded ?? 0);

  return clampProgress(loaded, total);
};

export const getPackageIdentity = (pkg = {}) =>
  String(pkg.packageId || pkg.trackingNumber || "").trim();

export const getShipmentPackageIds = (shipment = {}) =>
  (Array.isArray(shipment.packages) ? shipment.packages : [])
    .map(getPackageIdentity)
    .filter(Boolean);

export const getShipmentDeliveredCount = (shipment = {}) => {
  const total = getShipmentTotal(shipment);
  const delivered = Number(
    shipment.deliveredCount ?? shipment.totals?.delivered ?? 0,
  );

  return clampProgress(delivered, total);
};

export const getModeLabel = (mode) =>
  mode === "offloading" ? "Offloading" : mode === "info" ? "Info" : "Loading";

export const getLatestTypeLabel = (type) =>
  type === "package" ? "Package" : type === "shipment" ? "Shipment" : "Waiting";

export const getProgressLabel = (mode) =>
  mode === "offloading" ? "Offloaded" : mode === "info" ? "Scanned" : "Loaded";

export const buildLatestScanDetails = ({
  shipmentDoc,
  shipmentData,
  pkg = null,
  barcode,
  currentTripId,
  source = "scan",
  appliedStatus = "",
}) => ({
  type: pkg ? "package" : "shipment",
  code: barcode,
  title: pkg ? "Package Scanned" : "Shipment Scanned",
  shipmentId: shipmentDoc.id,
  trackingNumber:
    shipmentData.trackingNumber || shipmentData.shipmentId || shipmentDoc.id,
  packageStatus: appliedStatus || pkg?.status || "",
  shipmentStatus: shipmentData.status || "",
  currentTripId,
  customerName:
    shipmentData.recipient?.name ||
    shipmentData.receiverName ||
    shipmentData.sender?.name ||
    "",
  source,
});

export { DEFAULT_DETAILS_SHEET_HEIGHT };
