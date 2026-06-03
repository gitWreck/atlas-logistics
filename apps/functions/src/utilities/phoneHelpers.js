"use strict";

function normalizePhone(value = "") {
  const digits = String(value || "").replace(/[^\d]/g, "");

  if (digits.length === 11 && digits.startsWith("0")) {
    return `63${digits.slice(1)}`;
  }

  if (digits.length === 10 && digits.startsWith("9")) {
    return `63${digits}`;
  }

  return digits.length === 12 && digits.startsWith("63") ? digits : "";
}

function requireNormalizedPhone(value = "") {
  const normalized = normalizePhone(value);
  return normalized.startsWith("63") && normalized.length === 12
    ? normalized
    : null;
}

function phoneVariants(value = "") {
  const normalized = normalizePhone(value);
  const variants = new Set();

  if (normalized) variants.add(normalized);
  if (normalized.startsWith("63") && normalized.length === 12) {
    variants.add(`0${normalized.slice(2)}`);
  }

  return [...variants].slice(0, 10);
}

function toE164(value = "") {
  return normalizePhone(value);
}

function toLocal(value = "") {
  const normalized = normalizePhone(value);
  return normalized.startsWith("63") && normalized.length === 12
    ? `0${normalized.slice(2)}`
    : "";
}

module.exports = {
  normalizePhone,
  requireNormalizedPhone,
  phoneVariants,
  toE164,
  toLocal,
};
