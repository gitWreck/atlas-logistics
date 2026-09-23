const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  countCheckerLoadedPieces,
  createLayeredBarcodeIndex,
  createScanGate,
  createSerialTaskQueue,
  selectCachedShipment,
} = require("./scanPerformance");
const { getUsableCachedAuthProfile } = require("./authPerformance");

test("uses an in-memory shipment before waiting for a network refresh", () => {
  const shipment = { id: "shipment-1", status: "OUT_FOR_DELIVERY" };

  assert.equal(
    selectCachedShipment({ "shipment-1": shipment }, ["shipment-1"]),
    shipment,
  );
  assert.equal(selectCachedShipment({}, "shipment-1"), null);
});

test("only restores an active cached profile for the current authenticated UID", () => {
  const options = {
    uid: "checker-1",
    allowedRoles: ["checker", "manager"],
  };
  const active = JSON.stringify({
    uid: "checker-1",
    role: "checker",
    active: true,
  });

  assert.equal(getUsableCachedAuthProfile(active, options).uid, "checker-1");
  assert.equal(
    getUsableCachedAuthProfile(
      JSON.stringify({ uid: "checker-2", role: "checker" }),
      options,
    ),
    null,
  );
  assert.equal(
    getUsableCachedAuthProfile(
      JSON.stringify({ uid: "checker-1", role: "checker", active: false }),
      options,
    ),
    null,
  );
  assert.equal(
    getUsableCachedAuthProfile(
      JSON.stringify({ uid: "checker-1", role: "unknown" }),
      options,
    ),
    null,
  );
});

test("layers trip and checker barcode indexes without copying them", () => {
  const tripHit = { shipmentData: { id: "trip-shipment" } };
  const checkerHit = { shipmentData: { id: "checker-shipment" } };
  const tripIndex = new Map([["TRIP-CODE", tripHit]]);
  const checkerIndex = new Map([
    ["TRIP-CODE", checkerHit],
    ["CHECKER-CODE", checkerHit],
  ]);
  const index = createLayeredBarcodeIndex(tripIndex, checkerIndex);

  assert.equal(index.get("TRIP-CODE"), tripHit);
  assert.equal(index.get("CHECKER-CODE"), checkerHit);
  assert.equal(index.get("MISSING"), undefined);
});

test("accepts different QR codes after the 400ms cooldown", () => {
  const gate = createScanGate();

  assert.equal(gate.accept(" package-a ", 1000).accepted, true);
  assert.deepEqual(gate.accept("PACKAGE-B", 1399), {
    accepted: false,
    reason: "cooldown",
    code: "PACKAGE-B",
  });
  assert.equal(gate.accept("PACKAGE-B", 1400).accepted, true);
});

test("blocks the same normalized QR for 2.5 seconds", () => {
  const gate = createScanGate();

  assert.equal(gate.accept("package-a", 1000).accepted, true);
  assert.equal(gate.accept(" PACKAGE-A ", 2499).reason, "duplicate");
  assert.equal(gate.accept("PACKAGE-A", 3499).reason, "duplicate");
  assert.equal(gate.accept("PACKAGE-A", 3500).accepted, true);
});

test("last-mile progress counts only pieces loaded by the active checker", () => {
  const shipment = {
    loadedCount: 3,
    totals: { loaded: 3 },
    packages: [
      {
        packageId: "PKG-01",
        status: "OUT_FOR_DELIVERY",
        loadedByCheckerId: "checker-1",
      },
      {
        packageId: "PKG-02",
        status: "RELEASED_FOR_DELIVERY",
        custodyOwnerType: "WAREHOUSE",
      },
      {
        packageId: "PKG-03",
        status: "OUT_FOR_DELIVERY",
        loadedByCheckerId: "checker-2",
      },
    ],
  };

  assert.equal(countCheckerLoadedPieces(shipment, "checker-1"), 1);
  assert.equal(countCheckerLoadedPieces(shipment, "checker-2"), 1);
  assert.equal(countCheckerLoadedPieces(shipment, null), 0);
});

test("serial task queue preserves order and continues after a failure", async () => {
  const depthChanges = [];
  const events = [];
  const queue = createSerialTaskQueue({
    onDepthChange: (depth) => depthChanges.push(depth),
  });

  const first = queue.enqueue(async () => {
    events.push("first:start");
    await Promise.resolve();
    events.push("first:end");
  });
  const failed = queue.enqueue(async () => {
    events.push("failed:start");
    throw new Error("expected test failure");
  });
  const last = queue.enqueue(async () => {
    events.push("last:start");
  });

  await first;
  await assert.rejects(failed, /expected test failure/);
  await last;

  assert.deepEqual(events, [
    "first:start",
    "first:end",
    "failed:start",
    "last:start",
  ]);
  assert.equal(queue.getDepth(), 0);
  assert.deepEqual(depthChanges, [1, 2, 3, 2, 1, 0]);
});

async function loadDashboardData() {
  const dashboardPath = path.join(
    __dirname,
    "..",
    "checker",
    "dashboardData.js",
  );
  const source = readFileSync(dashboardPath, "utf8");
  const dataUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  return import(dataUrl);
}

