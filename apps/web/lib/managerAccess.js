function clean(value) {
  return String(value || "").trim();
}

function key(value) {
  return clean(value).replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function list(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function unique(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function warehouses(value = {}) {
  return unique([
    value.warehouseId,
    value.warehouseCode,
    value.warehouseName,
    value.assignedWarehouseId,
    value.assignedWarehouseCode,
    value.assignedWarehouseName,
    value.currentWarehouseId,
    value.currentWarehouseCode,
    value.currentWarehouseName,
    value.originWarehouseId,
    value.originWarehouseCode,
    value.originWarehouseName,
    value.destinationWarehouseId,
    value.destinationWarehouseCode,
    value.destinationWarehouseName,
    value.originCode,
    value.destinationCode,
    value.origin,
    value.destination,
  ]);
}

function municipalities(value = {}) {
  return unique([
    ...list(value.assignedMunicipalities),
    ...list(value.municipalityCoverage),
    ...list(value.serviceMunicipalities),
    ...list(value.handledMunicipalities),
    value.assignedMunicipality,
    value.municipality,
    value.destinationMunicipality,
    value.recipient?.municipality,
    value.recipient?.city,
    value.recipient?.address?.municipality,
    value.recipient?.address?.city,
  ]);
}

function overlaps(left, right) {
  const rightKeys = new Set(right.map(key).filter(Boolean));
  return left.some((value) => rightKeys.has(key(value)));
}

export function managerCanAccessRecord(profile = {}, record = {}) {
  const role = clean(profile.role).toLowerCase();
  if (role === "admin" || role === "administrator") return true;
  if (role !== "manager" || profile.active === false) return false;
  const managerWarehouses = warehouses(profile);
  const recordWarehouses = warehouses(record);
  if (
    !managerWarehouses.length ||
    !recordWarehouses.length ||
    !overlaps(managerWarehouses, recordWarehouses)
  ) return false;
  const managerMunicipalities = municipalities(profile);
  const recordMunicipalities = municipalities(record);
  return (
    !managerMunicipalities.length ||
    !recordMunicipalities.length ||
    overlaps(managerMunicipalities, recordMunicipalities)
  );
}
