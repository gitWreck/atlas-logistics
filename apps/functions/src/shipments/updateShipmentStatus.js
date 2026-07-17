"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const {
  requireRole,
  updatedBy,
} = require("../utilities/helpers");
const { ALLOWED_SHIPMENT_STATUSES } = require("../utilities/dataDetails");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const { buildDerivedShipmentSnapshot } = require("../packages/shipmentStatus");
const { writeShipmentEvent } = require("../tracking/writeShipmentEvent");
const { EVENT_TYPES } = require("../tracking/eventTypes");
const {
  normalizePackageIdSet,
  collectTargetPieceIdentities,
  assertHasTargetPieces,
  assertRequestedPiecesOwned,
  shouldTargetCheckerPiece,
  applyPieceDelivered,
} = require("../checker/checkerPieceOperations");
const {
  assertCustodyScanStatusAllowed,
} = require("../trips/manifestLockGuard");
const {
  resolveShipmentCustomerNotificationType,
  shouldBlockCustomerNotification,
} = require("../notifications/customerNotificationTypes");
const {
  sendShipmentCustomerNotification,
  sendAutomaticShipmentLifecycleNotification,
  CUSTOMER_NOTIFICATION_TYPES,
} = require("../notifications/customerNotificationService");
const {
  normalizeNotificationChannels,
} = require("../utilities/notificationHelpers");
const { normalizeQty } = require("../utilities/packageHelpers");
const { tryAutoCompleteTrip } = require("../trips/autoCompleteTrip");
const { PACKAGE_STATUS } = require("../packages/packageStatus");
const {
  enforceMunicipalityDeliveryAccess,
} = require("../routes/municipalityDeliveryAccess");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
const { defineSecret } = require("firebase-functions/params");

const SMTP_EMAIL = defineSecret("SMTP_EMAIL");
const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

function wasShipmentOutForDelivery(status = "") {
  const normalized = String(status || "").toUpperCase();
  return (
    normalized === "OUT_FOR_DELIVERY" ||
    normalized === "PARTIALLY_OUT_FOR_DELIVERY"
  );
}

function wasShipmentDelivered(status = "") {
  const normalized = String(status || "").toUpperCase();
  return normalized === "DELIVERED" || normalized === "COMPLETED";
}

function buildShipmentNotificationPlan({
  shipment,
  oldStatus,
  newStatus,
  notify,
  notificationChannels,
  notifySms,
  notifyEmail,
  notifyPush,
  sourceUI,
  tripId,
}) {
  if (notify !== true) return null;
  if (
    shouldBlockCustomerNotification({
      notify: true,
      source: sourceUI,
    })
  ) {
    return null;
  }

  const notificationType = resolveShipmentCustomerNotificationType(
    oldStatus,
    newStatus,
  );
  if (!notificationType) return null;

  const channels = normalizeNotificationChannels({
    notificationChannels,
    notify,
    notifySms,
    notifyEmail,
    notifyPush,
  });

  if (!channels.sms && !channels.email && !channels.push) {
    return null;
  }

  return {
    notificationType,
    channels,
    tripId:
      tripId ||
      shipment.currentTripId ||
      shipment.currentTruckTripId ||
      null,
  };
}

