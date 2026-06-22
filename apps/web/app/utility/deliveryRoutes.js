export function getPackageRouteLabel(pkg = {}) {
  const name = String(pkg.assignedRouteName || "").trim();
  if (name) return name;

  const routeId = String(pkg.assignedRouteId || "").trim();
  if (routeId) return routeId;

  return "Unassigned Route";
}

export function isPackageRouteAssigned(pkg = {}) {
  return Boolean(String(pkg.assignedRouteId || "").trim());
}

export function summarizeShipmentRouteAssignment(shipment = {}) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  let assigned = 0;
  let unassigned = 0;
  let ineligible = 0;

  packages.forEach((pkg) => {
    const status = String(pkg.status || "").trim().toUpperCase();
    if (["DELIVERED", "COMPLETED", "MISSING", "DAMAGED", "CANCELLED"].includes(status)) {
      ineligible += 1;
      return;
    }

    if (String(pkg.loadedByCheckerId || "").trim()) {
      ineligible += 1;
      return;
    }

    if (isPackageRouteAssigned(pkg)) {
      assigned += 1;
    } else if (
      pkg.availableForDelivery === true ||
      status === "RELEASED_FOR_DELIVERY" ||
      status === "ROUTE_ASSIGNED"
    ) {
      unassigned += 1;
    }
  });

  return {
    assigned,
    unassigned,
    ineligible,
    totalPool: assigned + unassigned,
    isFullyAssigned: unassigned === 0 && assigned > 0,
  };
}

export function getRecipientMunicipality(shipment = {}) {
  const recipient = shipment.recipient || {};
  const address = recipient.address || {};
  return (
    String(address.city || recipient.city || shipment.destination || "").trim() ||
    null
  );
}
