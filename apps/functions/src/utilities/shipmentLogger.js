"use strict";

const admin = require("firebase-admin");

function cleanObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  );
}

function buildShipmentActionLog({
  action,
  shipmentId = null,
  shipmentDocId = null,
  trackingShipmentId = shipmentDocId || shipmentId || null,
  tripId = null,
  actorId = null,
  actorName = null,
  actorRole = null,
  details = {},
  meta = {},
  createdAt = null,
  targetCollection = "shipments",
  targetId = shipmentDocId || shipmentId || trackingShipmentId || null,
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
    shipmentId,
    shipmentDocId,
    trackingShipmentId,
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

function writeShipmentActionLog({
  db,
  tx = null,
  batch = null,
  collection = "admin_logs",
  ...logInput
}) {
  const logRef = db.collection(collection).doc();
  const logData = buildShipmentActionLog(logInput);

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
  buildShipmentActionLog,
  getActorFromRequest,
  writeShipmentActionLog,
};
