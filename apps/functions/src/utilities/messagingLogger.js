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

function buildMessagingActionLog({
  action = null,
  type = action || null,
  message = null,
  phone = null,
  shipmentId = null,
  trackingId = null,
  tripId = null,
  tripDocId = tripId || null,
  invoiceId = null,
  actorId = null,
  requestedBy = actorId || null,
  actorRole = null,
  requestedRole = actorRole || null,
  details = {},
  meta = {},
  createdAt = null,
  at = null,
  provider = null,
  targetCollection = "sms_logs",
  targetId = shipmentId || trackingId || tripId || invoiceId || phone || null,
  ...extra
}) {
  const timestamp =
    createdAt || at || admin.firestore.FieldValue.serverTimestamp();
  const logType = type || action || "MESSAGE";
  const logAction = action || logType;
  const safeDetails = cleanObject(details) || {};
  const safeMeta = cleanObject(meta) || {};

  return cleanObject({
    action: logAction,
    actionType: logAction,
    type: logType,
    targetCollection,
    targetId,
    message,
    phone,
    shipmentId,
    trackingId,
    tripId,
    tripDocId,
    invoiceId,
    actorId,
    actorUid: actorId,
    actorRole,
    requestedBy,
    requestedRole,
    provider,
    details: safeDetails,
    meta: safeMeta,
    createdAt: timestamp,
    at: timestamp,
    timestamp,
    ...cleanObject(extra),
  });
}

function writeMessagingActionLog({
  db,
  tx = null,
  batch = null,
  collection = "sms_logs",
  ...logInput
}) {
  const logRef = db.collection(collection).doc();
  const logData = buildMessagingActionLog(logInput);

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
  buildMessagingActionLog,
  writeMessagingActionLog,
};
