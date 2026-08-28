import test from "node:test";
import assert from "node:assert/strict";

import { summarizeTripInvoices } from "./tripInvoiceSummary.mjs";

test("totals active trip invoices and excludes cancelled invoices", () => {
  assert.deepEqual(
    summarizeTripInvoices([
      {
        invoiceId: "INV-1",
        hasInvoice: true,
        invoiceStatus: "ISSUED",
        invoiceAmount: 1250.5,
      },
      {
        invoiceId: "INV-2",
        hasInvoice: true,
        invoiceStatus: "PAID",
        invoiceAmount: "750",
      },
      {
        invoiceId: "INV-3",
        hasInvoice: false,
        invoiceStatus: "CANCELLED",
        invoiceAmount: 999,
      },
    ]),
    { count: 2, totalAmount: 2000.5 },
  );
});

test("does not count the same invoice twice", () => {
  assert.deepEqual(
    summarizeTripInvoices([
      { invoiceId: "INV-1", hasInvoice: true, invoiceAmount: 500 },
      { invoiceId: "INV-1", hasInvoice: true, invoiceAmount: 500 },
    ]),
    { count: 1, totalAmount: 500 },
  );
});

test("ignores invalid invoice amounts without producing NaN", () => {
  assert.deepEqual(
    summarizeTripInvoices([
      { invoiceId: "INV-1", hasInvoice: true, invoiceAmount: "invalid" },
    ]),
    { count: 1, totalAmount: 0 },
  );
});

test("counts a legacy active invoice even when it has no invoice ID", () => {
  assert.deepEqual(
    summarizeTripInvoices([{ hasInvoice: true, invoiceAmount: 100 }]),
    { count: 1, totalAmount: 100 },
  );
});
