"use strict";

const admin = require("firebase-admin");
const { cleanObject } = require("./helpers");

/**
 * Standard custody audit entry:
 * user, timestamp, previousValue, newValue, reason
 */
function writeCustodyAuditLog({
  db,
  tx = null,
  batch = null,
  collection = "audit_logs",
  action,
  targetCollection = null,
  targetId = null,
  tripId = null,
  tripDocId = null,
  actorId = null,
  actorName = null,
  actorRole = null,
  reason = null,
  previousValue = null,
  newValue = null,
  note = null,
  meta = {},
  createdAt = null,
  fieldValue = null,
}) {
  const fv = fieldValue || admin.firestore.FieldValue;
  const timestamp = createdAt || fv.serverTimestamp();
  const logRef = db.collection(collection).doc();

  const logData = cleanObject({
    action,
    actionType: action,
    targetCollection,
    targetId,
    tripId: tripId || tripDocId || targetId || null,
    tripDocId: tripDocId || targetId || null,
    user: actorName || actorId || "SYSTEM",
    actorId,
    actorUid: actorId,
    actorName,
    actorRole,
    reason: reason || null,
    previousValue: previousValue ?? null,
    newValue: newValue ?? null,
    note: note || null,
    meta: cleanObject(meta) || {},
    createdAt: timestamp,
    timestamp,
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
  writeCustodyAuditLog,
};
