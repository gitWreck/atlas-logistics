"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  centsToPesos,
  financeProjectionDocumentId,
  financeProjectionKey,
  mapFinanceInvoiceStatus,
} = require("../src/invoices/financeInvoiceProjection");

test("uses stable per-shipment identifiers for Finance invoice projections", () => {
  assert.equal(
    financeProjectionKey("finance-invoice-1", "shipment-1"),
    "finance-invoice-1:shipment-1",
  );
  assert.equal(
    financeProjectionDocumentId("finance-invoice-1", "shipment-1"),
    financeProjectionDocumentId("finance-invoice-1", "shipment-1"),
  );
  assert.notEqual(
    financeProjectionDocumentId("finance-invoice-1", "shipment-1"),
    financeProjectionDocumentId("finance-invoice-1", "shipment-2"),
  );
});

test("maps Finance lifecycle states and preserves exact centavos", () => {
  assert.equal(mapFinanceInvoiceStatus("DRAFT"), "DRAFT");
  assert.equal(mapFinanceInvoiceStatus("SENT"), "ISSUED");
  assert.equal(mapFinanceInvoiceStatus("PAID"), "PAID");
  assert.equal(mapFinanceInvoiceStatus("VOIDED"), "CANCELLED");
  assert.equal(centsToPesos(2_128), 21.28);
  assert.equal(centsToPesos(-1), null);
  assert.equal(centsToPesos(1.5), null);
});
