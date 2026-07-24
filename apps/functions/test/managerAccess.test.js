"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  canAccessRecord,
  canAccessStaff,
  getManagerScope,
} = require("../src/manager/managerAccess");

const manager = {
  role: "manager",
  active: true,
  warehouseCode: "ODI",
  warehouseName: "Odiongan Warehouse",
  assignedMunicipalities: ["Odiongan", "Looc"],
};

test("builds the Manager warehouse and municipality scope", () => {
  assert.deepEqual(getManagerScope(manager).municipalities, ["Odiongan", "Looc"]);
  assert.ok(getManagerScope(manager).warehouses.includes("ODI"));
});

test("allows a shipment in the assigned warehouse and municipality", () => {
  assert.equal(
    canAccessRecord(manager, {
      destinationCode: "ODI",
      municipality: "Odiongan",
    }),
    true,
  );
});

test("denies another warehouse and another assigned municipality", () => {
  assert.equal(
    canAccessRecord(manager, {
      destinationCode: "DIV",
      municipality: "Odiongan",
    }),
    false,
  );
  assert.equal(
    canAccessRecord(manager, {
      destinationCode: "ODI",
      municipality: "San Andres",
    }),
    false,
  );
});

test("denies an unassigned Manager instead of treating missing scope as global", () => {
  assert.equal(
    canAccessRecord(
      { role: "manager", active: true },
      { destinationCode: "ODI", municipality: "Odiongan" },
    ),
    false,
  );
});

test("filters staff by both warehouse and configured municipality", () => {
  assert.equal(
    canAccessStaff(manager, {
      role: "checker",
      active: true,
      warehouseCode: "ODI",
      assignedMunicipalities: ["Looc"],
    }),
    true,
  );
  assert.equal(
    canAccessStaff(manager, {
      role: "driver",
      active: true,
      warehouseCode: "ODI",
      assignedMunicipalities: ["Calatrava"],
    }),
    false,
  );
});
