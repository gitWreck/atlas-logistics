"use strict";

const admin = require("firebase-admin");

async function writeAuditEvent(db, {
  actorUid,
  actorRole,
  action,
  entityType,
  entityId,
  meta = {},
}) {
  await db.collection("audit_events").add({
    actorUid: actorUid || null,
    actorRole: actorRole || null,
    action,
    entityType,
    entityId: entityId || null,
    meta,
    at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

module.exports = Object.freeze({ writeAuditEvent });
