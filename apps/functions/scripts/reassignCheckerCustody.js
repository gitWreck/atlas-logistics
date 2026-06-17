"use strict";

/**
 * Bulk reassign checker custody from one Firebase UID to another.
 *
 * Updates shipment package fields, shipment-level custody/manifest fields,
 * and delivery_manifests owned by the old checker.
 *
 * Usage (dry run first):
 *   cd apps/functions
 *   DRY_RUN=1 FROM_CHECKER_UID=fqc4w2KJT7QS17eBO21wi4BLtOe2 TO_CHECKER_UID=YgC3wJ0iQGSqQnTtS9xVh4b6ACt1 node scripts/reassignCheckerCustody.js
 *
 * Auth (pick one):
 *   - FIREBASE_SERVICE_ACCOUNT_KEY in apps/web/.env.local (loaded automatically)
 *   - GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   - gcloud auth application-default login
 *
 * Apply:
 *   FROM_CHECKER_UID=... TO_CHECKER_UID=... node scripts/reassignCheckerCustody.js
 *
 * Single shipment only:
 *   SHIPMENT_ID=AT-20260610-SHP-189538 FROM_CHECKER_UID=... TO_CHECKER_UID=... node scripts/reassignCheckerCustody.js
 *
 * Assign entire shipment to one checker (any other checker on pieces -> TO):
 *   DRY_RUN=1 ASSIGN_ALL=1 SHIPMENT_ID=AT-20260610-SHP-189538 TO_CHECKER_UID=YgC3wJ0iQGSqQnTtS9xVh4b6ACt1 node scripts/reassignCheckerCustody.js
 *
 * Verify only (count remaining old-checker references, no writes):
 *   VERIFY=1 FROM_CHECKER_UID=... TO_CHECKER_UID=... node scripts/reassignCheckerCustody.js
 */

const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { collectActiveCheckerIds } = require("../src/checker/checkerPieceOperations");
const { initAdminApp } = require("./initAdmin");

initAdminApp();
const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN === "1";
const VERIFY_ONLY = process.env.VERIFY === "1";
const ASSIGN_ALL = process.env.ASSIGN_ALL === "1";
const SHIPMENT_ID = String(process.env.SHIPMENT_ID || "").trim();
const FROM_UID = String(process.env.FROM_CHECKER_UID || "").trim();
const TO_UID = String(process.env.TO_CHECKER_UID || "").trim();
const PAGE_SIZE = Number(process.env.PAGE_SIZE || 300);

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function replaceUid(value, fromUid, toUid) {
  if (value == null) return { value, changed: false };
  const raw = String(value);
  if (raw === fromUid) return { value: toUid, changed: true };
  if (raw === `CHECKER_${fromUid}`) {
    return { value: `CHECKER_${toUid}`, changed: true };
  }
  return { value: raw, changed: false };
}

function remapActiveCheckerIds(ids = [], fromUid, toUid) {
  const next = new Set();
  let changed = false;

  for (const entry of Array.isArray(ids) ? ids : []) {
    const raw = String(entry || "").trim();
    if (!raw) continue;
    if (raw === fromUid) {
      next.add(toUid);
      changed = true;
      continue;
    }
    next.add(raw);
  }

  if (changed && !next.has(toUid)) {
    next.add(toUid);
  }

  return { value: [...next], changed };
}

function packageReferencesChecker(pkg = {}, fromUid) {
  const fields = [
    pkg.loadedByCheckerId,
    pkg.custodyOwnerId,
    pkg.deliveredByCheckerId,
    pkg.failedByUid,
    pkg.deliveryVehicleId,
  ];
  const fromVehicle = `CHECKER_${fromUid}`;
  return fields.some((value) => {
    const raw = String(value || "");
    return raw === fromUid || raw === fromVehicle || raw.includes(fromUid);
  });
}

function shipmentReferencesChecker(data = {}, fromUid) {
  if (packageReferencesChecker({ custodyOwnerId: data.custodyOwnerId }, fromUid)) {
    return true;
  }
  if (String(data.assignedCheckerId || "") === fromUid) return true;
  if (String(data.custodyOwnerId || "") === fromUid) return true;
  if (
    String(data.deliveryVehicleId || "") === `CHECKER_${fromUid}` ||
    String(data.deliveryVehicleId || "").includes(fromUid)
  ) {
    return true;
  }
  if (
    Array.isArray(data.activeCheckerIds) &&
    data.activeCheckerIds.some((id) => String(id) === fromUid)
  ) {
    return true;
  }
  const packages = Array.isArray(data.packages) ? data.packages : [];
  return packages.some((pkg) => packageReferencesChecker(pkg, fromUid));
}

