"use strict";

const { HttpsError } = require("firebase-functions/v2/https");
const { getPackageIdentity } = require("../warehouse/packageDeliveryOperations");
const { writeScanAuditLog } = require("./scanAuditLog");
const {
  validateCheckerMunicipalityAccess,
} = require("../../shared/deliveryMunicipalities");

async function enforceMunicipalityDeliveryAccess({
  db,
  shipment = {},
  shipmentId = null,
  checkerUser = {},
  scannerUid = null,
  scannerName = null,
  scannerRole = "checker",
  scanType = "LOAD",
  pkg = null,
  gps = null,
  deviceId = null,
}) {
  const validation = validateCheckerMunicipalityAccess(shipment, checkerUser);

  await writeScanAuditLog({
    db,
    packageId: pkg ? getPackageIdentity(pkg) : null,
    shipmentId,
    scanType,
    scannedBy: scannerName || scannerUid,
    scannedByRole: scannerRole,
    expectedRouteId: validation.municipality,
    actualRouteId: validation.municipality,
    expectedCheckerId: scannerUid,
    actualCheckerId: scannerUid,
    result: validation.ok ? "PASS" : "BLOCKED",
    reason: validation.message,
    gps,
    deviceId,
    meta: {
      validationCode: validation.code,
      assignedMunicipalities: validation.assignedMunicipalities,
    },
  });

  if (!validation.ok) {
    throw new HttpsError("failed-precondition", validation.message);
  }

  return validation;
}

module.exports = {
  enforceMunicipalityDeliveryAccess,
  validateCheckerMunicipalityAccess,
};