test("dashboard summary counts package activity once for the selected checker and date", async () => {
  const { getDashboardSummaryForDate } = await loadDashboardData();
  const selectedDate = new Date(2026, 8, 23, 12, 0, 0);
  const shipments = [
    {
      id: "shipment-1",
      packages: [
        {
          status: "DELIVERED",
          quantity: 2,
          deliveredByCheckerId: "checker-1",
          deliveredAt: new Date(2026, 8, 23, 10, 0, 0),
        },
        {
          status: "FAILED_DELIVERY",
          failedByUid: "checker-1",
          failedAt: new Date(2026, 8, 23, 11, 0, 0),
        },
        {
          status: "RETURNED_TO_WAREHOUSE",
          returnedByUid: "checker-2",
          returnedAt: new Date(2026, 8, 23, 11, 30, 0),
        },
        {
          status: "DELIVERED",
          deliveredByCheckerId: "checker-1",
          deliveredAt: new Date(2026, 8, 22, 12, 0, 0),
        },
      ],
    },
  ];

  const result = getDashboardSummaryForDate(
    shipments,
    "checker-1",
    selectedDate,
  );

  assert.equal(result.delivered, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.returned, 0);
  assert.equal(result.recentDelivered.length, 1);
  assert.equal(
    result.recentDelivered[0].deliveredAtDate.getTime(),
    new Date(2026, 8, 23, 10, 0, 0).getTime(),
  );
});

test("checker home does not create duplicate Firestore shipment listeners", () => {
  const homePath = path.join(
    __dirname,
    "..",
    "..",
    "app",
    "(checker)",
    "(tabs)",
    "index.js",
  );
  const source = readFileSync(homePath, "utf8");

  assert.doesNotMatch(source, /firebase\/firestore/);
  assert.doesNotMatch(source, /\bonSnapshot\b/);
  assert.match(source, /useCheckerLastMile\(\)/);
});

test("scanner does not persist the entire shared route cache a second time", () => {
  const scannerPath = path.join(
    __dirname,
    "..",
    "..",
    "app",
    "(checker)",
    "scan.js",
  );
  const source = readFileSync(scannerPath, "utf8");

  assert.doesNotMatch(source, /warmShipmentCache\(routeShipments\)/);
});

test("scanner success confirmations are persistent for camera and manual input", () => {
  const sourceRoot = path.join(__dirname, "..", "..");
  const scanner = readFileSync(
    path.join(sourceRoot, "app", "(checker)", "scan.js"),
    "utf8",
  );
  const modal = readFileSync(
    path.join(sourceRoot, "components", "scanner", "ScanSuccessModal.js"),
    "utf8",
  );

  assert.doesNotMatch(scanner, /if \(source === "scan"\)/);
  assert.doesNotMatch(scanner, /SUCCESS_MODAL_SECONDS/);
  assert.doesNotMatch(modal, /Auto-closing/);
  assert.match(modal, /onScanAnother/);
  assert.match(modal, /onDone/);
});

test("online startup does not hydrate or merge the full offline shipment cache", () => {
  const sourceRoot = path.join(__dirname, "..", "..");
  const offlineContext = readFileSync(
    path.join(sourceRoot, "contexts", "OfflineSyncContext.js"),
    "utf8",
  );
  const lastMile = readFileSync(
    path.join(sourceRoot, "hooks", "useCheckerLastMileSync.js"),
    "utf8",
  );

  assert.match(
    offlineContext,
    /if \(!isOnline\)[\s\S]{0,300}void refreshCacheState\(\)/,
  );
  assert.doesNotMatch(
    offlineContext,
    /useEffect\(\(\) => \{\s*void refreshCacheState\(\);\s*void refreshQueueState\(\)/,
  );
  assert.match(lastMile, /replace:\s*true/);
});

test("high-volume checker tabs use virtualized lists and freeze when inactive", () => {
  const sourceRoot = path.join(__dirname, "..", "..");
  const available = readFileSync(
    path.join(sourceRoot, "components", "checker", "AvailableToLoadScreen.js"),
    "utf8",
  );
  const deliveries = readFileSync(
    path.join(sourceRoot, "app", "(checker)", "(tabs)", "deliveries.js"),
    "utf8",
  );
  const tabs = readFileSync(
    path.join(sourceRoot, "app", "(checker)", "(tabs)", "_layout.js"),
    "utf8",
  );

  assert.match(available, /<FlatList/);
  assert.doesNotMatch(available, /filteredShipments\.map\(/);
  assert.match(deliveries, /<FlatList/);
  assert.doesNotMatch(deliveries, /myRouteShipments\.map\(/);
  assert.match(tabs, /freezeOnBlur:\s*true/);
});

test("message listeners are scoped to the focused tab", () => {
  const messages = readFileSync(
    path.join(
      __dirname,
      "..",
      "checker",
      "CheckerChatScreen.js",
    ),
    "utf8",
  );

  assert.match(messages, /useFocusEffect/);
  assert.doesNotMatch(messages, /\buseEffect\(/);
  assert.match(messages, /removeClippedSubviews=\{Platform\.OS !== "web"\}/);
});

test("global services wait for authentication and customer notifications stay role-scoped", () => {
  const rootLayout = readFileSync(
    path.join(__dirname, "..", "..", "app", "_layout.js"),
    "utf8",
  );

  assert.match(rootLayout, /function AuthenticatedServices/);
  assert.match(rootLayout, /if \(!isReady \|\| !user\) return null/);
  assert.match(rootLayout, /\{isCustomer \? \(/);
});
