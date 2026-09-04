"use strict";

const crypto = require("node:crypto");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");

const FINANCE_WEBHOOK_URL = "https://asia-southeast1-atlas-finance-3b5f2.cloudfunctions.net/transportFinanceWebhook";
const FINANCE_WEBHOOK_SECRET = defineSecret("ATLAS_TRANSPORT_WEBHOOK_SECRET");
const CONTRACT_VERSION = 1;

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function canonicalPayload(value) {
  if (Array.isArray(value)) return value.map(canonicalPayload);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalPayload(value[key])]));
  }
  return value;
}

function eventId(entityType, entityId, sourceVersion, action) {
  return `atlas-transport:${clean(entityType, 60).toLowerCase()}:${clean(entityId, 250)}:v${sourceVersion}:${clean(action, 60).toLowerCase()}`;
}

function makeEnvelope({ eventType, entityId, sourceVersion, occurredAtMs, correlationId, causationId = null, payload }) {
  return {
    contractVersion: CONTRACT_VERSION,
    eventId: eventId(eventType, entityId, sourceVersion, eventType),
    eventType,
    entityId: clean(entityId, 250),
    sourceVersion,
    occurredAtMs,
    correlationId: clean(correlationId || entityId, 250),
    causationId: clean(causationId, 250) || null,
    payload: canonicalPayload(payload),
  };
}

function outboxDocumentId(envelope) {
  return `finance_${hash(envelope.eventId).slice(0, 40)}`;
}

function outboxRecord(envelope, now) {
  return {
    destination: "ATLAS_FINANCE",
    contractVersion: envelope.contractVersion,
    eventId: envelope.eventId,
    eventType: envelope.eventType,
    entityId: envelope.entityId,
    sourceVersion: envelope.sourceVersion,
    payloadHash: hash(JSON.stringify(canonicalPayload(envelope.payload))),
    envelope,
    status: "PENDING",
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function retryDelayMs(attempts) {
  return Math.min(60 * 60 * 1000, 30_000 * (2 ** Math.max(0, attempts - 1)));
}

function invoicePayload(invoice, invoiceId) {
  const dateValue = (value) => {
    if (value?.toMillis) return value.toMillis();
    if (typeof value === "number") return value;
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : null;
  };
  const status = String(invoice.status || "DRAFT").toUpperCase();
  return {
    invoiceId,
    invoiceNumber: invoice.invoiceNumber || invoiceId,
    shipmentId: invoice.shipmentId || null,
    tripId: invoice.tripId || invoice.truckTripId || null,
    customerId: invoice.customerId || invoice.shipmentSnapshot?.sender?.uid || null,
    customerName: invoice.billingName || invoice.senderName || null,
    billingName: invoice.billingName || null,
    billingAddress: invoice.billingAddress || null,
    invoiceDate: dateValue(invoice.invoiceDate || invoice.createdAt),
    dueDate: dateValue(invoice.dueDate),
    amountCentavos: Math.round(Number(invoice.amount || 0) * 100),
    // Collection state is delivered by SHIPMENT_PAYMENT events. Keeping PAID
    // out of the invoice event prevents a status flag from becoming a second
    // accounting effect.
    status: status === "PAID" ? "ISSUED" : status,
    notes: invoice.notes || null,
  };
}

function invoiceAccountingFingerprint(invoice, invoiceId) {
  return hash(JSON.stringify(canonicalPayload(invoicePayload(invoice, invoiceId))));
}

async function deliverOutboxDocument(reference, secret, fetchImpl = fetch) {
  const snapshot = await reference.get();
  if (!snapshot.exists) return { status: "MISSING" };
  const row = snapshot.data() || {};
  if (["DELIVERED", "PERMANENT_FAILURE"].includes(row.status)) return { status: row.status };
  const body = JSON.stringify(row.envelope);
  const timestamp = String(Date.now());
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  let response;
  let responseBody = null;
  try {
    response = await fetchImpl(FINANCE_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-atlas-timestamp": timestamp, "x-atlas-signature": signature },
      body,
    });
    responseBody = await response.json().catch(() => null);
  } catch (error) {
    response = { ok: false, status: 503 };
    responseBody = { message: error?.message || "Network delivery failed." };
  }
  const attempts = Number(row.attempts || 0) + 1;
  const delivered = response.ok;
  const permanent = response.status >= 400 && response.status < 500 && response.status !== 429;
  const now = admin.firestore.Timestamp.now();
  await reference.set({
    status: delivered ? "DELIVERED" : permanent ? "PERMANENT_FAILURE" : "FAILED",
    attempts,
    lastHttpStatus: response.status,
    lastResponse: responseBody,
    lastAttemptAt: now,
    deliveredAt: delivered ? now : null,
    nextAttemptAt: delivered || permanent ? null : admin.firestore.Timestamp.fromMillis(Date.now() + retryDelayMs(attempts)),
    updatedAt: now,
  }, { merge: true });
  return { status: delivered ? "DELIVERED" : permanent ? "PERMANENT_FAILURE" : "FAILED", httpStatus: response.status, response: responseBody };
}

module.exports = {
  CONTRACT_VERSION,
  FINANCE_WEBHOOK_SECRET,
  FINANCE_WEBHOOK_URL,
  canonicalPayload,
  eventId,
  makeEnvelope,
  outboxDocumentId,
  outboxRecord,
  retryDelayMs,
  invoicePayload,
  invoiceAccountingFingerprint,
  deliverOutboxDocument,
};
