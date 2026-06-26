export const DELIVERY_MUNICIPALITIES = [
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
];

const MUNICIPALITY_ALIASES = {
  "san andes": "San Andres",
  "san augustin": "San Agustin",
  "odiongan town proper": "Odiongan",
  romblon: "Romblon (Capital)",
};

export function normalizeMunicipalityKey(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function canonicalMunicipalityLabel(value = "") {
  const key = normalizeMunicipalityKey(value);
  if (!key) return null;
  if (MUNICIPALITY_ALIASES[key]) return MUNICIPALITY_ALIASES[key];
  return (
    DELIVERY_MUNICIPALITIES.find(
      (entry) => normalizeMunicipalityKey(entry) === key,
    ) || null
  );
}

export function resolveShipmentMunicipality(shipment = {}) {
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

export function checkerCoversMunicipality(
  assignedMunicipalities = [],
  municipality = "",
) {
  const target = canonicalMunicipalityLabel(municipality);
  if (!target) return false;

  const targetKey = normalizeMunicipalityKey(target);
  return (assignedMunicipalities || [])
    .map((entry) => canonicalMunicipalityLabel(entry))
    .filter(Boolean)
    .some((entry) => normalizeMunicipalityKey(entry) === targetKey);
}

export function formatMunicipalityList(values = []) {
  return [...new Set((values || []).map(canonicalMunicipalityLabel).filter(Boolean))];
}