function remapPackage(
  pkg = {},
  {
    fromUid,
    toUid,
    toName,
    toManifestId,
    toVehicleId,
    toVehicleName,
  },
) {
  let changed = false;
  const next = { ...pkg };

  const loadedBy = replaceUid(next.loadedByCheckerId, fromUid, toUid);
  if (loadedBy.changed) {
    next.loadedByCheckerId = loadedBy.value;
    next.loadedByCheckerName = toName;
    changed = true;
  }

  const deliveredBy = replaceUid(next.deliveredByCheckerId, fromUid, toUid);
  if (deliveredBy.changed) {
    next.deliveredByCheckerId = deliveredBy.value;
    changed = true;
  }

  const failedBy = replaceUid(next.failedByUid, fromUid, toUid);
  if (failedBy.changed) {
    next.failedByUid = failedBy.value;
    changed = true;
  }

  if (String(next.custodyOwnerType || "").toUpperCase() === "CHECKER") {
    const custody = replaceUid(next.custodyOwnerId, fromUid, toUid);
    if (custody.changed) {
      next.custodyOwnerId = custody.value;
      changed = true;
    }
  }

  const vehicle = replaceUid(next.deliveryVehicleId, fromUid, toUid);
  if (vehicle.changed) {
    next.deliveryVehicleId = toVehicleId;
    next.deliveryVehicleName = toVehicleName;
    changed = true;
  }

  if (
    changed &&
    toManifestId &&
    String(next.status || "").toUpperCase() !== "DELIVERED"
  ) {
    next.deliveryManifestId = toManifestId;
  }

  if (changed) {
    next.updatedAt = new Date().toISOString();
  }

  return { pkg: next, changed };
}

function isForeignCheckerUid(value, toUid) {
  const raw = String(value || "").trim();
  if (!raw || raw === toUid) return false;
  if (raw === `CHECKER_${toUid}`) return false;
  if (raw.startsWith("CHECKER_")) return true;
  return raw.length >= 20;
}

function forceRemapPackageToChecker(
  pkg = {},
  { toUid, toName, toManifestId, toVehicleId, toVehicleName },
) {
  let changed = false;
  const next = { ...pkg };

  if (isForeignCheckerUid(next.loadedByCheckerId, toUid)) {
    next.loadedByCheckerId = toUid;
    next.loadedByCheckerName = toName;
    changed = true;
  }

  if (isForeignCheckerUid(next.deliveredByCheckerId, toUid)) {
    next.deliveredByCheckerId = toUid;
    next.deliveredByCheckerName = toName;
    changed = true;
  }

  if (isForeignCheckerUid(next.failedByUid, toUid)) {
    next.failedByUid = toUid;
    changed = true;
  }

  if (String(next.custodyOwnerType || "").toUpperCase() === "CHECKER") {
    if (isForeignCheckerUid(next.custodyOwnerId, toUid)) {
      next.custodyOwnerId = toUid;
      changed = true;
    }
  }

  const vehicleId = String(next.deliveryVehicleId || "");
  if (
    vehicleId &&
    vehicleId !== toVehicleId &&
    (vehicleId.startsWith("CHECKER_") || isForeignCheckerUid(vehicleId, toUid))
  ) {
    next.deliveryVehicleId = toVehicleId;
    next.deliveryVehicleName = toVehicleName;
    changed = true;
  }

  const status = String(next.status || "").toUpperCase();
  if (
    toManifestId &&
    ["OUT_FOR_DELIVERY", "LOADED_TO_DELIVERY_VEHICLE", "LOADED", "READY_FOR_DELIVERY"].includes(
      status,
    )
  ) {
    if (next.deliveryManifestId !== toManifestId) {
      next.deliveryManifestId = toManifestId;
      changed = true;
    }
  }

  if (changed) {
    next.updatedAt = new Date().toISOString();
  }

  return { pkg: next, changed };
}

