"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = admin.firestore;
const { requireRole } = require("../utilities/helpers");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.updateShipmentPackages = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
  async (req) => {
    await requireRole(db, req, ["admin", "manager", "checker"]);

    const uid = req.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const {
      shipmentId,
      packages: newPackagesArray, // full replace from web modal
      packageIds, // scanner-targeted packageIds / trackingNumbers
      newStatus, // RECEIVED | LOADED | DELIVERED
      manualQty, // partial qty for grouped package rows
      remarks,
      location,
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

    const allowedStatuses = ["RECEIVED", "LOADED", "DELIVERED"];
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

      if (tripId) {
        tripRef = db.collection("truck_trips").doc(tripId);
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
          pkg.status === "LOADED" || pkg.status === "DELIVERED"
            ? quantity
            : 0;
        const defaultReceivedQty = pkg.status === "DELIVERED" ? quantity : 0;
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

        return {
          ...pkg,
          quantity,
          loadedQty,
          receivedQty,
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

        if (receivedQty >= quantity) return "DELIVERED";
        if (loadedQty >= quantity) return "LOADED";
        if (loadedQty > 0) return "PARTIALLY_LOADED";
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

        if (!targetedIds.length) {
          throw new HttpsError(
            "invalid-argument",
            "No valid packageIds provided.",
          );
        }

        finalPackages = oldNormalizedPackages.map((pkg) => {
          const identity = pkg.packageId || pkg.trackingNumber || null;
          if (!identity || !targetedIds.includes(identity)) {
            return pkg;
          }

          const quantity = Math.max(normalizeQty(pkg.quantity, 1), 1);
          let loadedQty = clamp(normalizeQty(pkg.loadedQty, 0), 0, quantity);
          let receivedQty = clamp(
            normalizeQty(pkg.receivedQty, 0),
            0,
            quantity,
          );
          const specificQty =
            typeof manualQty === "object" && manualQty !== null
              ? manualQty[identity]
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
          } else if (newStatus === "LOADED") {
            const remainingQty = Math.max(quantity - loadedQty, 0);
            const requestedQty =
              specificQty !== undefined &&
              specificQty !== null &&
              specificQty !== ""
                ? clamp(normalizeQty(specificQty, 0), 0, remainingQty)
                : remainingQty;

            loadedQty = clamp(loadedQty + requestedQty, 0, quantity);
          } else if (newStatus === "DELIVERED") {
            const remainingQty = Math.max(quantity - receivedQty, 0);
            const requestedQty =
              specificQty !== undefined &&
              specificQty !== null &&
              specificQty !== ""
                ? clamp(normalizeQty(specificQty, 0), 0, remainingQty)
                : remainingQty;

            receivedQty = clamp(receivedQty + requestedQty, 0, quantity);
            if (loadedQty < receivedQty) {
              loadedQty = receivedQty;
            }
          }

          const updatedPkg = {
            ...pkg,
            loadedQty,
            receivedQty,
            updatedAt: nowIso,
            updatedBy: uid,
            remarks: remarks || pkg.remarks || null,
          };

          return {
            ...updatedPkg,
            status: derivePackageStatus(updatedPkg),
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

      const pendingQty = Math.max(newTotalQty - newLoadedQty, 0);
      const totalRows = finalPackages.length;

      const deltaTotalQty = newTotalQty - oldTotalQty;
      const deltaLoadedQty = newLoadedQty - oldLoadedQty;
      const deltaReceivedQty = newReceivedQty - oldReceivedQty;
      const oldPendingQty = Math.max(oldTotalQty - oldLoadedQty, 0);
      const deltaPendingQty = pendingQty - oldPendingQty;

      let shipmentStatus = "RECEIVED";
      if (newReceivedQty >= newTotalQty && newTotalQty > 0) {
        shipmentStatus = "DELIVERED";
      } else if (newLoadedQty >= newTotalQty && newTotalQty > 0) {
        shipmentStatus = "LOADED";
      } else if (newLoadedQty > 0) {
        shipmentStatus = "PARTIALLY_LOADED";
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
        "totals.pending": pendingQty,

        updatedAt: nowServer,
        updatedBy: uid,
        ...(location ? { lastLocation: location } : {}),
        statusHistory: FieldValue.arrayUnion({
          status: shipmentStatus,
          at: new Date(),
          by: uid,
          note:
            remarks ||
            `Package update: ${newLoadedQty} loaded / ${newReceivedQty} received / ${newTotalQty} total`,
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
          updatedAt: nowServer,
          updatedBy: uid,
        });

        const tripUpdate = {
          updatedAt: nowServer,
          updatedBy: uid,
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

      tx.set(db.collection("admin_logs").doc(), {
        action: "UPDATE_SHIPMENT_PACKAGES",
        actorId: uid,
        shipmentId,
        tripId,
        timestamp: nowServer,
        details: {
          status: shipmentStatus,
          affectedPackages: targetedTrackingNumbers,
          totalRows,
          totalQty: newTotalQty,
          loadedQty: newLoadedQty,
          receivedQty: newReceivedQty,
          pendingQty,
          source: isScannerUpdate ? "SCANNER" : "WEB_MODAL",
          remarks: remarks || "No remarks provided",
          location: location || null,
        },
      });
    });

    return { success: true };
  },
);
