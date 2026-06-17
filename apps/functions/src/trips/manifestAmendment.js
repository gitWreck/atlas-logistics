"use strict";

const admin = require("firebase-admin");
const { stableStringify, sha256Hex } = require("../utilities/helpers");
const { writeCustodyAuditLog } = require("../utilities/custodyAuditLog");

const ORIGINAL_MANIFEST_VERSION = "v1.0-LOCKED";

function formatAmendmentVersion(sequence) {
  const num = Number(sequence);
  if (!Number.isFinite(num) || num < 1) return "v1.1-AMENDMENT";
  return `v1.${num}-AMENDMENT`;
}

function normalizeAmendmentEntry(entry = {}) {
  return {
    changeType: String(entry.changeType || "ADDED").toUpperCase(),
    shipmentId: entry.shipmentId || null,
    shipmentDocId: entry.shipmentDocId || null,
    packageId: entry.packageId || null,
    reason: entry.reason || null,
    recordedAt: entry.recordedAt || new Date().toISOString(),
    recordedBy: entry.recordedBy || null,
    recordedByName: entry.recordedByName || null,
  };
}

function buildAmendmentPayload({
  amendmentId,
  version,
  versionSequence,
  trip,
  tripDocId,
  reason,
  entries,
  actorId,
  actorName,
}) {
  return {
    amendmentId,
    version,
    versionSequence,
    status: "SEALED",
    originalTripId: trip.tripId || tripDocId,
    tripDocId,
    originalManifestId: trip.manifestId || null,
    originalManifestHash: trip.manifestHash || null,
    baseVersion: trip.manifestVersion || ORIGINAL_MANIFEST_VERSION,
    reason: reason || "Manifest correction",
    entries: (Array.isArray(entries) ? entries : []).map(normalizeAmendmentEntry),
    meta: {
      sealedAtMs: Date.now(),
      sealedBy: actorId || null,
      sealedByName: actorName || null,
    },
  };
}

function tripRequiresAmendmentTracking(trip = {}) {
  return Boolean(trip.manifestId || trip.manifestHash);
}

function appendPendingAmendmentEntry(tx, tripRef, trip, entry = {}) {
  if (!tripRequiresAmendmentTracking(trip)) return;

  const normalized = normalizeAmendmentEntry({
    ...entry,
    recordedAt: entry.recordedAt || new Date().toISOString(),
  });

  const existing = Array.isArray(trip.pendingAmendmentEntries)
    ? trip.pendingAmendmentEntries.map(normalizeAmendmentEntry)
    : [];

  existing.push(normalized);

  tx.update(tripRef, {
    pendingAmendmentEntries: existing,
    amendmentSessionActive: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  trip.pendingAmendmentEntries = existing;
  trip.amendmentSessionActive = true;
}

function resetPendingAmendmentSession(tx, tripRef) {
  tx.update(tripRef, {
    pendingAmendmentEntries: [],
    amendmentSessionActive: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function sealManifestAmendment({
  tx,
  db,
  tripRef,
  trip,
  tripDocId,
  actorId,
  actorName,
  actorRole,
  reason,
  entries,
}) {
  const pendingEntries = Array.isArray(entries)
    ? entries
    : Array.isArray(trip.pendingAmendmentEntries)
      ? trip.pendingAmendmentEntries
      : [];

  if (!pendingEntries.length) return null;
  if (!tripRequiresAmendmentTracking(trip)) return null;

  const versionSequence = Number(trip.manifestAmendmentCount || 0) + 1;
  const version = formatAmendmentVersion(versionSequence);
  const amendmentId = `AMENDMENT-${tripDocId}-${Date.now()}`;
  const payload = buildAmendmentPayload({
    amendmentId,
    version,
    versionSequence,
    trip,
    tripDocId,
    reason,
    entries: pendingEntries,
    actorId,
    actorName,
  });
  const hash = sha256Hex(stableStringify(payload));
  const now = admin.firestore.FieldValue.serverTimestamp();

  const amendmentRef = db.collection("manifest_amendments").doc(amendmentId);
  tx.set(amendmentRef, {
    ...payload,
    hash,
    verifyUrl: `https://atlastransport.ph/verify/amendment/${amendmentId}`,
    createdAt: now,
  });

  tx.set(tripRef.collection("manifest_amendments").doc(amendmentId), {
    amendmentId,
    version,
    hash,
    entryCount: payload.entries.length,
    reason: payload.reason,
    createdAt: now,
    createdBy: actorId || null,
    createdByName: actorName || null,
  });

  tx.set(tripRef.collection("manifest_events").doc(), {
    type: "MANIFEST_AMENDMENT_SEALED",
    amendmentId,
    version,
    hash,
    entryCount: payload.entries.length,
    reason: payload.reason,
    createdAt: now,
    createdBy: actorId || null,
    createdByName: actorName || null,
  });

  tx.update(tripRef, {
    manifestAmendmentCount: versionSequence,
    latestAmendmentId: amendmentId,
    latestAmendmentVersion: version,
    latestAmendmentHash: hash,
    pendingAmendmentEntries: admin.firestore.FieldValue.delete(),
    amendmentSessionActive: false,
    updatedAt: now,
  });

  writeCustodyAuditLog({
    db,
    tx,
    action: "MANIFEST_AMENDMENT_SEALED",
    tripId: trip.tripId || tripDocId,
    tripDocId,
    targetId: amendmentId,
    targetCollection: "manifest_amendments",
    actorId,
    actorName,
    actorRole,
    reason: payload.reason,
    previousValue: {
      manifestAmendmentCount: Number(trip.manifestAmendmentCount || 0),
      baseVersion: trip.manifestVersion || ORIGINAL_MANIFEST_VERSION,
    },
    newValue: {
      amendmentId,
      version,
      hash,
      entryCount: payload.entries.length,
      entries: payload.entries,
    },
    note: `Manifest amendment ${version} sealed for trip ${trip.tripId || tripDocId}.`,
  });

  return { amendmentId, version, hash, entryCount: payload.entries.length };
}

module.exports = {
  ORIGINAL_MANIFEST_VERSION,
  formatAmendmentVersion,
  normalizeAmendmentEntry,
  buildAmendmentPayload,
  tripRequiresAmendmentTracking,
  appendPendingAmendmentEntry,
  resetPendingAmendmentSession,
  sealManifestAmendment,
};
