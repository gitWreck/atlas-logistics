"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  canonicalPayload,
  eventId,
  invoiceAccountingFingerprint,
  makeEnvelope,
  outboxDocumentId,
  retryDelayMs,
} = require("../src/invoices/financeEventOutbox");
const { _test } = require("../src/invoices/shipmentPayments");

test("Transport payment events use stable IDs, versions and complete allocations", () => {
  const payment = {
    id: "payment-1", paymentNumber: "PAY-1", invoiceId: "invoice-1",
    customerId: "customer-1", receivedAtMs: 1_788_408_000_000,
    amountCentavos: 12_345, method: "BANK_TRANSFER", referenceNumber: "REF-1",
    destinationCode: "BDO-001", status: "APPROVED", sourceVersion: 1,
    proofDocuments: [{
      proofId: "proof-1", fileName: "receipt.pdf", contentType: "application/pdf",
      sizeBytes: 1234, sha256: "a".repeat(64),
      storagePath: "payment-proofs/invoice-1/proof-1/receipt.pdf",
      uploadedAtMs: 1_788_407_000_000, uploadedBy: "user-1",
    }],
  };
  const payload = _test.paymentPayload(payment);
  assert.deepEqual(payload.allocations, [{ invoiceId: "invoice-1", amountCentavos: 12_345 }]);
  assert.equal(payload.proofDocuments[0].proofId, "proof-1");
  assert.equal(payload.proofDocuments[0].sha256, "a".repeat(64));
  const envelope = makeEnvelope({ eventType: "SHIPMENT_PAYMENT_CREATED", entityId: payment.id, sourceVersion: 1, occurredAtMs: payment.receivedAtMs, correlationId: payment.invoiceId, payload });
  assert.equal(envelope.contractVersion, 1);
  assert.equal(envelope.eventId, eventId("SHIPMENT_PAYMENT_CREATED", "payment-1", 1, "SHIPMENT_PAYMENT_CREATED"));
  assert.equal(outboxDocumentId(envelope), outboxDocumentId(envelope));
});

test("canonical payload hashing is order independent and invoice accounting changes are detectable", () => {
  assert.deepEqual(canonicalPayload({ z: 1, a: { y: 2, b: 3 } }), { a: { b: 3, y: 2 }, z: 1 });
  const base = { invoiceNumber: "INV-1", shipmentId: "S-1", invoiceDate: "2026-09-04", amount: 100, status: "ISSUED" };
  assert.equal(invoiceAccountingFingerprint(base, "invoice-1"), invoiceAccountingFingerprint({ ...base }, "invoice-1"));
  assert.notEqual(invoiceAccountingFingerprint(base, "invoice-1"), invoiceAccountingFingerprint({ ...base, amount: 101 }, "invoice-1"));
});

test("retry delivery is bounded and payment collections are server controlled", () => {
  assert.equal(retryDelayMs(1), 30_000);
  assert.equal(retryDelayMs(20), 3_600_000);
  const rules = fs.readFileSync(path.resolve(__dirname, "../../../firestore.rules"), "utf8");
  for (const collection of ["shipmentPayments", "paymentProofs", "financeEventOutbox", "paymentRequestReservations", "paymentReferenceReservations", "shipmentInvoiceReservations"]) {
    assert.match(rules, new RegExp(`match \\/${collection}\\/\\{[^}]+\\}[\\s\\S]*?allow (?:read, )?write: if false`));
  }
  const statusSource = fs.readFileSync(path.resolve(__dirname, "../src/invoices/updateInvoiceStatus.js"), "utf8");
  assert.match(statusSource, /Record a customer payment to mark an invoice as paid/);
  const createInvoiceSource = fs.readFileSync(path.resolve(__dirname, "../src/invoices/createInvoice.js"), "utf8");
  assert.match(createInvoiceSource, /shipmentInvoiceReservations[\s\S]*runTransaction/);
  assert.match(createInvoiceSource, /reservedInvoice\?\.exists && reservedInvoiceStatus !== "CANCELLED"/);
  assert.match(createInvoiceSource, /transaction\.set\(reservationRef/);
  assert.match(createInvoiceSource, /if \(error instanceof HttpsError\) throw error/);
  assert.doesNotMatch(fs.readFileSync(path.resolve(__dirname, "../index.js"), "utf8"), /exports\.upsertFinanceInvoice/);
  assert.match(fs.readFileSync(path.resolve(__dirname, "../index.js"), "utf8"), /exports\.replayShipmentPayment/);
  const paymentSource = fs.readFileSync(path.resolve(__dirname, "../src/invoices/shipmentPayments.js"), "utf8");
  assert.match(paymentSource, /replayShipmentPayment/);
  assert.match(paymentSource, /payment_replay/);
  assert.match(paymentSource, /sourceVersion = Number\(payment\.sourceVersion \|\| 0\) \+ 1/);
});
