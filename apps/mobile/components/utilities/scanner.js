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

export {
  getDefaultScanStatus,
  getPrimaryScanActions,
  isCheckerLastMileScanMode,
} from "../constants/scanner";

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
  const data = shipment || {};
  const total =
    data.totalItems ??
    data.packageCount ??
    data.totals?.totalContentQty ??
    data.totals?.totalItems ??
    data.packageBarcodes?.length ??
    data.packages?.length ??
    0;

  return Math.max(Number(total) || 0, 0);
};

export const getShipmentScannedCount = (shipment = {}, mode = "") => {
  const data = shipment || {};
  const total = getShipmentTotal(data);
  const loaded = Number(data.loadedCount ?? data.totals?.loaded ?? 0);
  const missing = Number(data.missingCount ?? data.totals?.missing ?? 0);
  const damaged = Number(data.damagedCount ?? data.totals?.damaged ?? 0);
  const received = Number(
    data.receivedCount ??
      data.deliveredCount ??
      data.totals?.received ??
      data.totals?.delivered ??
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
  const data = shipment || {};
  const total = getShipmentTotal(data);
  const loaded = Number(data.loadedCount ?? data.totals?.loaded ?? 0);

  return clampProgress(loaded, total);
};

export const getPackageIdentity = (pkg = {}) =>
  String(pkg.packageId || pkg.trackingNumber || "").trim();

export const normalizeScanCode = (code = "") =>
  String(code || "").trim().toUpperCase();

/** Piece labels like AT-...-SHP-583090-01 → parent shipment code AT-...-SHP-583090 */
export const deriveParentShipmentCode = (code = "") => {
  const normalized = normalizeScanCode(code);
  const match = normalized.match(/^(.*)-(\d{2})$/);
  return match ? match[1] : null;
};

export const findPackageInShipment = (shipmentData = {}, code = "") => {
  const needle = normalizeScanCode(code);
  if (!needle) return null;

  return (
    (Array.isArray(shipmentData.packages) ? shipmentData.packages : []).find(
      (pkg) => {
        const packageId = normalizeScanCode(pkg.packageId);
        const trackingNumber = normalizeScanCode(pkg.trackingNumber);
        return packageId === needle || trackingNumber === needle;
      },
    ) || null
  );
};

export const isWholeShipmentScanCode = (shipmentData = {}, code = "") => {
  const needle = normalizeScanCode(code);
  if (!needle) return false;

  const shipmentKeys = [
    shipmentData?.trackingNumber,
    shipmentData?.shipmentId,
    shipmentData?.id,
  ]
    .map(normalizeScanCode)
    .filter(Boolean);

  return shipmentKeys.includes(needle);
};

/** Offload/delivery: default to one piece unless the code is the master shipment label. */
export const resolveOffloadDeliverPackageIds = (
  shipmentData = {},
  barcode = "",
  scanType = "",
) => {
  const trimmedBarcode = String(barcode || "").trim();
  if (!trimmedBarcode) {
    return { isPackageLevel: false, packageIds: [] };
  }

  if (
    scanType === "shipment" &&
    isWholeShipmentScanCode(shipmentData, trimmedBarcode)
  ) {
    return {
      isPackageLevel: false,
      packageIds: getShipmentPackageIds(shipmentData),
    };
  }

  const matchedPkg = findPackageInShipment(shipmentData, trimmedBarcode);
  if (matchedPkg) {
    const packageId = String(matchedPkg.packageId || "").trim();
    return {
      isPackageLevel: true,
      packageIds: packageId ? [packageId] : [],
    };
  }

  if (scanType === "package" || deriveParentShipmentCode(trimmedBarcode)) {
    return {
      isPackageLevel: true,
      packageIds: [trimmedBarcode],
    };
  }

  return { isPackageLevel: true, packageIds: [trimmedBarcode] };
};

export const resolveDeliveryPackageIds = ({
  barcode = "",
  scanType = "",
  shipmentData = null,
} = {}) => {
  const trimmedBarcode = String(barcode || "").trim();
  if (!trimmedBarcode) {
    return { isPackageLevel: false, packageIds: null };
  }

  const matchedPkg = shipmentData
    ? findPackageInShipment(shipmentData, trimmedBarcode)
    : null;

  if (matchedPkg) {
    const packageId = String(matchedPkg.packageId || "").trim();
    return {
      isPackageLevel: true,
      packageIds: packageId ? [packageId] : [],
    };
  }

  if (scanType === "package") {
    return { isPackageLevel: true, packageIds: [trimmedBarcode] };
  }

  if (scanType === "shipment") {
    return { isPackageLevel: false, packageIds: null };
  }

  return { isPackageLevel: false, packageIds: null };
};

export const getDeliverPackageIdForScan = (shipmentData = {}, barcode = "") => {
  const matchedPkg = findPackageInShipment(shipmentData, barcode);
  if (matchedPkg?.packageId) {
    return String(matchedPkg.packageId).trim();
  }
  return String(barcode || "").trim();
};

export const getShipmentPackageIds = (shipment = {}) =>
  (Array.isArray((shipment || {}).packages) ? (shipment || {}).packages : [])
    .map(getPackageIdentity)
    .filter(Boolean);

export const getShipmentDeliveredCount = (shipment = {}) => {
  const data = shipment || {};
  const total = getShipmentTotal(data);
  const delivered = Number(data.deliveredCount ?? data.totals?.delivered ?? 0);

  return clampProgress(delivered, total);
};

export const getModeLabel = (mode) => {
  if (mode === "offloading") return "Offloading";
  if (mode === "delivery") return "Load";
  if (mode === "info") return "Info";
  return "Loading";
};

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