async function assignEntireShipmentToChecker(docSnap, context) {
  const data = docSnap.data() || {};
  const packages = Array.isArray(data.packages) ? data.packages : [];

  let packagesChanged = false;
  const remappedPackages = packages.map((pkg) => {
    const result = forceRemapPackageToChecker(pkg, context);
    if (result.changed) packagesChanged = true;
    return result.pkg;
  });

  const activeCheckerIds = collectActiveCheckerIds(remappedPackages);
  const update = {
    assignedCheckerId: context.toUid,
    assignedCheckerName: context.toName,
    activeCheckerIds:
      activeCheckerIds.length > 0 ? activeCheckerIds : [context.toUid],
    deliveryVehicleId: context.toVehicleId,
    deliveryVehicleName: context.toVehicleName,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: `checker-assign:${context.toName}`,
  };

  if (packagesChanged) {
    update.packages = remappedPackages;
  }

  if (
    context.toManifestId &&
    remappedPackages.some(
      (pkg) => String(pkg.status || "").toUpperCase() !== "DELIVERED",
    )
  ) {
    update.deliveryManifestId = context.toManifestId;
  }

  if (
    String(data.custodyOwnerType || "").toUpperCase() === "CHECKER" &&
    isForeignCheckerUid(data.custodyOwnerId, context.toUid)
  ) {
    update.custodyOwnerId = context.toUid;
  }

  console.log(
    `${DRY_RUN ? "[DRY_RUN] " : ""}assign entire shipment ${docSnap.id} -> ${context.toName} (${context.toUid})`,
  );
  remappedPackages.forEach((pkg) => {
    const id = pkg.packageId || pkg.trackingNumber;
    const owner = pkg.loadedByCheckerId || pkg.custodyOwnerId || "-";
    console.log(`  ${id}: ${pkg.status} (checker ${owner})`);
  });

  if (!DRY_RUN) {
    await docSnap.ref.update(update);
  }

  return true;
}

async function resolveCheckerProfile(checkerUid) {
  const snap = await db.collection("users").doc(checkerUid).get();
  if (!snap.exists) {
    throw new Error(`Checker user not found: ${checkerUid}`);
  }
  const data = snap.data() || {};
  const role = String(data.role || "").toLowerCase();
  if (role !== "checker" && role !== "manager" && role !== "admin") {
    console.warn(`Warning: user ${checkerUid} role is ${role || "unknown"}`);
  }
  const name =
    normalizeString(data.fullName) ||
    normalizeString(data.name) ||
    normalizeString(data.displayName) ||
    checkerUid;
  return { name, data };
}

async function resolveTargetManifestId(checkerUid) {
  const snap = await db
    .collection("delivery_manifests")
    .where("checkerId", "==", checkerUid)
    .limit(20)
    .get();

  if (snap.empty) return null;

  const activeStatuses = new Set(["DRAFT", "LOADED"]);
  const sorted = snap.docs
    .filter((docSnap) =>
      activeStatuses.has(String(docSnap.data()?.status || "").toUpperCase()),
    )
    .sort((a, b) => {
      const aMs = (a.data()?.updatedAt || a.data()?.createdAt)?.toMillis?.() || 0;
      const bMs = (b.data()?.updatedAt || b.data()?.createdAt)?.toMillis?.() || 0;
      return bMs - aMs;
    });

  return sorted[0]?.id || snap.docs[0].id;
}

async function resolveShipmentDoc(shipmentId) {
  const directSnap = await db.collection("shipments").doc(shipmentId).get();
  if (directSnap.exists) return directSnap;

  const querySnap = await db
    .collection("shipments")
    .where("shipmentId", "==", shipmentId)
    .limit(1)
    .get();

  if (!querySnap.empty) return querySnap.docs[0];
  return null;
}

async function* iterateShipments() {
  if (SHIPMENT_ID) {
    const docSnap = await resolveShipmentDoc(SHIPMENT_ID);
    if (!docSnap) {
      throw new Error(`Shipment not found: ${SHIPMENT_ID}`);
    }
    yield docSnap;
    return;
  }

  let lastId = null;

  while (true) {
    let query = db
      .collection("shipments")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(PAGE_SIZE);

    if (lastId) {
      query = query.startAfter(lastId);
    }

    const snap = await query.get();
    if (snap.empty) return;

    for (const docSnap of snap.docs) {
      yield docSnap;
    }

    lastId = snap.docs[snap.docs.length - 1].id;
  }
}

