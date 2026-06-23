"use strict";

const admin = require("firebase-admin");
const { cleanObject } = require("../utilities/helpers");

function writeScanAuditLog({
  db,
  tx = null,
  batch = null,
  packageId = null,
  shipmentId = null,
  scanType = null,
  scannedBy = null,
  scannedByRole = null,
  expectedRouteId = null,
  actualRouteId = null,
  expectedCheckerId = null,
  actualCheckerId = null,
  result = null,
  reason = null,
  gps = null,
  deviceId = null,
  meta = {},
}) {
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const logRef = db.collection("scan_audit_logs").doc();

  const logData = cleanObject({
    packageId,
    shipmentId,
    scanType,
    scannedBy,
    scannedByRole,
    expectedRouteId,
    actualRouteId,
    expectedCheckerId,
    actualCheckerId,
    result,
    reason: reason || null,
    gps: gps || null,
    deviceId: deviceId || null,
    meta: cleanObject(meta) || {},
    timestamp,
    createdAt: timestamp,
  });

  if (tx) {
    tx.set(logRef, logData);
    return logRef;
  }

  if (batch) {
    batch.set(logRef, logData);
    return logRef;
  }

  return logRef.set(logData).then(() => logRef);
}

module.exports = {
  writeScanAuditLog,
};
