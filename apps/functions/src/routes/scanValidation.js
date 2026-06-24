"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { canOverrideDeliveryScan } = require("../utilities/helpers");
const { getPackageIdentity } = require("../warehouse/packageDeliveryOperations");
const { normalizeString } = require("./routeHelpers");
const { checkerRouteIdsForDate } = require("./dailyRouteAssignmentHelpers");
const { writeScanAuditLog } = require("./scanAuditLog");

function normalizeRole(role = "") {
  return String(role || "").trim().toLowerCase();
}

function canOverrideScan(role = "", email = "") {
  return canOverrideDeliveryScan(normalizeRole(role), String(email || "").toLowerCase());
}

function buildWrongRouteMessage(pkg = {}, context = {}) {
  const identity = getPackageIdentity(pkg) || "package";
  const assignedRouteName =
    normalizeString(pkg.assignedRouteName) ||
    normalizeString(pkg.assignedRouteId) ||
    "another route";
  const scannerRouteName =
    normalizeString(context.scannerRouteName) ||
    normalizeString(context.scannerRouteId) ||
    "your route";

  return (
    `This package is assigned to another route.\n\n` +
    `Package: ${identity}\n\n` +
    `Assigned Route: ${assignedRouteName}\n\n` +
    `Your Route: ${scannerRouteName}\n\n` +
    `Please contact your manager if this package was assigned incorrectly.`
  );
}

function buildWrongCheckerMessage(pkg = {}, context = {}) {
  const identity = getPackageIdentity(pkg) || "package";
  const assignedCheckerName =
    normalizeString(pkg.assignedCheckerName) ||
    normalizeString(context.expectedCheckerName) ||
    normalizeString(pkg.assignedCheckerId) ||
    "another checker";
  const scannerName =
    normalizeString(context.scannerName) ||
    normalizeString(context.actualCheckerId) ||
    "you";

  return (
    `This package is assigned to another checker.\n\n` +
    `Package: ${identity}\n\n` +
    `Assigned Checker: ${assignedCheckerName}\n\n` +
    `Scanned By: ${scannerName}\n\n` +
    `Please contact your manager before loading this package.`
  );
}

function validateDeliveryPieceScan(
  pkg = {},
  {
    scannerUid = null,
    scannerName = null,
    scannerRole = "checker",
    scannerEmail = null,
    scanType = "LOAD",
    dailyAssignments = [],
    overrideReason = null,
  } = {},
) {
  const identity = getPackageIdentity(pkg) || "package";
  const packageRouteId = normalizeString(pkg.assignedRouteId);
  const packageCheckerId = normalizeString(pkg.assignedCheckerId);
  const actualCheckerId = normalizeString(scannerUid);
  const scannerRouteIds = checkerRouteIdsForDate(dailyAssignments, actualCheckerId);
  const actualRouteId = scannerRouteIds[0] || null;

  if (!packageRouteId) {
    return {
      ok: false,
      code: "ROUTE_NOT_ASSIGNED",
      result: "BLOCKED",
      message: `Package ${identity} has no delivery route assigned. Ask a manager to assign a route first.`,
      expectedRouteId: null,
      actualRouteId,
      expectedCheckerId: packageCheckerId,
      actualCheckerId,
    };
  }

  if (packageCheckerId && packageCheckerId !== actualCheckerId) {
    return {
      ok: false,
      code: "WRONG_CHECKER",
      result: "BLOCKED",
      message: buildWrongCheckerMessage(pkg, {
        expectedCheckerName: pkg.assignedCheckerName,
        scannerName,
        actualCheckerId,
      }),
      expectedRouteId: packageRouteId,
      actualRouteId,
      expectedCheckerId: packageCheckerId,
      actualCheckerId,
    };
  }

  if (
    scannerRouteIds.length > 0 &&
    !scannerRouteIds.includes(packageRouteId)
  ) {
    const assignmentForScanner = dailyAssignments.find(
      (row) => String(row.checkerId || "") === actualCheckerId,
    );
    return {
      ok: false,
      code: "WRONG_ROUTE",
      result: "BLOCKED",
      message: buildWrongRouteMessage(pkg, {
        scannerRouteId: assignmentForScanner?.routeId || actualRouteId,
        scannerRouteName: assignmentForScanner?.routeName || null,
      }),
      expectedRouteId: packageRouteId,
      actualRouteId: assignmentForScanner?.routeId || actualRouteId,
      expectedCheckerId: packageCheckerId,
      actualCheckerId,
    };
  }

  if (!packageCheckerId && scannerRouteIds.length === 0) {
    return {
      ok: false,
      code: "CHECKER_NOT_ASSIGNED",
      result: "BLOCKED",
      message:
        `Package ${identity} is not assigned to you yet. ` +
        `Ask a manager to assign you to route ${pkg.assignedRouteName || packageRouteId} before loading.`,
      expectedRouteId: packageRouteId,
      actualRouteId: null,
      expectedCheckerId: null,
      actualCheckerId,
    };
  }

  const overrideAllowed = canOverrideScan(scannerRole, scannerEmail);
  const hasOverride =
    overrideAllowed && Boolean(normalizeString(overrideReason));

  return {
    ok: true,
    code: hasOverride ? "OVERRIDE" : "PASS",
    result: hasOverride ? "OVERRIDE" : "PASS",
    message: null,
    expectedRouteId: packageRouteId,
    actualRouteId: packageRouteId,
    expectedCheckerId: packageCheckerId || actualCheckerId,
    actualCheckerId,
    overrideReason: hasOverride ? normalizeString(overrideReason) : null,
    scanType,
  };
}

