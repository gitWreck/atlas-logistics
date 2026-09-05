"use strict";

const MAX_PAYMENT_PROOF_BYTES = 15 * 1024 * 1024;
const MAX_PAYMENT_PROOFS = 5;
const ALLOWED_PAYMENT_PROOF_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const PROOF_REQUIRED_METHODS = new Set(["BANK_TRANSFER", "GCASH", "CHECK"]);

function normalizeContentType(value) {
  const contentType = String(value || "").trim().toLowerCase();
  return contentType === "image/jpg" ? "image/jpeg" : contentType;
}

function safeFileName(value, contentType) {
  const fallback = contentType === "application/pdf"
    ? "payment-proof.pdf"
    : contentType === "image/png"
      ? "payment-proof.png"
      : "payment-proof.jpg";
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._ -]+/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 160);
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : fallback;
}

function hasExpectedSignature(buffer, contentType) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (contentType === "application/pdf") {
    return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (contentType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  return false;
}

function validateProofFile({ contentType, buffer }) {
  const normalizedType = normalizeContentType(contentType);
  if (!ALLOWED_PAYMENT_PROOF_TYPES.has(normalizedType)) {
    return { valid: false, code: "unsupported-type", message: "Only PDF, JPG, and PNG payment proofs are allowed." };
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { valid: false, code: "empty-file", message: "The payment proof file is empty." };
  }
  if (buffer.length > MAX_PAYMENT_PROOF_BYTES) {
    return { valid: false, code: "file-too-large", message: "Each payment proof must be 15 MB or smaller." };
  }
  if (!hasExpectedSignature(buffer, normalizedType)) {
    return { valid: false, code: "content-mismatch", message: "The payment proof content does not match its file type." };
  }
  return { valid: true, contentType: normalizedType, sizeBytes: buffer.length };
}

function paymentMethodRequiresProof(method) {
  return PROOF_REQUIRED_METHODS.has(String(method || "").trim().toUpperCase());
}

module.exports = {
  MAX_PAYMENT_PROOF_BYTES,
  MAX_PAYMENT_PROOFS,
  ALLOWED_PAYMENT_PROOF_TYPES,
  normalizeContentType,
  safeFileName,
  hasExpectedSignature,
  validateProofFile,
  paymentMethodRequiresProof,
};
