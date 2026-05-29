const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const { updatedBy } = require("../utilities/helpers");
const {
  normalizeAddress,
  formatAddress,
} = require("../utilities/addressHelpers");
const {
  findCustomerByPhone,
  getPublicUserId,
} = require("../utilities/customerHelpers");
const { normalizePhone } = require("../utilities/phoneHelpers");
const {
  buildPackages,
  shouldUseBundleMode,
} = require("../utilities/packageHelpers");

const { Timestamp } = admin.firestore;

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

exports.createShipment = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const {
      sender,
      recipient,
      origin,
      destination,
      originCode,
      destinationCode,
      items,
      remarks,
      location,
      notifySms,
      notifyEmail,
      notifyPush,
      notificationChannels = null,
      manualShipmentId,
      proofOfReceipt = [],
      status,
      currentLocation = null,
      customerId = null,
      visibilityUserIds = [],
    } = request.data || {};

    const { uid, role, name } = updatedBy(request);

    if (!origin || !destination) {
      throw new HttpsError(
        "invalid-argument",
        "Missing origin or destination.",
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new HttpsError("invalid-argument", "Items array is invalid.");
    }

    if (items.length > 200) {
      throw new HttpsError(
        "invalid-argument",
        "Too many items. Max 200 per shipment.",
      );
    }

    const initialStatus = status === "PENDING_PICKUP" ? status : "RECEIVED";
    const initialNote =
      status === "PENDING_PICKUP"
        ? "Scheduled for Pickup"
        : "Dropped off at Hub";

    const senderAddress = normalizeAddress(sender?.address);
    const recipientAddress = normalizeAddress(recipient?.address);
    const senderPhone = normalizePhone(sender?.phone);
    const recipientPhone = normalizePhone(recipient?.phone);
    const [senderCustomer, recipientCustomer] = await Promise.all([
      findCustomerByPhone(db, senderPhone),
      findCustomerByPhone(db, recipientPhone),
    ]);

    const senderUid = sender?.uid || senderCustomer?.uid || null;
    const recipientUid = recipient?.uid || recipientCustomer?.uid || null;
    const primaryCustomerId = customerId || senderUid || recipientUid || null;
    const requestedVisibilityUserIds = Array.isArray(visibilityUserIds)
      ? visibilityUserIds
      : [];
    const shipmentVisibilityUserIds = [
      ...new Set(
        [
          primaryCustomerId,
          senderUid,
          recipientUid,
          ...requestedVisibilityUserIds,
        ]
          .filter(Boolean)
          .map(String),
      ),
    ];

    const originSummary = `${senderAddress.city}, ${senderAddress.province}`;
    const finalOriginCode = originCode || "GEN";
    const finalDestCode = destinationCode || "GEN";

    const timestamp = new Date();
    let shipmentId = manualShipmentId;

    if (!shipmentId) {
      const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, "");
      shipmentId = `AT-${dateStr}-SHP-${Date.now().toString().slice(-6)}`;
    }

    const existingDoc = await db.collection("shipments").doc(shipmentId).get();
    if (existingDoc.exists) {
      throw new HttpsError(
        "already-exists",
        "Shipment ID collision. Try again.",
      );
    }

    const bundleMode = shouldUseBundleMode(items);

    const { packagesArray, packageBarcodes, totalContentQuantity } =
      buildPackages({
        items,
        shipmentId,
        initialStatus,
        currentLocation,
        originSummary,
        bundleMode,
        updatedBy: name,
      });

    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const now = Timestamp.now();
    const nowAt = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();
    const requestedChannels =
      notificationChannels && typeof notificationChannels === "object"
        ? notificationChannels
        : {};
    const notificationChannelsToSend = {
      sms: requestedChannels.sms === true || notifySms === true,
      email: requestedChannels.email === true || notifyEmail === true,
      push: requestedChannels.push === true || notifyPush === true,
    };
    const shouldCreateNotificationEvent = Object.values(
      notificationChannelsToSend,
    ).some(Boolean);

    batch.set(shipmentRef, {
      shipmentId: shipmentId,
      trackingNumber: shipmentId,
      currentTripId: null,
      visibilityUserIds: shipmentVisibilityUserIds,
      createdSource: "web",

      sender: {
        uid: senderUid,
        userId: getPublicUserId(sender, getPublicUserId(senderCustomer)),
        name: sender?.name || "",
        phone: senderPhone,
        address: senderAddress,
        formattedAddress: formatAddress(senderAddress),
      },

      recipient: {
        uid: recipientUid,
        userId: getPublicUserId(recipient, getPublicUserId(recipientCustomer)),
        name: recipient?.name || "",
        phone: recipientPhone,
        address: recipientAddress,
        formattedAddress: formatAddress(recipientAddress),
      },

      origin: senderAddress.city || origin,
      originCode: finalOriginCode,
      destination: recipientAddress.city || destination,
      destinationCode: finalDestCode,

      createdAt: nowAt,
      updatedAt: nowAt,
      createdBy: name,
      updatedBy: name,

      status: initialStatus,
      statusHistory: [
        {
          status: initialStatus,
          at: now,
          note: initialNote,
          location: location || null,
        },
      ],

      ...(location ? { lastLocation: location } : {}),

      public: true,
      archived: false,
      delayCleared: true,

      // shipmentMode: bundleMode ? "BUNDLE" : "PACKAGE",

      totals: {
        totalItems: packagesArray.length,
        totalContentQty: totalContentQuantity,
        received: packagesArray.length,
        pending: packagesArray.length,
        loaded: 0,
        delivered: 0,
      },
      remarks: remarks || null,
      proofOfReceipt,
      packages: packagesArray,
      packageBarcodes,
    });

    writeShipmentActionLog({
      db,
      batch,
      action: bundleMode ? "CREATE_SHIPMENT_BULK" : "CREATE_SHIPMENT",
      trackingShipmentId: shipmentRef.id,
      shipmentId: shipmentId,
      totalItems: packagesArray.length,
      totalContentQty: totalContentQuantity,
      originCode: finalOriginCode,
      destinationCode: finalDestCode,
      shipmentMode: bundleMode ? "BULK" : "SINGLE",
      actorId: uid,
      actorName: name,
      actorRole: role,
      createdAt: nowAt,
    });

    if (shouldCreateNotificationEvent) {
      const notificationRef = db.collection("notification_events").doc();
      const targetUserIds = [
        ...new Set([senderUid, recipientUid].filter(Boolean).map(String)),
      ];

      batch.set(notificationRef, {
        type: "SHIPMENT_CREATED",
        status: "pending",
        channels: {
          ...notificationChannelsToSend,
          inApp: targetUserIds.length > 0,
        },
        entityType: "shipment",
        entityId: shipmentId,
        shipmentId,
        targetUserIds,
        targets: {
          sender: {
            uid: senderUid,
            name: sender?.name || "",
            phone: senderPhone,
            email: sender?.email || senderCustomer?.email || null,
          },
          recipient: {
            uid: recipientUid,
            name: recipient?.name || "",
            phone: recipientPhone,
            email: recipient?.email || recipientCustomer?.email || null,
          },
        },
        title: "Shipment created",
        body: `Your shipment ${shipmentId} has been created.`,
        data: {
          screen: "tracking",
          trackingId: shipmentId,
          status: initialStatus,
          origin,
          destination,
        },
        actor: {
          uid,
          name,
          role,
        },
        createdAt: nowAt,
        updatedAt: nowAt,
      });
    }

    try {
      await batch.commit();

      return {
        success: true,
        shipmentId,
        packageBarcodes,
        shipmentMode: bundleMode ? "BUNDLE" : "PACKAGE",
      };
    } catch (error) {
      console.error("Transaction failure:", error);
      throw new HttpsError("internal", "Failed to create shipment records.");
    }
  },
);
