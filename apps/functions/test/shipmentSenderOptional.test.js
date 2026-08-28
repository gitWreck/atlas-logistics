"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..", "..", "..");
const read = (...parts) => fs.readFileSync(path.join(repositoryRoot, ...parts), "utf8");

test("shipment creation accepts an empty optional sender contact", () => {
  const callable = read("apps", "functions", "src", "shipments", "createShipment.js");
  const form = read(
    "apps",
    "web",
    "app",
    "(internal)",
    "components",
    "shipments",
    "ReceivePackageForm",
    "ReceivePackageForm.jsx",
  );
  const modal = read(
    "apps",
    "web",
    "app",
    "(internal)",
    "components",
    "shipments",
    "modals",
    "UnifiedShipmentModal.jsx",
  );

  assert.doesNotMatch(callable, /Sender name is required/);
  assert.doesNotMatch(form, /Sender Required/);
  assert.match(form, /label="Sender Contact"[\s\S]*?optional/);
  assert.doesNotMatch(modal, /Email is enabled, but neither sender nor recipient/);
  assert.match(callable, /name: sender\?\.name \|\| ""/);
  assert.match(callable, /\.join\(", "\) \|\| origin/);
});
