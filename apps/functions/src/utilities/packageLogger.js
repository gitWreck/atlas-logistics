"use strict";

const admin = require("firebase-admin");
const { cleanObject } = require("./helpers");

function buildPackageActionLog({
  action,
  packageId = null,
  packageDocId = packageId || null,
  trackingNumber = null,
  trackingPackageId = trackingNumber || packageId || packageDocId || null,
  shipmentId = null,
  shipmentDocId = shipmentId || null,
  tripId = null,
  actorId = null,
  actorName = null,
  actorRole = null,
  details = {},
  meta = {},
  createdAt = null,
  targetCollection = "packages",
  targetId = packageDocId || packageId || trackingNumber || null,
  ...extra
}) {
  const timestamp = createdAt || admin.firestore.FieldValue.serverTimestamp();
  const safeDetails = cleanObject(details) || {};
  const safeMeta = cleanObject(meta) || {};

  return cleanObject({
    action,
    actionType: action,
    targetCollection,
    targetId,
    packageId,
    packageDocId,
    trackingNumber,
    trackingPackageId,
    shipmentId,
    shipmentDocId,
    tripId,
    actorId,
    actorUid: actorId,
    actorName,
    actorRole,
    details: safeDetails,
    meta: safeMeta,
    createdAt: timestamp,
    timestamp,
    ...cleanObject(extra),
  });
}

function writePackageActionLog({
  db,
  tx = null,
  batch = null,
  collection = "admin_logs",
  ...logInput
}) {
  const logRef = db.collection(collection).doc();
  const logData = buildPackageActionLog(logInput);

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

function getActorFromRequest(req, userData = {}) {
  const token = req.auth?.token || {};

  return {
    actorId: req.auth?.uid || null,
    actorName:
      userData.name ||
      userData.displayName ||
      token.name ||
      token.email ||
      null,
    actorRole: userData.role || token.role || "unknown",
  };
}

module.exports = {
  buildPackageActionLog,
  getActorFromRequest,
  writePackageActionLog,
};
