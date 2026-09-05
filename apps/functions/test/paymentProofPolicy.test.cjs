"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_PAYMENT_PROOF_BYTES,
  safeFileName,
  validateProofFile,
  paymentMethodRequiresProof,
} = require("../src/invoices/paymentProofPolicy.cjs");

test("accepts genuine PDF, JPEG, and PNG payment proofs", () => {
  assert.equal(validateProofFile({ contentType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nproof") }).valid, true);
  assert.equal(validateProofFile({ contentType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]) }).valid, true);
  assert.equal(validateProofFile({ contentType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }).valid, true);
});

test("rejects disguised, unsupported, empty, and oversized payment proofs", () => {
  assert.equal(validateProofFile({ contentType: "application/pdf", buffer: Buffer.from("not a pdf") }).code, "content-mismatch");
  assert.equal(validateProofFile({ contentType: "text/plain", buffer: Buffer.from("proof") }).code, "unsupported-type");
  assert.equal(validateProofFile({ contentType: "image/png", buffer: Buffer.alloc(0) }).code, "empty-file");
  assert.equal(validateProofFile({ contentType: "image/jpeg", buffer: Buffer.alloc(MAX_PAYMENT_PROOF_BYTES + 1) }).code, "file-too-large");
});

test("requires proof for traceable non-cash methods but keeps cash optional", () => {
  assert.equal(paymentMethodRequiresProof("BANK_TRANSFER"), true);
  assert.equal(paymentMethodRequiresProof("gcash"), true);
  assert.equal(paymentMethodRequiresProof("CHECK"), true);
  assert.equal(paymentMethodRequiresProof("CASH"), false);
});

test("sanitizes uploaded filenames before building a storage path", () => {
  assert.equal(safeFileName("../../receipt<script>.pdf", "application/pdf"), ".._.._receipt_script_.pdf");
  assert.equal(safeFileName("", "image/png"), "payment-proof.png");
});