function assertDeliveryPieceScanOrThrow(pkg, options = {}) {
  const validation = validateDeliveryPieceScan(pkg, options);
  if (validation.ok) return validation;

  if (canOverrideScan(options.scannerRole, options.scannerEmail) && normalizeString(options.overrideReason)) {
    return {
      ...validation,
      ok: true,
      result: "OVERRIDE",
      code: "OVERRIDE",
      overrideReason: normalizeString(options.overrideReason),
    };
  }

  throw new HttpsError("failed-precondition", validation.message);
}

async function enforceDeliveryScanValidation({
  db,
  pkg,
  shipmentId,
  scannerUid = null,
  scannerName = null,
  scannerRole = "checker",
  scannerEmail = null,
  scanType = "LOAD",
  dailyAssignments = [],
  overrideReason = null,
  gps = null,
  deviceId = null,
}) {
  const validation = validateDeliveryPieceScan(pkg, {
    scannerUid,
    scannerName,
    scannerRole,
    scannerEmail,
    scanType,
    dailyAssignments,
    overrideReason,
  });

  const finalValidation =
    !validation.ok &&
    canOverrideScan(scannerRole, scannerEmail) &&
    normalizeString(overrideReason)
      ? {
          ...validation,
          ok: true,
          result: "OVERRIDE",
          code: "OVERRIDE",
          overrideReason: normalizeString(overrideReason),
        }
      : validation;

  await writeScanAuditLog({
    db,
    packageId: getPackageIdentity(pkg),
    shipmentId,
    scanType,
    scannedBy: scannerName || scannerUid,
    scannedByRole: scannerRole,
    expectedRouteId: finalValidation.expectedRouteId,
    actualRouteId: finalValidation.actualRouteId,
    expectedCheckerId: finalValidation.expectedCheckerId,
    actualCheckerId: finalValidation.actualCheckerId,
    result: finalValidation.result,
    reason:
      finalValidation.overrideReason ||
      finalValidation.message ||
      null,
    gps,
    deviceId,
  });

  if (!finalValidation.ok) {
    throw new HttpsError("failed-precondition", finalValidation.message);
  }

  return finalValidation;
}

module.exports = {
  canOverrideScan,
  validateDeliveryPieceScan,
  assertDeliveryPieceScanOrThrow,
  enforceDeliveryScanValidation,
  buildWrongRouteMessage,
  buildWrongCheckerMessage,
};
