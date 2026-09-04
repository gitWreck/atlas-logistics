"use strict";

const admin = require("firebase-admin");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const {
  invoiceAccountingFingerprint,
  invoicePayload,
  FINANCE_WEBHOOK_SECRET,
  makeEnvelope,
  outboxDocumentId,
  outboxRecord,
  deliverOutboxDocument,
} = require("./financeEventOutbox");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function timestampMs(value) {
  if (value?.toMillis) return value.toMillis();
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Date.now();
}

const queueInvoiceFinanceEvent = onDocumentWritten({
  document: "invoices/{invoiceId}",
  region: "asia-southeast1",
  maxInstances: 10,
  secrets: [FINANCE_WEBHOOK_SECRET],
}, async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() || {} : null;
  const after = event.data?.after?.exists ? event.data.after.data() || {} : null;
  if (!after || after.sourceReadOnly === true || String(after.sourceSystem || "").toLowerCase() === "atlas-finance") return;
  const invoiceId = event.params.invoiceId;
  const beforeStatus = String(before?.status || "").toUpperCase();
  const afterStatus = String(after.status || "DRAFT").toUpperCase();
  // Drafts have no accounting effect and remain entirely inside Transport.
  if (afterStatus === "DRAFT" || (afterStatus === "CANCELLED" && (!before || beforeStatus === "DRAFT"))) return;
  const previousFingerprint = before ? invoiceAccountingFingerprint(before, invoiceId) : null;
  const currentFingerprint = invoiceAccountingFingerprint(after, invoiceId);
  if (previousFingerprint === currentFingerprint) return;
  const version = Math.max(1, Number(after.financeSourceVersion || 1));
  const cancelled = String(after.status || "").toUpperCase() === "CANCELLED";
  const eventType = !before || beforeStatus === "DRAFT"
    ? "SHIPMENT_INVOICE_CREATED"
    : cancelled
      ? "SHIPMENT_INVOICE_CANCELLED"
      : Number(before.amount || 0) !== Number(after.amount || 0)
        ? "SHIPMENT_INVOICE_CORRECTED"
        : "SHIPMENT_INVOICE_UPDATED";
  const envelope = makeEnvelope({
    eventType,
    entityId: invoiceId,
    sourceVersion: version,
    occurredAtMs: timestampMs(after.updatedAt || after.createdAt),
    correlationId: after.tripId || after.shipmentId || invoiceId,
    payload: invoicePayload(after, invoiceId),
  });
  const now = admin.firestore.Timestamp.now();
  const outboxRef = db.collection("financeEventOutbox").doc(outboxDocumentId(envelope));
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(outboxRef);
    if (!existing.exists) transaction.create(outboxRef, outboxRecord(envelope, now));
  });
  await deliverOutboxDocument(outboxRef, FINANCE_WEBHOOK_SECRET.value());
});

module.exports = { queueInvoiceFinanceEvent };