async function reassignShipment(docSnap, context) {
  const data = docSnap.data() || {};
  if (!shipmentReferencesChecker(data, context.fromUid)) {
    return false;
  }

  const packages = Array.isArray(data.packages) ? data.packages : [];
  let packagesChanged = false;
  const remappedPackages = packages.map((pkg) => {
    const result = remapPackage(pkg, context);
    if (result.changed) packagesChanged = true;
    return result.pkg;
  });

  const update = {};
  let shipmentChanged = packagesChanged;

  if (packagesChanged) {
    update.packages = remappedPackages;
    update.activeCheckerIds = collectActiveCheckerIds(remappedPackages);
  } else {
    const activeIds = remapActiveCheckerIds(
      data.activeCheckerIds,
      context.fromUid,
      context.toUid,
    );
    if (activeIds.changed) {
      update.activeCheckerIds = activeIds.value;
      shipmentChanged = true;
    }
  }

  const assigned = replaceUid(data.assignedCheckerId, context.fromUid, context.toUid);
  if (assigned.changed) {
    update.assignedCheckerId = assigned.value;
    shipmentChanged = true;
  }

  if (
    String(data.custodyOwnerType || "").toUpperCase() === "CHECKER" &&
    String(data.custodyOwnerId || "") === context.fromUid
  ) {
    update.custodyOwnerId = context.toUid;
    shipmentChanged = true;
  }

  const vehicle = replaceUid(data.deliveryVehicleId, context.fromUid, context.toUid);
  if (vehicle.changed) {
    update.deliveryVehicleId = context.toVehicleId;
    update.deliveryVehicleName = context.toVehicleName;
    shipmentChanged = true;
  }

  if (
    shipmentChanged &&
    context.toManifestId &&
    remappedPackages.some(
      (pkg) => String(pkg.status || "").toUpperCase() !== "DELIVERED",
    )
  ) {
    update.deliveryManifestId = context.toManifestId;
  }

  if (!shipmentChanged) return false;

  update.updatedAt = FieldValue.serverTimestamp();
  update.updatedBy = `checker-reassign:${context.toName}`;

  console.log(
    `${DRY_RUN ? "[DRY_RUN] " : ""}shipment ${docSnap.id} -> checker ${context.toUid}`,
  );

  if (!DRY_RUN) {
    await docSnap.ref.update(update);
  }

  return true;
}

async function reassignDeliveryManifests(context) {
  const snap = await db
    .collection("delivery_manifests")
    .where("checkerId", "==", context.fromUid)
    .get();

  if (snap.empty) {
    console.log("No delivery_manifests owned by source checker.");
    return 0;
  }

  let count = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const update = {
      checkerId: context.toUid,
      checkerName: context.toName,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: `checker-reassign:${context.toName}`,
    };

    const vehicle = replaceUid(data.deliveryVehicleId, context.fromUid, context.toUid);
    if (vehicle.changed) {
      update.deliveryVehicleId = context.toVehicleId;
      update.deliveryVehicleName = context.toVehicleName;
    }

    console.log(
      `${DRY_RUN ? "[DRY_RUN] " : ""}delivery_manifest ${docSnap.id} -> checker ${context.toUid}`,
    );

    if (!DRY_RUN) {
      await docSnap.ref.update(update);
    }
    count += 1;
  }

  return count;
}

async function verifyRemainingReferences(context) {
  let scanned = 0;
  let affectedShipments = 0;
  const sampleIds = [];

  for await (const docSnap of iterateShipments()) {
    scanned += 1;
    const data = docSnap.data() || {};
    if (!shipmentReferencesChecker(data, context.fromUid)) continue;

    affectedShipments += 1;
    if (sampleIds.length < 15) {
      sampleIds.push(docSnap.id);
    }
  }

  const manifestSnap = await db
    .collection("delivery_manifests")
    .where("checkerId", "==", context.fromUid)
    .get();

  console.log("");
  console.log("Verify summary");
  console.log(`  shipments scanned: ${scanned}`);
  console.log(
    `  shipments still referencing ${context.fromUid}: ${affectedShipments}`,
  );
  console.log(
    `  delivery_manifests still owned by ${context.fromUid}: ${manifestSnap.size}`,
  );
  if (sampleIds.length > 0) {
    console.log("  sample shipment ids:");
    sampleIds.forEach((id) => console.log(`    - ${id}`));
  }
  if (affectedShipments === 0 && manifestSnap.size === 0) {
    console.log("  OK: no remaining references to the old checker.");
  } else {
    console.log("  Action needed: run dry run, then apply without VERIFY/DRY_RUN.");
  }
}

