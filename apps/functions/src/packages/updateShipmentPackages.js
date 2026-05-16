"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole, updatedBy } = require("../utilities/helpers");
const { writePackageActionLog } = require("../utilities/packageLogger");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updateShipmentPackages = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager", "checker"]);

    const authUid = req.auth?.uid;
    if (!authUid) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    // const actor = updatedBy(req);
    const { name, uid, role } = updatedBy(req);

    const {
      shipmentId,
      packages: newPackagesArray, // full replace from web modal
      packageIds, // scanner-targeted packageIds / trackingNumbers
      newStatus, // RECEIVED | LOADED | DELIVERED | MISSING | DAMAGED
      manualQty, // partial qty for grouped package rows
      remarks,
      location,
      scanAction,
    } = req.data || {};

    if (!shipmentId || typeof shipmentId !== "string") {
      throw new HttpsError("invalid-argument", "Missing shipmentId.");
    }

    const isScannerUpdate = Array.isArray(packageIds) && packageIds.length > 0;
    const isModalReplace = Array.isArray(newPackagesArray);

    if (!isScannerUpdate && !isModalReplace) {
      throw new HttpsError(
        "invalid-argument",
        "Provide either packageIds for scanner update or packages for full replace.",
      );
    }

    if (isScannerUpdate && !newStatus) {
      throw new HttpsError(
        "invalid-argument",
        "newStatus is required for scanner updates.",
      );
    }

    const allowedStatuses = [
      "RECEIVED",
      "LOADED",
      "DELIVERED",
      "MISSING",
      "DAMAGED",
    ];
    if (isScannerUpdate && !allowedStatuses.includes(newStatus)) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid newStatus: ${newStatus}`,
      );
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);

    await db.runTransaction(async (tx) => {
      // -----------------------------
      // 1. READS FIRST
      // -----------------------------
      const shipmentSnap = await tx.get(shipmentRef);
      if (!shipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found.");
      }

      const oldData = shipmentSnap.data() || {};
      const oldPackages = Array.isArray(oldData.packages)
        ? oldData.packages
        : [];
      const tripId = oldData.currentTripId || null;

      let tripRef = null;
      let tripShipmentRef = null;
      let tripShipmentSnap = null;
      let tripSnap = null;

      if (tripId) {
        tripRef = db.collection("truck_trips").doc(tripId);
        tripShipmentRef = tripRef.collection("trip_shipments").doc(shipmentId);
        [tripSnap, tripShipmentSnap] = await Promise.all([
          tx.get(tripRef),
          tx.get(tripShipmentRef),
        ]);

        if (!tripShipmentSnap.exists) {
          throw new HttpsError(
            "not-found",
            "Trip shipment record not found for this shipment.",
          );
        }
      }

      const tripData = tripSnap?.exists ? tripSnap.data() || {} : {};
      const tripType = String(tripData.tripType || "").toUpperCase();
      const isDeliveryTrip = tripType === "DELIVERY";
      const normalizedScanAction = String(scanAction || "").toUpperCase();
      const isLoadingAction =
        normalizedScanAction === "LOAD" || normalizedScanAction === "LOADING";
      const isOffloadingAction =
        normalizedScanAction === "UNLOAD" ||
        normalizedScanAction === "OFFLOADING";
      const oldShipmentStatus = String(oldData.status || "").toUpperCase();
      const oldTripShipmentStatus = String(
        tripShipmentSnap?.exists ? tripShipmentSnap.data()?.status || "" : "",
      ).toUpperCase();
      const shouldPromoteReadyForDelivery =
        isDeliveryTrip &&
        isLoadingAction &&
        newStatus === "LOADED" &&
        (oldShipmentStatus === "READY_FOR_DELIVERY" ||
          oldTripShipmentStatus === "READY_FOR_DELIVERY");
      const wasOutForDelivery =
        oldShipmentStatus === "OUT_FOR_DELIVERY" ||
        oldTripShipmentStatus === "OUT_FOR_DELIVERY";

      // -----------------------------
      // 2. HELPERS
      // -----------------------------
      const nowIso = new Date().toISOString();
      const nowServer = FieldValue.serverTimestamp();

      const normalizeQty = (value, fallback = 0) => {
        const num = Number(value);
        return Number.isFinite(num) && num >= 0 ? num : fallback;
      };

      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      const normalizePackage = (pkg = {}) => {
        const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
        const defaultLoadedQty =
          pkg.status === "LOADED" ||
          pkg.status === "OUT_FOR_DELIVERY" ||
          pkg.status === "DELIVERED"
            ? quantity
            : 0;
        const defaultReceivedQty = pkg.status === "DELIVERED" ? quantity : 0;
        const defaultMissingQty = pkg.status === "MISSING" ? quantity : 0;
        const defaultDamagedQty = pkg.status === "DAMAGED" ? quantity : 0;
        const loadedQty = clamp(
          normalizeQty(pkg.loadedQty, defaultLoadedQty),
          0,
          quantity,
        );
        const receivedQty = clamp(
          normalizeQty(pkg.receivedQty, defaultReceivedQty),
          0,
          quantity,
        );
        const missingQty = clamp(
          normalizeQty(pkg.missingQty, defaultMissingQty),
          0,
          quantity,
        );
        const damagedQty = clamp(
          normalizeQty(pkg.damagedQty, defaultDamagedQty),
          0,
          quantity,
        );

        return {
          ...pkg,
          quantity,
          loadedQty,
          receivedQty,
          missingQty,
          damagedQty,
        };
      };

      const derivePackageStatus = (pkg) => {
        const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
        const loadedQty = clamp(normalizeQty(pkg.loadedQty, 0), 0, quantity);
        const receivedQty = clamp(
          normalizeQty(pkg.receivedQty, 0),
          0,
          quantity,
        );
        const missingQty = clamp(normalizeQty(pkg.missingQty, 0), 0, quantity);
        const damagedQty = clamp(normalizeQty(pkg.damagedQty, 0), 0, quantity);

        if (damagedQty > 0) return "DAMAGED";
        if (missingQty > 0) return "MISSING";
        if (receivedQty >= quantity) return "DELIVERED";
        if (pkg.status === "OUT_FOR_DELIVERY" && loadedQty >= quantity) {
          return "OUT_FOR_DELIVERY";
        }
        if (loadedQty >= quantity) return "LOADED";
        if (loadedQty > 0) return "PARTIALLY_LOADED";
        if (pkg.status === "READY_FOR_DELIVERY") return "READY_FOR_DELIVERY";
        return "RECEIVED";
      };

      const sumTotalQty = (pkgs) =>
        pkgs.reduce(
          (sum, p) => sum + Math.max(normalizeQty(p.quantity, 1), 1),
          0,
        );

      const sumLoadedQty = (pkgs) =>
        pkgs.reduce(
          (sum, p) =>
            sum +
            clamp(
              normalizeQty(p.loadedQty, 0),
              0,
              Math.max(normalizeQty(p.quantity, 1), 1),
            ),
          0,
        );

      const sumReceivedQty = (pkgs) =>
        pkgs.reduce(
          (sum, p) =>
            sum +
            clamp(
              normalizeQty(p.receivedQty, 0),
              0,
              Math.max(normalizeQty(p.quantity, 1), 1),
            ),
          0,
        );

      const sumMissingQty = (pkgs) =>
        pkgs.reduce(
          (sum, p) =>
            sum +
            clamp(
              normalizeQty(p.missingQty, 0),
              0,
              Math.max(normalizeQty(p.quantity, 1), 1),
            ),
          0,
        );

      const sumDamagedQty = (pkgs) =>
        pkgs.reduce(
          (sum, p) =>
            sum +
            clamp(
              normalizeQty(p.damagedQty, 0),
              0,
              Math.max(normalizeQty(p.quantity, 1), 1),
            ),
          0,
        );

      const oldNormalizedPackages = oldPackages.map((pkg) => {
        const normalized = normalizePackage(pkg);
        return {
          ...normalized,
          status: derivePackageStatus(normalized),
        };
      });

      // -----------------------------
      // 3. BUILD FINAL PACKAGE ARRAY
      // -----------------------------
      let finalPackages = [];

      if (isScannerUpdate) {
        const targetedIds = packageIds
          .filter((id) => typeof id === "string" && id.trim())
          .map((id) => id.trim());
        const targetedIdSet = new Set(targetedIds);

        if (!targetedIds.length) {
          throw new HttpsError(
            "invalid-argument",
            "No valid packageIds provided.",
          );
        }

        finalPackages = oldNormalizedPackages.map((pkg) => {
          const identities = [pkg.packageId, pkg.trackingNumber]
            .filter((value) => typeof value === "string" && value.trim())
            .map((value) => value.trim());
          const isTargeted = identities.some((id) => targetedIdSet.has(id));

          if (!isTargeted) {
            return pkg;
          }

          const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
          let loadedQty = clamp(normalizeQty(pkg.loadedQty, 0), 0, quantity);
          let receivedQty = clamp(
            normalizeQty(pkg.receivedQty, 0),
            0,
            quantity,
          );
          let missingQty = clamp(normalizeQty(pkg.missingQty, 0), 0, quantity);
          let damagedQty = clamp(normalizeQty(pkg.damagedQty, 0), 0, quantity);
          const specificQty =
            typeof manualQty === "object" && manualQty !== null
              ? identities
                  .map((id) => manualQty[id])
                  .find(
                    (qty) => qty !== undefined && qty !== null && qty !== "",
                  )
              : manualQty;

          if (newStatus === "RECEIVED") {
            const requestedQty =
              specificQty !== undefined &&
              specificQty !== null &&
              specificQty !== ""
                ? clamp(normalizeQty(specificQty, 0), 0, loadedQty)
                : loadedQty;

            loadedQty = clamp(loadedQty - requestedQty, 0, quantity);
            if (receivedQty > loadedQty) {
              receivedQty = loadedQty;
            }
            missingQty = 0;
            damagedQty = 0;
          } else if (newStatus === "LOADED") {
            const remainingQty = Math.max(quantity - loadedQty, 0);
            const requestedQty =
              specificQty !== undefined &&
              specificQty !== null &&
              specificQty !== ""
                ? clamp(normalizeQty(specificQty, 0), 0, remainingQty)
                : remainingQty;

            loadedQty = clamp(loadedQty + requestedQty, 0, quantity);
            missingQty = 0;
            damagedQty = 0;
          } else if (newStatus === "DELIVERED") {
            const remainingQty = Math.max(quantity - receivedQty, 0);
            const deliverableQty =
              loadedQty > 0 ? Math.min(loadedQty, remainingQty) : remainingQty;
            const requestedQty =
              specificQty !== undefined &&
              specificQty !== null &&
              specificQty !== ""
                ? clamp(normalizeQty(specificQty, 0), 0, deliverableQty)
                : deliverableQty;

            receivedQty = clamp(receivedQty + requestedQty, 0, quantity);
            loadedQty = clamp(loadedQty - requestedQty, 0, quantity);
            missingQty = 0;
            damagedQty = 0;
          } else if (newStatus === "MISSING" || newStatus === "DAMAGED") {
            const issueableQty = isLoadingAction
              ? Math.max(quantity - loadedQty - missingQty - damagedQty, 0)
              : isOffloadingAction
                ? loadedQty
                : loadedQty || quantity;
            const requestedQty =
              specificQty !== undefined &&
              specificQty !== null &&
              specificQty !== ""
                ? clamp(normalizeQty(specificQty, 0), 0, issueableQty)
                : issueableQty;

            loadedQty = clamp(loadedQty - requestedQty, 0, quantity);
            if (receivedQty > loadedQty) {
              receivedQty = loadedQty;
            }

            if (newStatus === "MISSING") {
              missingQty = clamp(requestedQty, 0, quantity);
              damagedQty = 0;
            } else {
              damagedQty = clamp(requestedQty, 0, quantity);
              missingQty = 0;
            }
          }

          const updatedPkg = {
            ...pkg,
            loadedQty,
            receivedQty,
            missingQty,
            damagedQty,
            updatedAt: nowIso,
            updatedBy: name,
            remarks: remarks || pkg.remarks || null,
          };

          const derivedStatus = shouldPromoteReadyForDelivery
            ? "OUT_FOR_DELIVERY"
            : derivePackageStatus(updatedPkg);

          return {
            ...updatedPkg,
            status: derivedStatus,
          };
        });
      } else {
        finalPackages = newPackagesArray.map((pkg) => {
          const normalized = normalizePackage(pkg);
          return {
            ...normalized,
            status: derivePackageStatus(normalized),
          };
        });
      }

      // -----------------------------
      // 4. RECALCULATE TOTALS
      // -----------------------------
      const oldTotalQty = sumTotalQty(oldNormalizedPackages);
      const newTotalQty = sumTotalQty(finalPackages);

      const oldLoadedQty = sumLoadedQty(oldNormalizedPackages);
      const newLoadedQty = sumLoadedQty(finalPackages);

      const oldReceivedQty = sumReceivedQty(oldNormalizedPackages);
      const newReceivedQty = sumReceivedQty(finalPackages);

      const oldMissingQty = sumMissingQty(oldNormalizedPackages);
      const newMissingQty = sumMissingQty(finalPackages);

      const oldDamagedQty = sumDamagedQty(oldNormalizedPackages);
      const newDamagedQty = sumDamagedQty(finalPackages);

      const pendingQty = Math.max(
        newTotalQty - newLoadedQty - newMissingQty - newDamagedQty,
        0,
      );
      const totalRows = finalPackages.length;

      const deltaTotalQty = newTotalQty - oldTotalQty;
      const deltaLoadedQty = newLoadedQty - oldLoadedQty;
      const deltaReceivedQty = newReceivedQty - oldReceivedQty;
      const deltaMissingQty = newMissingQty - oldMissingQty;
      const deltaDamagedQty = newDamagedQty - oldDamagedQty;
      const oldPendingQty = Math.max(
        oldTotalQty - oldLoadedQty - oldMissingQty - oldDamagedQty,
        0,
      );
      const deltaPendingQty = pendingQty - oldPendingQty;

      let shipmentStatus = "RECEIVED";
      if (newReceivedQty >= newTotalQty && newTotalQty > 0) {
        shipmentStatus = "DELIVERED";
      } else if (newDamagedQty >= newTotalQty && newTotalQty > 0) {
        shipmentStatus = "DAMAGED";
      } else if (newMissingQty >= newTotalQty && newTotalQty > 0) {
        shipmentStatus = "MISSING";
      } else if (
        (shouldPromoteReadyForDelivery || wasOutForDelivery) &&
        newLoadedQty >= newTotalQty &&
        newTotalQty > 0
      ) {
        shipmentStatus = "OUT_FOR_DELIVERY";
      } else if (newLoadedQty >= newTotalQty && newTotalQty > 0) {
        shipmentStatus = "LOADED";
      } else if (newLoadedQty > 0) {
        shipmentStatus = "PARTIALLY_LOADED";
      } else if (oldShipmentStatus === "READY_FOR_DELIVERY") {
        shipmentStatus = "READY_FOR_DELIVERY";
      }

      // -----------------------------
      // 5. WRITES
      // -----------------------------
      tx.update(shipmentRef, {
        packages: finalPackages,
        status: shipmentStatus,

        "totals.totalItems": totalRows, // row count only
        "totals.totalContentQty": newTotalQty, // actual quantity
        "totals.loaded": newLoadedQty,
        "totals.received": newReceivedQty,
        "totals.delivered": newReceivedQty,
        "totals.missing": newMissingQty,
        "totals.damaged": newDamagedQty,
        "totals.pending": pendingQty,

        updatedAt: nowServer,
        updatedBy: name,
        ...(location ? { lastLocation: location } : {}),
        statusHistory: FieldValue.arrayUnion({
          status: shipmentStatus,
          at: new Date(),
          by: name,
          note:
            remarks ||
            `Package update: ${newLoadedQty} loaded / ${newReceivedQty} received / ${newMissingQty} missing / ${newDamagedQty} damaged / ${newTotalQty} total`,
          location: location || null,
        }),
      });

      if (tripId && tripRef && tripShipmentRef) {
        tx.update(tripShipmentRef, {
          status: shipmentStatus,
          totalItems: newTotalQty, // trip-side quantity
          pendingCount: pendingQty,
          loadedCount: newLoadedQty,
          deliveredCount: newReceivedQty,
          receivedCount: newReceivedQty,
          missingCount: newMissingQty,
          damagedCount: newDamagedQty,
          updatedAt: nowServer,
          updatedBy: name,
        });

        const tripUpdate = {
          updatedAt: nowServer,
          updatedBy: name,
        };

        if (deltaTotalQty !== 0) {
          tripUpdate.totalItems = FieldValue.increment(deltaTotalQty);
        }

        if (deltaLoadedQty !== 0) {
          tripUpdate.totalLoaded = FieldValue.increment(deltaLoadedQty);
        }

        if (deltaReceivedQty !== 0) {
          tripUpdate.totalArrived = FieldValue.increment(deltaReceivedQty);
          tripUpdate.totalDelivered = FieldValue.increment(deltaReceivedQty);
        }

        if (deltaMissingQty !== 0) {
          tripUpdate.totalMissing = FieldValue.increment(deltaMissingQty);
        }

        if (deltaDamagedQty !== 0) {
          tripUpdate.totalDamaged = FieldValue.increment(deltaDamagedQty);
        }

        if (deltaPendingQty !== 0) {
          tripUpdate.itemPending = FieldValue.increment(deltaPendingQty);
        }

        tx.update(tripRef, tripUpdate);
      }

      const targetedTrackingNumbers = isScannerUpdate
        ? packageIds
            .filter((id) => typeof id === "string" && id.trim())
            .map((id) => id.trim())
        : finalPackages
            .map((p) => p.packageId || p.trackingNumber || null)
            .filter(Boolean);

      writePackageActionLog({
        db,
        tx,
        collection: "admin_logs",
        action: "UPDATE_SHIPMENT_PACKAGES",
        actorId: uid || authUid,
        actorName: name || null,
        actorRole: role || null,
        packageId:
          targetedTrackingNumbers.length === 1
            ? targetedTrackingNumbers[0]
            : null,
        trackingNumber:
          targetedTrackingNumbers.length === 1
            ? targetedTrackingNumbers[0]
            : null,
        shipmentId,
        tripId,
        createdAt: nowServer,
        details: {
          status: shipmentStatus,
          affectedPackages: targetedTrackingNumbers,
          totalRows,
          totalQty: newTotalQty,
          loadedQty: newLoadedQty,
          receivedQty: newReceivedQty,
          missingQty: newMissingQty,
          damagedQty: newDamagedQty,
          pendingQty,
          source: isScannerUpdate ? "SCANNER" : "WEB_MODAL",
          scanAction: scanAction || null,
          remarks: remarks || "No remarks provided",
          location: location || null,
        },
      });
    });

    return { success: true };
  },
);
