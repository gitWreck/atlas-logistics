"use strict";

const admin = require("firebase-admin");
const { cleanObject } = require("./helpers");

function buildInvoiceActionLog({
  action,
  invoiceId = null,
  invoiceDocId = invoiceId || null,
  invoiceNumber = null,
  shipmentId = null,
  tripId = null,
  actorId = null,
  actorName = null,
  actorRole = null,
  details = {},
  meta = {},
  createdAt = null,
  targetCollection = "invoices",
  targetId = invoiceDocId || invoiceId || invoiceNumber || null,
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
    invoiceId,
    invoiceDocId,
    invoiceNumber,
    shipmentId,
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

function writeInvoiceActionLog({
  db,
  tx = null,
  batch = null,
  collection = "admin_logs",
  ...logInput
}) {
  const logRef = db.collection(collection).doc();
  const logData = buildInvoiceActionLog(logInput);

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
  buildInvoiceActionLog,
  getActorFromRequest,
  writeInvoiceActionLog,
};
