"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..", "..", "..");
const read = (...parts) =>
  fs.readFileSync(path.join(repositoryRoot, ...parts), "utf8");

test("invoice package sender is editable and persisted on create and edit", () => {
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
  const editInvoice = read(
    "apps",
    "functions",
    "src",
    "invoices",
    "editInvoice.js",
  );

  assert.match(
    form,
    /value=\{form\.senderName\}[\s\S]{0,180}updateField\("senderName", e\.target\.value\)/,
  );
  assert.doesNotMatch(
    form,
    /value=\{form\.senderName\}\s*readOnly/,
  );
  assert.match(
    createInvoice,
    /const finalSenderName =[\s\S]{0,120}String\(senderName \|\| ""\)/,
  );
  assert.match(
    editInvoice,
    /if \(senderName !== undefined\)[\s\S]{0,180}updateData\.senderName/,
  );
});
