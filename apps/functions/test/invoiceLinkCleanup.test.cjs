"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  clearedInvoiceLinkFields,
  shouldClearDeletedInvoiceLink,
} = require("../src/invoices/invoiceLinkCleanup.cjs");

test("clears a shipment that still points to the deleted invoice", () => {
  assert.equal(
    shouldClearDeletedInvoiceLink(
      {
        invoiceId: "INV-1",
        invoiceNumber: "INV-1",
        hasInvoice: true,
      },
      "INV-1",
    ),
    true,
  );
  assert.deepEqual(clearedInvoiceLinkFields(), {
    invoiceId: null,
    invoiceNumber: null,
    invoiceStatus: null,
    hasInvoice: false,
  });
});

test("does not clear a newer invoice link", () => {
  assert.equal(
    shouldClearDeletedInvoiceLink(
      {
        invoiceId: "INV-NEW",
        invoiceNumber: "INV-NEW",
        hasInvoice: true,
      },
      "INV-OLD",
    ),
    false,
  );
});

test("supports legacy links that only contain the invoice number", () => {
  assert.equal(
    shouldClearDeletedInvoiceLink(
      { invoiceNumber: "INV-LEGACY", hasInvoice: true },
      "INV-LEGACY",
    ),
    true,
  );
});