async function main() {
  if (!TO_UID) {
    throw new Error("Set TO_CHECKER_UID.");
  }

  if (ASSIGN_ALL) {
    if (!SHIPMENT_ID) {
      throw new Error("ASSIGN_ALL requires SHIPMENT_ID.");
    }

    const toProfile = await resolveCheckerProfile(TO_UID);
    const toManifestId = await resolveTargetManifestId(TO_UID);
    const context = {
      fromUid: FROM_UID || null,
      toUid: TO_UID,
      toName: toProfile.name,
      toManifestId,
      toVehicleId: `CHECKER_${TO_UID}`,
      toVehicleName: `${toProfile.name}'s van`,
    };

    console.log("Assign entire shipment to checker");
    console.log(`  shipment: ${SHIPMENT_ID}`);
    console.log(`  checker:  ${TO_UID} (${toProfile.name})`);
    console.log(`  manifest: ${toManifestId || "(none)"}`);
    console.log(`  dry run:  ${DRY_RUN ? "yes" : "no"}`);

    const docSnap = await resolveShipmentDoc(SHIPMENT_ID);
    if (!docSnap) {
      throw new Error(`Shipment not found: ${SHIPMENT_ID}`);
    }

    await assignEntireShipmentToChecker(docSnap, context);
    console.log(DRY_RUN ? "Dry run complete." : "Done.");
    return;
  }

  if (!FROM_UID) {
    throw new Error("Set FROM_CHECKER_UID (or use ASSIGN_ALL=1 for whole-shipment assign).");
  }
  if (FROM_UID === TO_UID) {
    throw new Error("FROM_CHECKER_UID and TO_CHECKER_UID must be different.");
  }

  const toProfile = await resolveCheckerProfile(TO_UID);
  const toManifestId = await resolveTargetManifestId(TO_UID);
  const toVehicleId = `CHECKER_${TO_UID}`;
  const toVehicleName = `${toProfile.name}'s van`;

  const context = {
    fromUid: FROM_UID,
    toUid: TO_UID,
    toName: toProfile.name,
    toManifestId,
    toVehicleId,
    toVehicleName,
  };

  console.log("Checker custody reassignment");
  console.log(`  from: ${FROM_UID}`);
  console.log(`  to:   ${TO_UID} (${toProfile.name})`);
  console.log(`  target manifest: ${toManifestId || "(none — will skip manifest id on pieces)"}`);
  console.log(`  shipment scope: ${SHIPMENT_ID || "all shipments"}`);
  console.log(`  dry run: ${DRY_RUN ? "yes" : "no"}`);
  console.log(`  verify only: ${VERIFY_ONLY ? "yes" : "no"}`);

  if (VERIFY_ONLY) {
    await verifyRemainingReferences(context);
    return;
  }

  let scanned = 0;
  let updatedShipments = 0;

  for await (const docSnap of iterateShipments()) {
    scanned += 1;
    const changed = await reassignShipment(docSnap, context);
    if (changed) updatedShipments += 1;
  }

  const updatedManifests = SHIPMENT_ID
    ? 0
    : await reassignDeliveryManifests(context);

  if (SHIPMENT_ID) {
    console.log("  (skipped global delivery_manifests — single-shipment scope)");
  }

  console.log("");
  console.log(`Scanned shipments: ${scanned}`);
  console.log(`Updated shipments: ${updatedShipments}`);
  console.log(`Updated delivery manifests: ${updatedManifests}`);
  console.log(DRY_RUN ? "Dry run complete. Re-run without DRY_RUN=1 to apply." : "Done.");
  if (!DRY_RUN) {
    console.log("");
    console.log("Post-apply verify:");
    await verifyRemainingReferences(context);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
