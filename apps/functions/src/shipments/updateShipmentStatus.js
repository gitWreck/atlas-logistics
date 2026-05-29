"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { chunk, requireRole, unique, updatedBy } = require("../utilities/helpers");
const { ALLOWED_SHIPMENT_STATUSES } = require("../utilities/dataDetails");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const { getShipmentTargetUserIds } = require("../utilities/notificationHelpers");
const { normalizeQty } = require("../utilities/packageHelpers");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

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

    const { uid, role, name } = updatedBy(req);

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

      if (oldStatus === newStatus) {
        return null;
      }

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

      const updatedPackages = oldPackages.map((pkg) => {
        const quantity = normalizeQty(pkg.quantity, 1);
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
        } else if (isFinalDeliveryStatus) {
          nextPkg.loadedQty = quantity;
          nextPkg.receivedQty = quantity;
          nextPkg.deliveredAt = new Date().toISOString();
        } else if (newStatus === "MISSING") {
          nextPkg.loadedQty = 0;
        }

        return nextPkg;
      });

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
        newLoadedQty = newTotalQty;
        newReceivedQty = newTotalQty;
      } else if (newStatus === "MISSING") {
        newLoadedQty = 0;
      }

      const newPendingQty = Math.max(newTotalQty - newLoadedQty, 0);

      const shipmentUpdate = {
        status: newStatus,
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
          status: newStatus,
          at: new Date(),
          by: name,
          note: remarks || `Status updated via ${sourceUI}`,
          location: location || null,
        }),
      };

      tx.update(shipmentRef, shipmentUpdate);

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
          status: newStatus,
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
        newStatus,
        actor: { uid, role, name },
        notificationChannels,
        notifySms,
        notifyEmail,
        notifyPush,
        notify,
      });
    });

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
      status: newStatus,
      notificationQueued: Boolean(notificationEvent),
    };
  },
);
