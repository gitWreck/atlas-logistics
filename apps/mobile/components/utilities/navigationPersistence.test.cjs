const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  createPersistedRoute,
  getNavigationScope,
  getNavigationStorageKey,
  parsePersistedRoute,
} = require("./navigationPersistence");

test("persists and restores an authenticated checker route with safe params", () => {
  const savedAt = Date.UTC(2026, 8, 24, 10, 0, 0);
  const record = createPersistedRoute({
    scope: "checker",
    segments: ["(checker)", "shipment-details"],
    params: {
      shipmentId: "SHIP-123",
      tags: ["one", "two"],
      ignored: { nested: true },
    },
    savedAt,
  });

  assert.deepEqual(record, {
    version: 1,
    scope: "checker",
    pathname: "/(checker)/shipment-details",
    params: { shipmentId: "SHIP-123", tags: ["one", "two"] },
    savedAt,
  });
  assert.deepEqual(
    parsePersistedRoute(JSON.stringify(record), {
      scope: "checker",
      now: savedAt + 1000,
    }),
    {
      pathname: "/(checker)/shipment-details",
      params: { shipmentId: "SHIP-123", tags: ["one", "two"] },
    },
  );
});

test("rejects auth routes, cross-role routes, and expired records", () => {
  const savedAt = Date.UTC(2026, 8, 24, 10, 0, 0);

  assert.equal(
    createPersistedRoute({
      scope: "checker",
      segments: ["(auth)", "login"],
      savedAt,
    }),
    null,
  );

  const checkerRecord = createPersistedRoute({
    scope: "checker",
    segments: ["(checker)", "scan"],
    params: { mode: "delivery" },
    savedAt,
  });
  assert.equal(
    parsePersistedRoute(JSON.stringify(checkerRecord), {
      scope: "driver",
      now: savedAt + 1000,
    }),
    null,
  );
  assert.equal(
    parsePersistedRoute(JSON.stringify(checkerRecord), {
      scope: "checker",
      now: savedAt + 31 * 24 * 60 * 60 * 1000,
    }),
    null,
  );
});

test("maps roles to allowed navigation scopes and binds storage to the user", () => {
  assert.equal(getNavigationScope({ isStaff: true }), "staff");
  assert.equal(getNavigationScope({ isChecker: true }), "checker");
  assert.equal(getNavigationScope({ isDriver: true }), "driver");
  assert.equal(getNavigationScope({ isCustomer: true }), "customer");
  assert.equal(getNavigationStorageKey(" user-1 "), "atlas_last_route_user-1");
});

test("root layout tracks routes and logout clears the saved route", () => {
  const sourceRoot = path.join(__dirname, "..", "..");
  const rootLayout = readFileSync(
    path.join(sourceRoot, "app", "_layout.js"),
    "utf8",
  );
  const appIndex = readFileSync(
    path.join(sourceRoot, "app", "index.js"),
    "utf8",
  );
  const authContext = readFileSync(
    path.join(sourceRoot, "contexts", "AuthContext.js"),
    "utf8",
  );

  assert.match(rootLayout, /<NavigationPersistence\s*\/>/);
  assert.match(appIndex, /AsyncStorage\.getItem\(storageKey\)/);
  assert.match(appIndex, /parsePersistedRoute\(raw,\s*\{ scope \}\)/);
  assert.match(appIndex, /restoration\.href \|\| "\/\(checker\)"/);
  assert.match(authContext, /getNavigationStorageKey\(/);
  assert.match(
    authContext,
    /AsyncStorage\.removeItem\(navigationStorageKey\)/,
  );
});
