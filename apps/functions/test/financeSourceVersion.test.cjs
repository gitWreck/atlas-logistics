"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { financeSourceVersionIncrement } = require("../src/invoices/financeSourceVersion.cjs");

test("legacy mirrored invoices advance from the Finance baseline to version 2", () => {
  assert.equal(financeSourceVersionIncrement(undefined), 2);
  assert.equal(financeSourceVersionIncrement(null), 2);
  assert.equal(financeSourceVersionIncrement(0), 2);
});

test("versioned Transport invoices continue one version at a time", () => {
  assert.equal(financeSourceVersionIncrement(1), 1);
  assert.equal(financeSourceVersionIncrement(7), 1);
});
