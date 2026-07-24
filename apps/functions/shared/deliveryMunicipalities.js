"use strict";

/** Canonical Romblon municipalities for Odiongan delivery operations. */
const DELIVERY_MUNICIPALITIES = Object.freeze([
  "Alcantara",
  "Banton",
  "Cajidiocan",
  "Calatrava",
  "Concepcion",
  "Corcuera",
  "Ferrol",
  "Looc",
  "Magdiwang",
  "Odiongan",
  "Romblon (Capital)",
  "San Agustin",
  "San Andres",
  "San Fernando",
  "San Jose",
  "Santa Fe",
  "Santa Maria",
]);

const MUNICIPALITY_ALIASES = Object.freeze({
  "san andes": "San Andres",
  "san augustin": "San Agustin",
  "odiongan town proper": "Odiongan",
  "town proper": "Odiongan",
  romblon: "Romblon (Capital)",
});

const WRONG_MUNICIPALITY_MESSAGE =
  "This shipment belongs to another route/municipality and cannot be loaded by your account.";

function normalizeMunicipalityKey(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function canonicalMunicipalityLabel(value = "") {
  const key = normalizeMunicipalityKey(value);
  if (!key) return null;

  if (MUNICIPALITY_ALIASES[key]) {
    return MUNICIPALITY_ALIASES[key];
  }

  const match = DELIVERY_MUNICIPALITIES.find(
    (entry) => normalizeMunicipalityKey(entry) === key,
  );
  return match || null;
}

function normalizeMunicipalityList(values = []) {
  if (!Array.isArray(values)) return [];

  const seen = new Set();
  const normalized = [];

  values.forEach((value) => {
    const label = canonicalMunicipalityLabel(value);
    if (!label) return;
    const key = normalizeMunicipalityKey(label);
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(label);
  });

  return normalized;
}

function isKnownDeliveryMunicipality(value = "") {
  return Boolean(canonicalMunicipalityLabel(value));
}

function resolveShipmentMunicipality(shipment = {}) {
  const direct = canonicalMunicipalityLabel(shipment.municipality);
  if (direct) return direct;

  const recipient = shipment.recipient || {};
  const address = recipient.address || {};

  const candidates = [
    shipment.destination,
    recipient.city,
    address.city,
    shipment.destinationCode,
  ];

  for (const candidate of candidates) {
    const label = canonicalMunicipalityLabel(candidate);
    if (label) return label;
  }

  return null;
}

function checkerCoversMunicipality(assignedMunicipalities = [], municipality = "") {
  const target = canonicalMunicipalityLabel(municipality);
  if (!target) return false;

  const targetKey = normalizeMunicipalityKey(target);
  return normalizeMunicipalityList(assignedMunicipalities).some(
    (entry) => normalizeMunicipalityKey(entry) === targetKey,
  );
}

function validateCheckerMunicipalityAccess(shipment = {}, checkerUser = {}) {
  const municipality = resolveShipmentMunicipality(shipment);
  const role = String(checkerUser.role || "").toLowerCase();
  const isStaffOps = ["admin", "manager", "administrator"].includes(role);

  // Admin/manager act as checkers across all municipalities.
  if (isStaffOps) {
    if (!municipality) {
      return {
        ok: false,
        code: "MUNICIPALITY_MISSING",
        message:
          "This shipment has no destination municipality on file. Ask staff to set the municipality before loading.",
        municipality: null,
        assignedMunicipalities: [...DELIVERY_MUNICIPALITIES],
      };
    }
    return {
      ok: true,
      code: "PASS",
      message: null,
      municipality,
      assignedMunicipalities: [...DELIVERY_MUNICIPALITIES],
    };
  }

  const assigned = normalizeMunicipalityList(checkerUser.assignedMunicipalities);

  if (!municipality) {
    return {
      ok: false,
      code: "MUNICIPALITY_MISSING",
      message:
        "This shipment has no destination municipality on file. Ask staff to set the municipality before loading.",
      municipality: null,
      assignedMunicipalities: assigned,
    };
  }

  if (!assigned.length) {
    return {
      ok: false,
      code: "CHECKER_NOT_ASSIGNED",
      message:
        "You have no municipalities assigned to your account. Ask Rose or your manager to assign your delivery areas.",
      municipality,
      assignedMunicipalities: assigned,
    };
  }

  if (!checkerCoversMunicipality(assigned, municipality)) {
    return {
      ok: false,
      code: "WRONG_MUNICIPALITY",
      message: WRONG_MUNICIPALITY_MESSAGE,
      municipality,
      assignedMunicipalities: assigned,
    };
  }

  return {
    ok: true,
    code: "PASS",
    message: null,
    municipality,
    assignedMunicipalities: assigned,
  };
}

module.exports = {
  DELIVERY_MUNICIPALITIES,
  WRONG_MUNICIPALITY_MESSAGE,
  normalizeMunicipalityKey,
  canonicalMunicipalityLabel,
  normalizeMunicipalityList,
  isKnownDeliveryMunicipality,
  resolveShipmentMunicipality,
  checkerCoversMunicipality,
  validateCheckerMunicipalityAccess,
};
