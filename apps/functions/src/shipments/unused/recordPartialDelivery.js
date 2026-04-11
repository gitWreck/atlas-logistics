"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db, now, requireRole } = require("../../../_shared");
const { transitionPackageStatus } = require("./transitionPackageStatus");

exports.recordPartialDelivery = onCall(async (req) => {
  const actor = await requireRole(req, ["admin", "manager", "checker"]);

  const {
    packageId,
    deliveredCount,
    totalCount,
    remarks = "Partial delivery recorded",
  } = req.data;

  if (!packageId || deliveredCount == null || totalCount == null) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  if (deliveredCount <= 0 || deliveredCount > totalCount) {
    throw new HttpsError("invalid-argument", "Invalid delivered count");
  }

  const pkgRef = db.collection("trip_packages").doc(packageId);
  const pkgSnap = await pkgRef.get();

  if (!pkgSnap.exists) {
    throw new HttpsError("not-found", "Package not found");
  }

  const pkg = pkgSnap.data();

  // 1️⃣ Record partial delivery (ledger-style, append-only)
  await db.collection("partial_deliveries").add({
    packageId,
    tripId: pkg.tripId,
    deliveredCount,
    totalCount,
    remainingCount: totalCount - deliveredCount,
    remarks,
    recordedAt: now(),
    actorUid: actor.uid,
    actorRole: actor.role,
  });

  // 2️⃣ Decide status transition
  if (deliveredCount < totalCount) {
    // Partial only → remain In Transit
    await transitionPackageStatus({
      packageRef: pkgRef,
      toStatus: "In Transit",
      remarks: "Partial delivery — remaining items pending",
      actor,
    });
  } else {
    // Fully delivered
    await transitionPackageStatus({
      packageRef: pkgRef,
      toStatus: "Delivered",
      remarks: "All items delivered",
      actor,
    });
  }

  return { ok: true };
});
