"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  paymentPayload,
} = require("../src/invoices/paymentFinancePayload.cjs");

test("builds a reversed Finance payment event for a deleted invoice", () => {
  assert.deepEqual(
    paymentPayload({
      id: "payment-1",
      paymentNumber: "PAY-1",
      invoiceId: "invoice-1",
      customerId: "customer-1",
      customerName: "Example Customer",
      receivedAtMs: 1_788_000_000_000,
      amountCentavos: 1_000,
      method: "CASH",
      referenceNumber: null,
      destinationCode: null,
      status: "REVERSED",
      sourceVersion: 2,
      reversalReason: "Linked invoice was deleted in Atlas Transport.",
      proofDocuments: [],
    }),
    {
      paymentId: "payment-1",
      paymentNumber: "PAY-1",
      invoiceId: "invoice-1",
      customerId: "customer-1",
      customerName: "Example Customer",
      receivedAt: 1_788_000_000_000,
      amountCentavos: 1_000,
      method: "CASH",
      referenceNumber: null,
      destinationCode: null,
      status: "REVERSED",
      sourceVersion: 2,
      reversed: true,
      reversalReason: "Linked invoice was deleted in Atlas Transport.",
      proofDocuments: [],
      allocations: [{ invoiceId: "invoice-1", amountCentavos: 1_000 }],
    },
  );
});