exports.updateShipmentStatus = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME, SMTP_EMAIL, SMTP_PASSWORD],
  },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Auth required.");
    }

    const actor = await requireRole(db, req, [
      "admin",
      "manager",
      "checker",
      "driver",
    ]);

    const actorMeta = updatedBy(req);
    const uid = actor.uid;
    const role = actor.role;
    const name = actor.user?.name || actor.user?.fullName || actorMeta.name || uid;
    const usercode = actorMeta.usercode;
    const checkerAuthUid = req.auth?.uid || uid;

    const {
      shipmentId,
      tripId,
      newStatus,
      remarks,
      location,
      proofOfDelivery,
      proofOfReceipt,
      paymentStatus,
      notify = false,
      notifySms,
      notifyEmail,
      notifyPush,
      notificationChannels = null,
      sourceUI = "SYSTEM",
      packageIds = null,
      receiverName = null,
      receiverSignature = null,
      gpsCoordinates = null,
      failureReasonCode = null,
      returnDisposition = null,
    } = req.data || {};

    if (!shipmentId || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing shipmentId or status.");
    }

    if (!ALLOWED_SHIPMENT_STATUSES.includes(newStatus)) {
      throw new HttpsError("invalid-argument", `Invalid status: ${newStatus}`);
    }

    const isFinalDeliveryStatus =
      newStatus === "DELIVERED" || newStatus === "COMPLETED";

    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const tripRef = tripId ? db.collection("truck_trips").doc(tripId) : null;
    const tripShipmentRef = tripRef
      ? tripRef.collection("trip_shipments").doc(shipmentId)
      : null;

    if (actor.role === "driver") {
      const driverStatuses = new Set([
        "DELIVERED",
        "COMPLETED",
        "FAILED_DELIVERY",
        "CANCELLED",
        "DAMAGED",
      ]);
      if (!driverStatuses.has(newStatus)) {
        throw new HttpsError(
          "permission-denied",
          "Drivers can only complete an assigned delivery or record a delivery exception.",
        );
      }

      const [driverShipmentSnap, driverTripSnap, driverTripShipmentSnap] = await Promise.all([
        shipmentRef.get(),
        tripRef ? tripRef.get() : Promise.resolve(null),
        tripShipmentRef ? tripShipmentRef.get() : Promise.resolve(null),
      ]);
      if (!driverShipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found.");
      }
      const driverShipment = driverShipmentSnap.data() || {};
      const driverShipmentStatus = String(driverShipment.status || "").toUpperCase();
      const directlyAssigned =
        String(driverShipment.driverId || driverShipment.assignedDriverId || "") === String(actor.uid);
      const assignedThroughTrip = Boolean(
        driverTripSnap?.exists &&
        driverTripShipmentSnap?.exists &&
        String(driverTripSnap.data()?.driverId || "") === String(actor.uid),
      );
      if (!directlyAssigned && !assignedThroughTrip) {
        throw new HttpsError(
          "permission-denied",
          "This shipment is not assigned to your Driver account.",
        );
      }

      const activeDeliveryStatuses = new Set([
        "OUT_FOR_DELIVERY",
        "PARTIALLY_OUT_FOR_DELIVERY",
        "FAILED_DELIVERY",
      ]);
      if (!activeDeliveryStatuses.has(driverShipmentStatus)) {
        throw new HttpsError(
          "failed-precondition",
          "The Checker must load and release this shipment for delivery before the Driver can update it.",
        );
      }
      if (isFinalDeliveryStatus && driverShipmentStatus === "FAILED_DELIVERY") {
        throw new HttpsError(
          "failed-precondition",
          "A failed delivery must be rescheduled and released again before it can be completed.",
        );
      }

      if (isFinalDeliveryStatus) {
        const photos = Array.isArray(proofOfDelivery)
          ? proofOfDelivery.filter((value) => typeof value === "string" && value.trim())
          : typeof proofOfDelivery === "string" && proofOfDelivery.trim()
            ? [proofOfDelivery]
            : [];
        const signaturePoints = Array.isArray(receiverSignature?.points)
          ? receiverSignature.points
          : [];
        const lat = Number(gpsCoordinates?.lat ?? gpsCoordinates?.latitude);
        const lng = Number(gpsCoordinates?.lng ?? gpsCoordinates?.longitude);
        if (!String(receiverName || "").trim()) {
          throw new HttpsError("failed-precondition", "Receiver name is required before delivery completion.");
        }
        if (photos.length === 0) {
          throw new HttpsError("failed-precondition", "A delivery photo is required before delivery completion.");
        }
        if (signaturePoints.length < 2) {
          throw new HttpsError("failed-precondition", "Receiver signature is required before delivery completion.");
        }
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new HttpsError("failed-precondition", "GPS coordinates are required before delivery completion.");
        }
      } else if (!String(failureReasonCode || returnDisposition || remarks || "").trim()) {
        throw new HttpsError("failed-precondition", "A delivery exception reason is required.");
      }
    }

    let checkerPromotedOutForDelivery = false;
    let checkerDeliveredPieceIds = [];
    let resultStatus = newStatus;
    let completedTripId = null;
    let shipmentWasOutForDelivery = false;
    let shipmentWasDelivered = false;

    const packageIdSet = normalizePackageIdSet(packageIds);
    const isCheckerPieceDelivery =
      isFinalDeliveryStatus && actor.role === "checker";

    if (isCheckerPieceDelivery) {
      const shipmentSnap = await shipmentRef.get();
      if (!shipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found.");
      }

      const currentData = shipmentSnap.data() || {};
      const packages = Array.isArray(currentData.packages)
        ? currentData.packages
        : [];

      for (const pkg of packages) {
        if (
          !shouldTargetCheckerPiece(pkg, {
            checkerUid: checkerAuthUid,
            shipmentData: currentData,
            packageIdSet,
            mode: "deliver",
          })
        ) {
          continue;
        }

        await enforceMunicipalityDeliveryAccess({
          db,
          shipment: currentData,
          shipmentId,
          checkerUser: actor.user,
          scannerUid: checkerAuthUid,
          scannerName: name,
          scannerRole: role,
          scanType: "DELIVER",
          pkg,
          gps: req.data?.gpsCoordinates || null,
        });
      }
    }

    let updatedShipmentData = null;

    const notificationPlan = await db.runTransaction(async (tx) => {
      const shipmentSnap = await tx.get(shipmentRef);

      if (!shipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found.");
      }

      let tripShipSnap = null;
      let tripSnap = null;
      if (tripShipmentRef) {
        tripShipSnap = await tx.get(tripShipmentRef);
      }
      if (tripRef) {
        tripSnap = await tx.get(tripRef);
      }

      const currentData = shipmentSnap.data() || {};
      updatedShipmentData = currentData;
      const oldStatus = currentData.status || null;
      shipmentWasOutForDelivery = wasShipmentOutForDelivery(oldStatus);
      shipmentWasDelivered = wasShipmentDelivered(oldStatus);
      const tripData = tripSnap?.exists ? tripSnap.data() : null;
      assertCustodyScanStatusAllowed(currentData, tripData, newStatus);

      const currentPackages = Array.isArray(currentData.packages)
        ? currentData.packages
        : [];

      const normalizePackage = (pkg = {}) => {
        const quantity = normalizeQty(pkg.quantity, 1) || 1;
        const loadedQty = Math.min(normalizeQty(pkg.loadedQty, 0), quantity);
        const receivedQty = Math.min(
          normalizeQty(pkg.receivedQty, 0),
          quantity,
        );

        return {
          ...pkg,
          quantity,
          loadedQty,
          receivedQty,
        };
      };

      const oldPackages = currentPackages.map(normalizePackage);

      const sumTotalQty = (pkgs) =>
        pkgs.reduce((sum, pkg) => sum + normalizeQty(pkg.quantity, 1), 0);

      const sumLoadedQty = (pkgs) =>
        pkgs.reduce((sum, pkg) => {
          const quantity = normalizeQty(pkg.quantity, 1);
          if (pkg.status === "LOADED") return sum + quantity;
          if (pkg.status === "PARTIALLY_LOADED") {
            return sum + Math.min(normalizeQty(pkg.loadedQty, 0), quantity);
          }
          return sum;
        }, 0);

      const sumReceivedQty = (pkgs) =>
        pkgs.reduce((sum, pkg) => {
          const quantity = normalizeQty(pkg.quantity, 1);
          if (pkg.status === "DELIVERED" || pkg.status === "COMPLETED") {
            return sum + quantity;
          }
          if (pkg.status === "PARTIALLY_RECEIVED") {
            return sum + Math.min(normalizeQty(pkg.receivedQty, 0), quantity);
          }
          return sum;
        }, 0);

      const oldTotalQty =
        sumTotalQty(oldPackages) ||
        Number(currentData.totals?.totalContentQty || 0);

      const oldLoadedQty =
        sumLoadedQty(oldPackages) || Number(currentData.totals?.loaded || 0);

      const oldReceivedQty =
        sumReceivedQty(oldPackages) ||
        Number(
          currentData.totals?.received || currentData.totals?.delivered || 0,
        );

      const rowCount = oldPackages.length;

      const isCheckerOwnedPiece = (pkg = {}) => {
        if (actor.role !== "checker") return true;
        const checkerUid = String(checkerAuthUid || "");
        const legacyUserCode = String(usercode || "").trim();
        const loadedBy = String(pkg.loadedByCheckerId || "").trim();
        if (
          loadedBy &&
          (loadedBy === checkerUid ||
            (legacyUserCode && loadedBy === legacyUserCode))
        ) {
          return true;
        }
        const custodyId = String(pkg.custodyOwnerId || "").trim();
        return (
          String(pkg.custodyOwnerType || "").toUpperCase() === "CHECKER" &&
          (custodyId === checkerUid ||
            (legacyUserCode && custodyId === legacyUserCode))
        );
      };

      const canPromotePieceToOutForDelivery = (pkg = {}) => {
        const status = String(pkg.status || "").toUpperCase();
        return [
          PACKAGE_STATUS.LOADED_TO_DELIVERY_VEHICLE,
          PACKAGE_STATUS.LOADED,
          PACKAGE_STATUS.READY_FOR_DELIVERY,
          PACKAGE_STATUS.PARTIALLY_LOADED,
        ].includes(status);
      };

      if (newStatus === "OUT_FOR_DELIVERY" && actor.role === "checker") {
        const promotableCount = oldPackages.filter(
          (pkg) =>
            isCheckerOwnedPiece(pkg) && canPromotePieceToOutForDelivery(pkg),
        ).length;
        if (promotableCount === 0) {
          throw new HttpsError(
            "failed-precondition",
            "No loaded pieces on your van to mark out for delivery.",
          );
        }
      }

      if (isCheckerPieceDelivery) {
        assertRequestedPiecesOwned(
          oldPackages,
          packageIdSet,
          checkerAuthUid,
          currentData,
          "deliver",
        );
        const targetIdentities = collectTargetPieceIdentities(oldPackages, {
          checkerUid: checkerAuthUid,
          shipmentData: currentData,
          packageIdSet,
          mode: "deliver",
        });
        assertHasTargetPieces(
          targetIdentities,
          "deliver. Mark out for delivery or scan the piece label first.",
        );
        checkerDeliveredPieceIds = targetIdentities;
      }

      const updatedPackages = oldPackages.map((pkg) => {
        const quantity = normalizeQty(pkg.quantity, 1);

        if (isCheckerPieceDelivery) {
          if (
            !shouldTargetCheckerPiece(pkg, {
              checkerUid: checkerAuthUid,
              shipmentData: currentData,
              packageIdSet,
              mode: "deliver",
            })
          ) {
            return pkg;
          }
          return applyPieceDelivered(pkg, {
            actorUid: checkerAuthUid,
            actorName: name,
          });
        }

        if (newStatus === "OUT_FOR_DELIVERY" && actor.role === "checker") {
          if (!isCheckerOwnedPiece(pkg)) return pkg;
          if (String(pkg.status || "").toUpperCase() === "OUT_FOR_DELIVERY") {
            return pkg;
          }
          if (!canPromotePieceToOutForDelivery(pkg)) return pkg;
        }

        const nextStatus = isFinalDeliveryStatus ? "DELIVERED" : newStatus;

        const nextPkg = {
          ...pkg,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        };

        if (newStatus === "LOADED") {
          nextPkg.loadedQty = quantity;
        } else if (newStatus === "RECEIVED") {
          nextPkg.loadedQty = 0;
          nextPkg.receivedQty = 0;
        } else if (newStatus === "OUT_FOR_DELIVERY") {
          const prevLoaded = normalizeQty(pkg.loadedQty, 0);
          nextPkg.loadedQty =
            prevLoaded > 0 ? Math.min(prevLoaded, quantity) : quantity;
        } else if (isFinalDeliveryStatus) {
          nextPkg.loadedQty = quantity;
          nextPkg.receivedQty = quantity;
          nextPkg.deliveredAt = new Date().toISOString();
        } else if (newStatus === "MISSING") {
          nextPkg.loadedQty = 0;
        }

        return nextPkg;
      });

      checkerPromotedOutForDelivery =
        newStatus === "OUT_FOR_DELIVERY" &&
        actor.role === "checker" &&
        updatedPackages.some(
          (pkg, index) =>
            String(pkg.status || "").toUpperCase() === "OUT_FOR_DELIVERY" &&
            String(oldPackages[index]?.status || "").toUpperCase() !==
              "OUT_FOR_DELIVERY",
        );

      const newTotalQty = sumTotalQty(updatedPackages) || oldTotalQty;

      let newLoadedQty = oldLoadedQty;
      let newReceivedQty = oldReceivedQty;

      if (newStatus === "LOADED") {
        newLoadedQty = newTotalQty;
        newReceivedQty = 0;
      } else if (newStatus === "RECEIVED") {
        newLoadedQty = 0;
        newReceivedQty = 0;
      } else if (isFinalDeliveryStatus) {
        if (isCheckerPieceDelivery) {
          newLoadedQty = sumLoadedQty(updatedPackages);
          newReceivedQty = sumReceivedQty(updatedPackages);
        } else {
          newLoadedQty = newTotalQty;
          newReceivedQty = newTotalQty;
        }
      } else if (newStatus === "MISSING") {
        newLoadedQty = 0;
      }

      const newPendingQty = Math.max(newTotalQty - newLoadedQty, 0);

      const derivedSnapshot = buildDerivedShipmentSnapshot(updatedPackages, {
        previousStatus: oldStatus,
        totals: {
          totalQty: newTotalQty,
          receivedQty: newReceivedQty,
          loadedQty: newLoadedQty,
        },
        shouldPromoteOutForDelivery:
          newStatus === "OUT_FOR_DELIVERY" &&
          (actor.role === "checker" || checkerPromotedOutForDelivery),
      });

      const derivedShipmentStatus = derivedSnapshot.status;
      const reconciledPackages = derivedSnapshot.packages;

      const packagesUnchanged =
        reconciledPackages.length === oldPackages.length &&
        reconciledPackages.every(
          (pkg, index) =>
            String(pkg.status || "").toUpperCase() ===
              String(oldPackages[index]?.status || "").toUpperCase() &&
            pkg.availableForDelivery ===
              oldPackages[index]?.availableForDelivery,
        );

      if (
        !isCheckerPieceDelivery &&
        actor.role !== "driver" &&
        packagesUnchanged &&
        derivedShipmentStatus === oldStatus
      ) {
        return null;
      }

      const shipmentUpdate = {
        status: derivedShipmentStatus,
        packages: reconciledPackages,
        packageBreakdown: derivedSnapshot.packageBreakdown,
        availableForDelivery: derivedSnapshot.availableForDelivery,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: name,
        remarks: remarks || null,

        ...(location && { lastLocation: location }),
        ...(proofOfDelivery && { proofOfDelivery }),
        ...(receiverName && { receiverName: String(receiverName).trim() }),
        ...(receiverSignature && { receiverSignature }),
        ...(gpsCoordinates && { deliveryGpsCoordinates: gpsCoordinates }),
        ...(failureReasonCode && { failureReasonCode }),
        ...(returnDisposition && { returnDisposition }),
        ...(proofOfReceipt && { proofOfReceipt }),
        ...(paymentStatus && { paymentStatus }),

        "totals.totalItems": rowCount,
        "totals.totalContentQty": newTotalQty,
        "totals.loaded": newLoadedQty,
        "totals.pending": newPendingQty,
        "totals.received": newReceivedQty,
        "totals.delivered": newReceivedQty,

        statusHistory: FieldValue.arrayUnion({
          status: derivedShipmentStatus,
          at: new Date(),
          by: name,
          note: remarks || `Status updated via ${sourceUI}`,
          location: location || null,
        }),
        ...(checkerPromotedOutForDelivery
          ? {
              currentLocationState: "OUT_FOR_DELIVERY",
            }
          : {}),
        ...(derivedShipmentStatus === "COMPLETED"
          ? {
              availableForDelivery: false,
              currentLocationState: "DELIVERED",
              completedAt: FieldValue.serverTimestamp(),
            }
          : {}),
      };

      tx.update(shipmentRef, shipmentUpdate);

      resultStatus = derivedShipmentStatus;

      if (derivedShipmentStatus === "COMPLETED") {
        const manifestId = String(currentData.deliveryManifestId || "").trim();
        if (manifestId) {
          tx.set(
            db.collection("delivery_manifests").doc(manifestId),
            {
              status: "COMPLETED",
              completedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
              updatedBy: name,
            },
            { merge: true },
          );
        }
      }

      if (checkerPromotedOutForDelivery) {
        const manifestId = currentData.deliveryManifestId;
        if (manifestId) {
          tx.set(
            db.collection("delivery_manifests").doc(String(manifestId)),
            {
              status: "OUT_FOR_DELIVERY",
              outForDeliveryAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
              updatedBy: name,
            },
            { merge: true },
          );
        }
      }

      if (tripRef && tripShipmentRef && tripShipSnap && tripShipSnap.exists) {
        const tripUpdate = {
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: name,
        };

        const oldLoadedDelta = oldLoadedQty;
        const newLoadedDelta = newLoadedQty;

        const oldReceivedDelta = oldReceivedQty;
        const newReceivedDelta = newReceivedQty;

        const oldPendingQty = Math.max(oldTotalQty - oldLoadedQty, 0);
        const deltaLoaded = newLoadedDelta - oldLoadedDelta;
        const deltaReceived = newReceivedDelta - oldReceivedDelta;
        const deltaPending = newPendingQty - oldPendingQty;

        if (deltaLoaded !== 0) {
          tripUpdate.totalLoaded = FieldValue.increment(deltaLoaded);
        }

        if (deltaReceived !== 0) {
          tripUpdate.totalArrived = FieldValue.increment(deltaReceived);
          tripUpdate.totalDelivered = FieldValue.increment(deltaReceived);
        }

        if (deltaPending !== 0) {
          tripUpdate.itemPending = FieldValue.increment(deltaPending);
        }

        if (newStatus === "MISSING") {
          tripUpdate.totalExceptions = FieldValue.increment(newTotalQty);
        }

        completedTripId = tripId;
        tx.update(tripRef, tripUpdate);

        tx.update(tripShipmentRef, {
          status: derivedShipmentStatus,
          totalItems: newTotalQty,
          loadedCount: newLoadedQty,
          pendingCount: newPendingQty,
          deliveredCount: newReceivedQty,
          receivedCount: newReceivedQty,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: name,
        });
      }

      writeShipmentActionLog({
        db,
        tx,
        collection: "audit_logs",
        action: `${sourceUI}_UPDATE_${newStatus}`,
        targetId: shipmentId,
        shipmentId,
        actorId: uid,
        actorName: name,
        actorRole: role,
        details: {
          oldStatus,
          newStatus,
          quantity: newTotalQty,
          rowCount,
          tripId: tripId || "N/A",
        },
        timestamp: FieldValue.serverTimestamp(),
      });

      return buildShipmentNotificationPlan({
        shipment: currentData,
        oldStatus,
        newStatus: derivedShipmentStatus,
        notify,
        notificationChannels,
        notifySms,
        notifyEmail,
        notifyPush,
        sourceUI,
        tripId,
      });
    });

    if (completedTripId) {
      try {
        await tryAutoCompleteTrip(completedTripId, {
          actorId: uid,
          actorName: name,
          actorRole: role,
          source: "UPDATE_SHIPMENT_STATUS",
        });
      } catch (autoCompleteError) {
        console.error("Auto-complete trip failed:", autoCompleteError);
      }
    }

    if (checkerPromotedOutForDelivery) {
      await writeShipmentEvent({
        db,
        event: {
          shipmentId,
          eventType: EVENT_TYPES.OUT_FOR_DELIVERY,
          checkerId: uid,
          checkerName: name,
          location: location || null,
          remarks: remarks || "Checker marked shipment out for delivery.",
          createdBy: uid,
          createdByRole: role,
          source: sourceUI || "CHECKER_MOBILE",
        },
      });
    }

    if (isCheckerPieceDelivery && checkerDeliveredPieceIds.length > 0) {
      await Promise.all(
        checkerDeliveredPieceIds.map((pieceId) =>
          writeShipmentEvent({
            db,
            event: {
              shipmentId,
              pieceId,
              eventType: EVENT_TYPES.DELIVERED,
              checkerId: uid,
              checkerName: name,
              location: location || null,
              proofPhotoUrl: Array.isArray(proofOfDelivery)
                ? proofOfDelivery[0] || null
                : proofOfDelivery || null,
              remarks:
                remarks ||
                `Delivered by checker (${checkerDeliveredPieceIds.length} piece${
                  checkerDeliveredPieceIds.length === 1 ? "" : "s"
                }).`,
              createdBy: uid,
              createdByRole: role,
              source: sourceUI || "CHECKER_MOBILE",
            },
          }),
        ),
      );
    }

    if (actor.role === "driver" && isFinalDeliveryStatus) {
      await writeShipmentEvent({
        db,
        event: {
          shipmentId,
          eventType: EVENT_TYPES.DELIVERED,
          driverId: uid,
          driverName: name,
          location: location || null,
          gpsCoordinates: gpsCoordinates || null,
          proofPhotoUrl: Array.isArray(proofOfDelivery) ? proofOfDelivery[0] || null : proofOfDelivery || null,
          remarks: remarks || `Delivered to ${String(receiverName || "receiver").trim()}.`,
          createdBy: uid,
          createdByRole: role,
          source: sourceUI || "DRIVER_MOBILE",
        },
      });
    }

    let notificationDelivered = false;

    if (notificationPlan) {
      try {
        await sendShipmentCustomerNotification({
          db,
          shipment: updatedShipmentData || {},
          shipmentId,
          notificationType: notificationPlan.notificationType,
          channels: notificationPlan.channels,
          tripId: notificationPlan.tripId,
          actor: { uid, name, role },
          source: sourceUI || "SHIPMENT_STATUS",
        });
        notificationDelivered = true;
      } catch (notificationError) {
        console.error(
          "[updateShipmentStatus] Customer notification failed:",
          notificationError,
        );
      }
    } else if (
      checkerPromotedOutForDelivery &&
      !shipmentWasOutForDelivery &&
      newStatus === "OUT_FOR_DELIVERY"
    ) {
      try {
        const freshSnap = await shipmentRef.get();
        const freshShipment = freshSnap.exists ? freshSnap.data() || {} : {};
        await sendAutomaticShipmentLifecycleNotification({
          db,
          shipment: freshShipment,
          shipmentId,
          tripId:
            tripId ||
            freshShipment.currentTripId ||
            freshShipment.currentTruckTripId ||
            null,
          notificationType: CUSTOMER_NOTIFICATION_TYPES.OUT_FOR_DELIVERY,
          source: "CHECKER_OUT_FOR_DELIVERY",
          channels: { sms: true, email: false, push: true },
          actor: { uid, name, role },
        });
        notificationDelivered = true;
      } catch (notificationError) {
        console.error(
          "[updateShipmentStatus] Automatic out-for-delivery notification failed:",
          notificationError,
        );
      }
    } else if (
      !shipmentWasDelivered &&
      wasShipmentDelivered(resultStatus)
    ) {
      try {
        const freshSnap = await shipmentRef.get();
        const freshShipment = freshSnap.exists ? freshSnap.data() || {} : {};
        await sendAutomaticShipmentLifecycleNotification({
          db,
          shipment: freshShipment,
          shipmentId,
          tripId:
            tripId ||
            freshShipment.currentTripId ||
            freshShipment.currentTruckTripId ||
            null,
          notificationType: CUSTOMER_NOTIFICATION_TYPES.DELIVERED,
          source: "SHIPMENT_DELIVERED",
          channels: { sms: true, email: false, push: true },
          actor: { uid, name, role },
        });
        notificationDelivered = true;
      } catch (notificationError) {
        console.error(
          "[updateShipmentStatus] Automatic delivered notification failed:",
          notificationError,
        );
      }
    }

    return {
      success: true,
      status: resultStatus,
      deliveredPieceIds: checkerDeliveredPieceIds,
      notificationQueued: notificationDelivered,
    };
  },
);
