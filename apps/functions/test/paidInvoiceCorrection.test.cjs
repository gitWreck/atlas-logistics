"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateInvoiceEdit,
} = require("../src/invoices/invoiceEditPolicy.cjs");

test("allows an admin to correct a paid invoice with a reason", () => {
  assert.deepEqual(
    evaluateInvoiceEdit({
      currentStatus: "PAID",
      actorRole: "admin",
      requestedStatus: "PAID",
      correctionReason: "Correct spreadsheet amount",
    }),
    {
      allowed: true,
      isPaidCorrection: true,
      reason: "Correct spreadsheet amount",
    },
  );
});

test("allows a superadmin to correct a paid invoice", () => {
  assert.equal(
    evaluateInvoiceEdit({
      currentStatus: "PAID",
      actorRole: "SUPERADMIN",
      requestedStatus: "PAID",
      correctionReason: "Approved correction",
    }).allowed,
    true,
  );
});

test("rejects paid invoice corrections from non-admin roles", () => {
  const result = evaluateInvoiceEdit({
    currentStatus: "PAID",
    actorRole: "manager",
    requestedStatus: "PAID",
    correctionReason: "Attempted correction",
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, "permission-denied");
});

test("requires a correction reason and keeps paid status finalized", () => {
  assert.equal(
    evaluateInvoiceEdit({
      currentStatus: "PAID",
      actorRole: "admin",
      requestedStatus: "PAID",
      correctionReason: "",
    }).code,
    "invalid-argument",
  );
  assert.equal(
    evaluateInvoiceEdit({
      currentStatus: "PAID",
      actorRole: "admin",
      requestedStatus: "ISSUED",
      correctionReason: "Change status too",
    }).code,
    "failed-precondition",
  );
});

test("cancelled invoices remain immutable", () => {
  assert.equal(
    evaluateInvoiceEdit({ currentStatus: "CANCELLED", actorRole: "admin" })
      .allowed,
    false,
  );
});
