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

function buildTripActionLog({
  action,
  tripId = null,
  tripDocId = null,
  actorId = null,
  actorName = null,
  actorRole = null,
  details = {},
  meta = {},
  createdAt = null,
  targetCollection = "truck_trips",
  targetId = tripDocId || tripId || null,
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
    tripId,
    tripDocId,
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

function writeTripActionLog({
  db,
  tx = null,
  batch = null,
  collection = "admin_logs",
  ...logInput
}) {
  const logRef = db.collection(collection).doc();
  const logData = buildTripActionLog(logInput);

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
  buildTripActionLog,
  getActorFromRequest,
  writeTripActionLog,
};
