"use strict";

const { onDocumentDeleted } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const {
  clearedInvoiceLinkFields,
  shouldClearDeletedInvoiceLink,
} = require("./invoiceLinkCleanup.cjs");
const {
  FINANCE_WEBHOOK_SECRET,
  makeEnvelope,
  outboxDocumentId,
  outboxRecord,
  deliverOutboxDocument,
} = require("./financeEventOutbox");
const { paymentPayload } = require("./paymentFinancePayload.cjs");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const DELETED_INVOICE_PAYMENT_REVERSAL_REASON =
  "Linked invoice was deleted in Atlas Transport.";

async function reverseLinkedPayments(invoiceId, deletedInvoice) {
  const paymentSnapshot = await db
    .collection("shipmentPayments")
    .where("invoiceId", "==", invoiceId)
    .get();
  const outboxRefs = [];

  for (const paymentDocument of paymentSnapshot.docs) {
    const result = await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(paymentDocument.ref);
      if (!currentSnapshot.exists) return null;

      const payment = currentSnapshot.data() || {};
      if (String(payment.status || "").toUpperCase() === "REVERSED") return null;

      const sourceVersion = Math.max(1, Number(payment.sourceVersion || 1)) + 1;
      const reversal = {
        ...payment,
        id: paymentDocument.id,
        sourceVersion,
        status: "REVERSED",
        reversalReason: DELETED_INVOICE_PAYMENT_REVERSAL_REASON,
      };
      const envelope = makeEnvelope({
        eventType: "SHIPMENT_PAYMENT_REVERSED",
        entityId: paymentDocument.id,
        sourceVersion,
        occurredAtMs: Date.now(),
        correlationId:
          deletedInvoice.tripId ||
          deletedInvoice.shipmentId ||
          payment.shipmentId ||
          invoiceId,
        causationId: payment.financeEventId || null,
        payload: paymentPayload(reversal),
      });
      const outboxRef = db
        .collection("financeEventOutbox")
        .doc(outboxDocumentId(envelope));
      const outboxSnapshot = await transaction.get(outboxRef);
      const now = admin.firestore.Timestamp.now();

      transaction.update(paymentDocument.ref, {
        status: "REVERSED",
        sourceVersion,
        reversalReason: DELETED_INVOICE_PAYMENT_REVERSAL_REASON,
        reversedBy: "system:invoice-delete-cleanup",
        reversedByName: "Atlas Transport",
        reversedAt: now,
        orphanedByInvoiceDeletion: true,
        updatedAt: now,
      });
      if (!outboxSnapshot.exists) {
        transaction.create(outboxRef, outboxRecord(envelope, now));
      }
      transaction.create(db.collection("invoice_events").doc(), {
        invoiceId,
        invoiceNumber: deletedInvoice.invoiceNumber || invoiceId,
        shipmentId: deletedInvoice.shipmentId || null,
        type: "PAYMENT_REVERSED",
        paymentId: paymentDocument.id,
        paymentNumber: payment.paymentNumber || paymentDocument.id,
        amountCentavos: payment.amountCentavos,
        reason: DELETED_INVOICE_PAYMENT_REVERSAL_REASON,
        actorId: "system:invoice-delete-cleanup",
        at: now,
        note: `Payment ${payment.paymentNumber || paymentDocument.id} reversed because its invoice was deleted`,
      });
      return outboxRef;
    });

    if (result) outboxRefs.push(result);
  }

  for (const outboxRef of outboxRefs) {
    await deliverOutboxDocument(outboxRef, FINANCE_WEBHOOK_SECRET.value());
  }
}

exports.cleanupDeletedInvoice = onDocumentDeleted(
  {
    document: "invoices/{invoiceId}",
    region: "asia-southeast1",
    maxInstances: 10,
    secrets: [FINANCE_WEBHOOK_SECRET],
  },
  async (event) => {
    const deletedInvoice = event.data?.data() || {};
    const invoiceId = String(event.params?.invoiceId || "").trim();
    const shipmentId = String(deletedInvoice.shipmentId || "").trim();

    if (!invoiceId) return;

    await reverseLinkedPayments(invoiceId, deletedInvoice);

    if (!shipmentId) return;

    const shipmentRef = db.collection("shipments").doc(shipmentId);

    await db.runTransaction(async (transaction) => {
      const shipmentSnap = await transaction.get(shipmentRef);
      if (!shipmentSnap.exists) return;

      const shipment = shipmentSnap.data() || {};
      if (!shouldClearDeletedInvoiceLink(shipment, invoiceId)) return;

      transaction.update(shipmentRef, {
        ...clearedInvoiceLinkFields(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: "system:invoice-delete-cleanup",
      });
    });
  },
);
