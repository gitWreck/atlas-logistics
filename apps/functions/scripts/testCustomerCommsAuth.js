"use strict";

/**
 * Standalone unit test for the customer-communication authorization rules
 * (spec sections 5-13, 17). Pure logic — no Firebase, no deploy required.
 *
 * Run:  node apps/functions/scripts/testCustomerCommsAuth.js
 */

const {
  assertCustomerCommsAllowed,
  evaluateCheckerCustomerComms,
  resolveShipmentCommsOwner,
  countCheckerActiveDeliveryPieces,
} = require("../src/chat/customerCommsAuth");

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
  }
}

function expectAllowed(params) {
  const result = assertCustomerCommsAllowed(params);
  if (!result || !result.owner) {
    throw new Error("Expected allowed, but no owner returned.");
  }
  return result;
}

function expectDenied(params) {
  try {
    assertCustomerCommsAllowed(params);
  } catch (error) {
    if (String(error.message) !== "403 Permission Denied") {
      throw new Error(`Expected "403 Permission Denied", got "${error.message}"`);
    }
    return;
  }
  throw new Error("Expected 403, but the call was allowed.");
}

const CHECKER = "checker-1";
const OTHER_CHECKER = "checker-2";

// A shipment out for delivery with one piece in CHECKER's custody.
const activeShipment = {
  status: "OUT_FOR_DELIVERY",
  assignedCheckerId: CHECKER,
  packages: [
    { status: "OUT_FOR_DELIVERY", loadedByCheckerId: CHECKER, quantity: 1 },
  ],
};

console.log("Role matrix (sections 5, 6, 13):");
check("Admin may contact any customer", () =>
  expectAllowed({ uid: "a1", role: "admin", shipment: null }),
);
check("Manager may contact any customer", () =>
  expectAllowed({ uid: "m1", role: "manager", shipment: null }),
);
check("Driver is always denied", () =>
  expectDenied({ uid: "d1", role: "driver", shipment: activeShipment }),
);
check("Unknown role is denied", () =>
  expectDenied({ uid: "x1", role: "warehouse", shipment: activeShipment }),
);

console.log("\nChecker custody rules (sections 7, 8, 11):");
check("Checker with OFD custody piece is allowed", () =>
  expectAllowed({ uid: CHECKER, role: "checker", shipment: activeShipment }),
);
check("Checker denied when shipment DELIVERED", () =>
  expectDenied({
    uid: CHECKER,
    role: "checker",
    shipment: { ...activeShipment, status: "DELIVERED" },
  }),
);
check("Checker denied when shipment RETURNED", () =>
  expectDenied({
    uid: CHECKER,
    role: "checker",
    shipment: { ...activeShipment, status: "RETURNED_TO_WAREHOUSE" },
  }),
);
check("Checker denied when not assigned / no custody piece", () =>
  expectDenied({ uid: OTHER_CHECKER, role: "checker", shipment: activeShipment }),
);
check("Checker denied when their piece already DELIVERED", () =>
  expectDenied({
    uid: CHECKER,
    role: "checker",
    shipment: {
      status: "OUT_FOR_DELIVERY",
      assignedCheckerId: CHECKER,
      packages: [
        { status: "DELIVERED", loadedByCheckerId: CHECKER, quantity: 1 },
      ],
    },
  }),
);
check("Checker denied when piece not yet out for delivery (on van only)", () =>
  expectDenied({
    uid: CHECKER,
    role: "checker",
    shipment: {
      status: "READY_FOR_DELIVERY",
      assignedCheckerId: CHECKER,
      packages: [
        { status: "LOADED_TO_DELIVERY_VEHICLE", loadedByCheckerId: CHECKER, quantity: 1 },
      ],
    },
  }),
);
check("Checker denied with missing shipment", () =>
  expectDenied({ uid: CHECKER, role: "checker", shipment: null }),
);

console.log("\nPiece counting + owner resolution (section 14):");
check("countCheckerActiveDeliveryPieces counts only OFD custody pieces", () => {
  const n = countCheckerActiveDeliveryPieces(
    {
      packages: [
        { status: "OUT_FOR_DELIVERY", loadedByCheckerId: CHECKER, quantity: 2 },
        { status: "DELIVERED", loadedByCheckerId: CHECKER, quantity: 5 },
        { status: "OUT_FOR_DELIVERY", loadedByCheckerId: OTHER_CHECKER, quantity: 9 },
      ],
    },
    CHECKER,
  );
  if (n !== 2) throw new Error(`Expected 2, got ${n}`);
});
check("resolveShipmentCommsOwner returns custody checker when OFD", () => {
  const owner = resolveShipmentCommsOwner(activeShipment);
  if (owner.ownerType !== "checker" || owner.checkerId !== CHECKER) {
    throw new Error(`Expected checker ${CHECKER}, got ${JSON.stringify(owner)}`);
  }
});
check("resolveShipmentCommsOwner falls back to warehouse when delivered", () => {
  const owner = resolveShipmentCommsOwner({ ...activeShipment, status: "DELIVERED" });
  if (owner.ownerType !== "warehouse") {
    throw new Error(`Expected warehouse, got ${JSON.stringify(owner)}`);
  }
});

console.log("\nCustomer caller (section 16):");
check("Customer allowed only for their own thread", () =>
  expectAllowed({ uid: "cust1", role: "customer", customerId: "cust1" }),
);
check("Customer denied for another customer's thread", () =>
  expectDenied({ uid: "cust1", role: "customer", customerId: "cust2" }),
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
