"use strict";

function normalizeAddress(address = {}) {
  return {
    unit: address.unit || "",
    street: address.street || "",
    barangay: address.barangay || "",
    city: address.city || "",
    province: address.province || "",
  };
}

function formatAddress(address = {}) {
  return [
    address.unit,
    address.street,
    address.barangay,
    address.city,
    address.province,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
}

module.exports = {
  normalizeAddress,
  formatAddress,
};
