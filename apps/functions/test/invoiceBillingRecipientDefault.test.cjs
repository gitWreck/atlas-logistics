"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..", "..", "..");
const read = (...parts) =>
  fs.readFileSync(path.join(repositoryRoot, ...parts), "utf8");

test("invoice billing name defaults to the recipient across create and edit flows", () => {
  const helpers = read(
    "apps",
    "web",
    "app",
    "(internal)",
    "components",
    "invoice",
    "invoiceHelpers.js",
  );
  const form = read(
    "apps",
    "web",
    "app",
    "(internal)",
    "components",
    "invoice",
    "InvoiceFormModal.jsx",
  );
  const createInvoice = read(
    "apps",
    "functions",
    "src",
    "invoices",
    "createInvoice.js",
  );
  const upsertFinanceInvoice = read(
    "apps",
    "functions",
    "src",
    "invoices",
    "upsertFinanceInvoice.js",
  );

  assert.match(helpers, /billingName: invoice\.billingName \|\| recipientName/);
  assert.match(helpers, /billingName: recipientName/);
  assert.match(form, /billingName: recipientName/);
  assert.match(
    form,
    /const billingName = form\.billingName\.trim\(\) \|\| recipientName/,
  );
  assert.match(
    createInvoice,
    /requestedBillingName \|\| shipmentRecipientName \|\| "Unknown Recipient"/,
  );
  assert.match(
    upsertFinanceInvoice,
    /data\.billingName \|\| recipient\?\.name/,
  );
});
