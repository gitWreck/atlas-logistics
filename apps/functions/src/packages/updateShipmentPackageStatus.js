"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole, updatedBy } = require("../utilities/helpers");
const {
  getActorFromRequest,
  writePackageActionLog,
} = require("../utilities/packageLogger");
const { normalizeQty } = require("../utilities/packageHelpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updateShipmentPackageStatus = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager", "checker"]);

    // const uid = req.auth?.uid;
    if (!req.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    // const actor = getActorFromRequest(req);

    const {
      shipmentId,
      packageId,
      newStatus, // LOADED | RECEIVED | MISSING
      manualQty,
      updateAll,
      remarks,
      location,
    } = req.data || {};

    const { name, uid, role } = updatedBy(req);

    if (!shipmentId || !packageId || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    const allowedStatuses = ["LOADED", "RECEIVED", "MISSING"];
    if (!allowedStatuses.includes(newStatus)) {
      throw new HttpsError("invalid-argument", `Invalid status: ${newStatus}`);
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);

    await db.runTransaction(async (tx) => {
      // -----------------------------
      // 1. READS FIRST
      // -----------------------------
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found");
      }

      const shipmentData = shipmentSnap.data() || {};
      const currentTripId = shipmentData.currentTripId || null;
      const rawPackages = Array.isArray(shipmentData.packages)
        ? shipmentData.packages
        : [];

      let tripRef = null;
      let tripShipmentRef = null;
      let tripShipmentSnap = null;

      if (currentTripId) {
        tripRef = db.collection("truck_trips").doc(currentTripId);
        tripShipmentRef = tripRef.collection("trip_shipments").doc(shipmentId);
        tripShipmentSnap = await tx.get(tripShipmentRef);

        if (!tripShipmentSnap.exists) {
          throw new HttpsError(
            "not-found",
            "Trip shipment record not found for this shipment.",
          );
        }
      }

      // -----------------------------
      // 2. PURE LOGIC / CALCULATIONS
      // -----------------------------
      const normalizePackage = (pkg = {}) => {
        const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
        const loadedQty = Math.min(normalizeQty(pkg.loadedQty, 0), quantity);
        const receivedQty = Math.min(
          normalizeQty(pkg.receivedQty, 0),
          quantity,
        );
        const missingQty = Math.min(normalizeQty(pkg.missingQty, 0), quantity);

        return {
          ...pkg,
          quantity,
          loadedQty,
          receivedQty,
          missingQty,
        };
      };

      const packages = rawPackages.map(normalizePackage);

      const pkgIndex = packages.findIndex(
        (p) => p.packageId === packageId || p.trackingNumber === packageId,
      );

      if (pkgIndex === -1) {
        throw new HttpsError("not-found", "Package not found");
      }

      const targetPkg = packages[pkgIndex];
      const maxQty = targetPkg.quantity;
      const oldLoadedQty = targetPkg.loadedQty || 0;
      const oldMissingQty = targetPkg.missingQty || 0;

      let nextLoadedQty = oldLoadedQty;
      let nextMissingQty = oldMissingQty;
      let nextPackageStatus = targetPkg.status || "RECEIVED";

      if (newStatus === "LOADED") {
        if (updateAll === true) {
          nextLoadedQty = maxQty;
        } else {
          if (
            manualQty === undefined ||
            manualQty === null ||
            manualQty === ""
          ) {
            throw new HttpsError(
              "invalid-argument",
              "manualQty is required when updateAll is false.",
            );
          }
          nextLoadedQty = Math.min(normalizeQty(manualQty, 0), maxQty);
        }

        nextMissingQty = 0;

        if (nextLoadedQty >= maxQty) {
          nextLoadedQty = maxQty;
          nextPackageStatus = "LOADED";
        } else if (nextLoadedQty > 0) {
          nextPackageStatus = "PARTIALLY_LOADED";
        } else {
          nextPackageStatus = "RECEIVED";
        }
      }

      if (newStatus === "RECEIVED") {
        nextLoadedQty = 0;
        nextMissingQty = 0;
        nextPackageStatus = "RECEIVED";
      }

      if (newStatus === "MISSING") {
        nextLoadedQty = 0;
        nextMissingQty = maxQty;
        nextPackageStatus = "MISSING";
      }

      packages[pkgIndex] = {
        ...targetPkg,
        status: nextPackageStatus,
        loadedQty: nextLoadedQty,
        missingQty: nextMissingQty,
        updatedAt: new Date().toISOString(),
        updatedBy: name,
        remarks: remarks || targetPkg.remarks || null,
      };

      const totalQty = packages.reduce((sum, p) => sum + p.quantity, 0);

      const loadedQty = packages.reduce((sum, p) => {
        if (p.status === "LOADED") return sum + p.quantity;
        if (p.status === "PARTIALLY_LOADED") {
          return sum + Math.min(normalizeQty(p.loadedQty, 0), p.quantity);
        }
        return sum;
      }, 0);

      const missingQty = packages.reduce((sum, p) => {
        if (p.status === "MISSING") return sum + p.quantity;
        return sum + Math.min(normalizeQty(p.missingQty, 0), p.quantity);
      }, 0);

      const pendingQty = Math.max(totalQty - loadedQty - missingQty, 0);

      let finalShipmentStatus = "RECEIVED";
      if (loadedQty === totalQty && totalQty > 0) {
        finalShipmentStatus = "LOADED";
      } else if (loadedQty > 0) {
        finalShipmentStatus = "PARTIALLY_LOADED";
      } else if (missingQty === totalQty && totalQty > 0) {
        finalShipmentStatus = "MISSING";
      } else if (missingQty > 0) {
        finalShipmentStatus = "PARTIALLY_LOADED";
      }

      const oldShipmentLoaded = normalizeQty(shipmentData.totals?.loaded, 0);
      const oldShipmentPending = normalizeQty(shipmentData.totals?.pending, 0);
      const oldShipmentMissing = normalizeQty(shipmentData.totals?.missing, 0);

      const deltaLoaded = loadedQty - oldShipmentLoaded;
      const deltaPending = pendingQty - oldShipmentPending;
      const deltaMissing = missingQty - oldShipmentMissing;

      // -----------------------------
      // 3. WRITES AFTER ALL READS
      // -----------------------------
      tx.update(shipmentRef, {
        packages,
        status: finalShipmentStatus,
        "totals.totalItems": packages.length,
        "totals.totalContentQty": totalQty,
        "totals.loaded": loadedQty,
        "totals.pending": pendingQty,
        "totals.missing": missingQty,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: name,
        ...(location ? { lastLocation: location } : {}),
        statusHistory: FieldValue.arrayUnion({
          status: finalShipmentStatus,
          at: new Date(),
          by: name,
          note:
            remarks || `Package ${packageId} updated to ${nextPackageStatus}`,
          location: location || null,
        }),
      });

      if (currentTripId && tripRef && tripShipmentRef) {
        tx.update(tripShipmentRef, {
          status: finalShipmentStatus,
          totalItems: totalQty,
          loadedCount: loadedQty,
          pendingCount: pendingQty,
          missingCount: missingQty,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: name,
        });

        const tripUpdate = {
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: uid,
        };

        if (deltaLoaded !== 0) {
          tripUpdate.totalLoaded = FieldValue.increment(deltaLoaded);
        }

        if (deltaPending !== 0) {
          tripUpdate.itemPending = FieldValue.increment(deltaPending);
        }

        if (deltaMissing !== 0) {
          tripUpdate.totalExceptions = FieldValue.increment(deltaMissing);
        }

        tx.update(tripRef, tripUpdate);
      }

      writePackageActionLog({
        db,
        tx,
        collection: "admin_logs",
        action: "UPDATE_SHIPMENT_PACKAGE_STATUS",
        packageId: targetPkg.packageId || packageId,
        trackingNumber: targetPkg.trackingNumber || packageId,
        shipmentId,
        tripId: currentTripId,
        actorId: uid,
        actorName: name,
        actorRole: role,
        details: {
          requestedStatus: newStatus,
          packageStatus: nextPackageStatus,
          shipmentStatus: finalShipmentStatus,
          previousStatus: targetPkg.status || null,
          previousLoadedQty: oldLoadedQty,
          previousMissingQty: oldMissingQty,
          loadedQty: nextLoadedQty,
          missingQty: nextMissingQty,
          totalQty,
          pendingQty,
          manualQty: manualQty ?? null,
          updateAll: updateAll === true,
          remarks: remarks || "No remarks provided",
          location: location || null,
        },
      });
    });

    return { success: true };
  },
);
