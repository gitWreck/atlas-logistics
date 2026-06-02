"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { requireRole, updatedBy } = require("../utilities/helpers");
const { ALLOWED_SHIPMENT_STATUSES } = require("../utilities/dataDetails");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const { deriveMasterShipmentStatus } = require("../packages/shipmentStatus");
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

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function chunk(values, size = 30) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function formatStatusLabel(status = "") {
  return String(status || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function getTrackedShipmentUserIds(shipmentId) {
  const trackingNumber = String(shipmentId || "")
    .trim()
    .toUpperCase();

  if (!trackingNumber) return [];

  const trackedUserIds = [];

  try {
    await Promise.all(
      chunk([trackingNumber]).map(async (trackingChunk) => {
        const trackedSnap = await db
          .collectionGroup("tracked_shipments")
          .where("trackingNumber", "in", trackingChunk)
          .get();

        trackedSnap.docs.forEach((doc) => {
          const userRef = doc.ref.parent.parent;
          if (userRef?.id) trackedUserIds.push(userRef.id);
        });
      }),
    );
  } catch (error) {
    if (error?.code === 9 || error?.code === "failed-precondition") {
      console.warn(
        "[updateShipmentStatus] Skipping tracked shipment notification lookup. Firestore collection-group index may still be missing/building.",
        error?.message || error,
      );
      return [];
    }

    throw error;
  }

  return unique(trackedUserIds);
}

function getShipmentTargetUserIds(shipment = {}) {
  return unique([
    ...(Array.isArray(shipment.visibilityUserIds)
      ? shipment.visibilityUserIds
      : []),
    shipment.customerId,
    shipment.senderUid,
    shipment.recipientUid,
    shipment.sender?.uid,
    shipment.recipient?.uid,
  ]);
}

function buildStatusNotificationEvent({
  shipment,
  shipmentId,
  oldStatus,
  newStatus,
  actor,
  notificationChannels,
  notifySms,
  notifyEmail,
  notifyPush,
  notify,
}) {
  if (notify === false) return null;

  const requestedChannels =
    notificationChannels && typeof notificationChannels === "object"
      ? notificationChannels
      : null;

  const channels = requestedChannels
    ? {
        sms: requestedChannels.sms === true,
        email: requestedChannels.email === true,
        push: requestedChannels.push === true,
        inApp:
          requestedChannels.inApp === true || requestedChannels.push === true,
      }
    : {
        sms: notifySms !== false,
        email: notifyEmail === true,
        push: notifyPush !== false,
        inApp: true,
      };

  const targetUserIds = getShipmentTargetUserIds(shipment);
  const statusLabel = formatStatusLabel(newStatus);
  const title = "Shipment status updated";
  const body = `Shipment ${shipmentId} is now ${statusLabel}.`;
  const smsBody = `ATLAS: Shipment ${shipmentId} is now ${statusLabel}. Track: https://atlastransport.ph/track/${shipmentId}`;

  if (
    !channels.sms &&
    !channels.email &&
    !channels.push &&
    (!channels.inApp || targetUserIds.length === 0)
  ) {
    return null;
  }

  return {
    type: "SHIPMENT_STATUS_UPDATED",
    status: "pending",
    channels: {
      sms: channels.sms,
      email: channels.email,
      push: channels.push,
      inApp: channels.inApp && targetUserIds.length > 0,
    },
    entityType: "shipment",
    entityId: shipmentId,
    shipmentId,
    targetUserIds,
    targets: {
      sender: {
        uid: shipment.sender?.uid || shipment.senderUid || null,
        name: shipment.sender?.name || shipment.senderName || "",
        phone: shipment.sender?.phone || shipment.senderPhone || null,
        email: shipment.sender?.email || shipment.senderEmail || null,
      },
      recipient: {
        uid: shipment.recipient?.uid || shipment.recipientUid || null,
        name: shipment.recipient?.name || shipment.recipientName || "",
        phone:
          shipment.recipient?.phone ||
          shipment.recipientPhone ||
          shipment.consigneePhone ||
          shipment.customerPhone ||
          null,
        email: shipment.recipient?.email || shipment.recipientEmail || null,
      },
    },
    title,
    body,
    smsBody,
    data: {
      screen: "tracking",
      trackingId: shipmentId,
      status: newStatus,
      oldStatus,
      origin: shipment.origin || shipment.sender?.address?.city || null,
      destination:
        shipment.destination || shipment.recipient?.address?.city || null,
    },
    actor: {
      uid: actor.uid,
      name: actor.name,
      role: actor.role,
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

exports.updateShipmentStatus = onCall(
  { region: "asia-southeast1", maxInstances: 10 },
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

    const { uid, role, name, usercode } = updatedBy(req);
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
      notify = true,
      notifySms,
      notifyEmail,
      notifyPush,
      notificationChannels = null,
      sourceUI = "SYSTEM",
      packageIds = null,
    } = req.data || {};

    if (!shipmentId || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing shipmentId or status.");
    }

    if (!ALLOWED_SHIPMENT_STATUSES.includes(newStatus)) {
      throw new HttpsError("invalid-argument", `Invalid status: ${newStatus}`);
    }

    const isFinalDeliveryStatus =
      newStatus === "DELIVERED" || newStatus === "COMPLETED";

    if (actor.role === "driver" && (isFinalDeliveryStatus || proofOfDelivery)) {
      throw new HttpsError(
        "permission-denied",
        "Drivers cannot complete delivery or upload proof of delivery.",
      );
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const tripRef = tripId ? db.collection("truck_trips").doc(tripId) : null;
    const tripShipmentRef = tripRef
      ? tripRef.collection("trip_shipments").doc(shipmentId)
      : null;

    let checkerPromotedOutForDelivery = false;
    let checkerDeliveredPieceIds = [];
    let resultStatus = newStatus;

    const packageIdSet = normalizePackageIdSet(packageIds);
    const isCheckerPieceDelivery =
      isFinalDeliveryStatus && actor.role === "checker";

    const notificationEvent = await db.runTransaction(async (tx) => {
      const shipmentSnap = await tx.get(shipmentRef);

      if (!shipmentSnap.exists) {
        throw new HttpsError("not-found", "Shipment not found.");
      }

      let tripShipSnap = null;
      if (tripShipmentRef) {
        tripShipSnap = await tx.get(tripShipmentRef);
      }

      const currentData = shipmentSnap.data() || {};
      const oldStatus = currentData.status || null;
      const currentPackages = Array.isArray(currentData.packages)
        ? currentData.packages
        : [];

      if (oldStatus === newStatus && !isCheckerPieceDelivery) {
        return null;
      }

      const normalizeQty = (value, fallback = 0) => {
        const num = Number(value);
        return Number.isFinite(num) && num >= 0 ? num : fallback;
      };

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
        if (loadedBy && (loadedBy === checkerUid || (legacyUserCode && loadedBy === legacyUserCode))) {
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
        return ["LOADED", "READY_FOR_DELIVERY", "PARTIALLY_LOADED"].includes(
          status,
        );
      };

      if (newStatus === "OUT_FOR_DELIVERY" && actor.role === "checker") {
        const promotableCount = oldPackages.filter(
          (pkg) =>
            isCheckerOwnedPiece(pkg) &&
            canPromotePieceToOutForDelivery(pkg),
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
          if (
            String(pkg.status || "").toUpperCase() === "OUT_FOR_DELIVERY"
          ) {
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

      const derivedShipmentStatus =
        (newStatus === "OUT_FOR_DELIVERY" && actor.role === "checker") ||
        isCheckerPieceDelivery
          ? deriveMasterShipmentStatus(updatedPackages, {
              previousStatus: oldStatus,
              totals: {
                totalQty: newTotalQty,
                receivedQty: newReceivedQty,
                loadedQty: newLoadedQty,
              },
            })
          : newStatus;

      const shipmentUpdate = {
        status: derivedShipmentStatus,
        packages: updatedPackages,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: name,
        remarks: remarks || null,

        ...(location && { lastLocation: location }),
        ...(proofOfDelivery && { proofOfDelivery }),
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
      };

      tx.update(shipmentRef, shipmentUpdate);

      resultStatus = derivedShipmentStatus;

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

      return buildStatusNotificationEvent({
        shipment: currentData,
        shipmentId,
        oldStatus,
        newStatus: derivedShipmentStatus,
        actor: { uid, role, name },
        notificationChannels,
        notifySms,
        notifyEmail,
        notifyPush,
        notify,
      });
    });

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

    if (notificationEvent) {
      const trackedUserIds = await getTrackedShipmentUserIds(shipmentId);
      notificationEvent.targetUserIds = unique([
        ...(notificationEvent.targetUserIds || []),
        ...trackedUserIds,
      ]);
      if (notificationEvent.channels?.push === true) {
        notificationEvent.channels.inApp =
          notificationEvent.targetUserIds.length > 0;
      }

      await db.collection("notification_events").doc().set(notificationEvent);
    }

    return {
      success: true,
      status: resultStatus,
      deliveredPieceIds: checkerDeliveredPieceIds,
      notificationQueued: Boolean(notificationEvent),
    };
  },
);
