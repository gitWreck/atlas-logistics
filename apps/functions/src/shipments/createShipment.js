const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { writeShipmentActionLog } = require("../utilities/shipmentLogger");
const { updatedBy } = require("../utilities/helpers");

const { Timestamp } = admin.firestore;

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

function normalizeAddress(address = {}) {
  return {
    unit: address.unit || "",
    street: address.street || "",
    barangay: address.barangay || "",
    city: address.city || "",
    province: address.province || "",
  };
}

function formatAddress(address = {}) {
  const parts = [
    address.unit,
    address.street,
    address.barangay,
    address.city,
    address.province,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  return parts.join(", ");
}

function normalizePhone(value = "") {
  const digits = String(value || "").replace(/[^\d]/g, "");
  if (digits.length === 11 && digits.startsWith("0")) {
    return `63${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith("9")) {
    return `63${digits}`;
  }
  return digits;
}

function phoneVariants(value = "") {
  const normalized = normalizePhone(value);
  const variants = new Set();
  if (normalized) variants.add(normalized);
  if (normalized.startsWith("63") && normalized.length === 12) {
    variants.add(`0${normalized.slice(2)}`);
  }
  return [...variants].slice(0, 10);
}

function getPublicUserId(user = {}, fallback = null) {
  return (
    user?.userId ||
    user?.publicId ||
    user?.userCode ||
    user?.driverCode ||
    fallback ||
    null
  );
}

async function findCustomerByPhone(phone) {
  const variants = phoneVariants(phone);
  if (!variants.length) return null;

  const snap = await db
    .collection("users")
    .where("phoneNumber", "in", variants)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const userDoc = snap.docs[0];
  const data = userDoc.data() || {};
  if (data.role && data.role !== "customer") return null;

  return { uid: userDoc.id, ...data };
}

function isBundlePackaging(packagingGroup) {
  const value = String(packagingGroup || "")
    .trim()
    .toUpperCase();
  return value === "BULK";
}

function shouldUseBundleMode(items = []) {
  return items.some((item) => isBundlePackaging(item?.packagingGroup));
}

function buildPackages({
  items,
  shipmentId,
  initialStatus,
  currentLocation,
  originSummary,
  actorUid,
  bundleMode,
  name,
}) {
  const packagesArray = [];
  const packageBarcodes = [];

  let totalContentQuantity = 0;
  let globalSeq = 1;

  items.forEach((item, itemIndex) => {
    const qty = Number(item.quantity) || 1;
    totalContentQuantity += qty;

    if (bundleMode) {
      const seqNum = String(itemIndex + 1).padStart(2, "0");
      const pkgId = `${shipmentId}-${seqNum}`;

      packagesArray.push({
        packageId: pkgId,
        trackingNumber: pkgId,
        sequence: itemIndex + 1,
        description: item.description || "Bundled Cargo",
        quantity: qty,
        packagingGroup: item.packagingGroup || "BULK",
        packagingType: item.packagingType || "Sack",
        declaredValue: Number(item.declaredValue) || 0,
        isFragile: Boolean(item.isFragile),
        isPerishable: Boolean(item.isPerishable),
        status: initialStatus,
        currentLocation: currentLocation || originSummary,
        loadedOnTrip: null,
        loadedAt: null,
        isDelayed: false,
        updatedAt: new Date().toISOString(),
        updatedBy: name,
      });

      packageBarcodes.push(pkgId);
      return;
    }

    for (let i = 0; i < qty; i++) {
      const seqNum = String(globalSeq).padStart(2, "0");
      const pkgId = `${shipmentId}-${seqNum}`;

      packagesArray.push({
        packageId: pkgId,
        trackingNumber: pkgId,
        sequence: globalSeq,
        description: item.description || "Standard Package",
        quantity: 1,
        packagingGroup: item.packagingGroup || "SINGLE",
        packagingType: item.packagingType || "Box",
        declaredValue: (Number(item.declaredValue) || 0) / qty,
        isFragile: Boolean(item.isFragile),
        isPerishable: Boolean(item.isPerishable),
        status: initialStatus,
        currentLocation: currentLocation || originSummary,
        loadedOnTrip: null,
        loadedAt: null,
        isDelayed: false,
        updatedAt: new Date().toISOString(),
        updatedBy: name,
      });

      packageBarcodes.push(pkgId);
      globalSeq += 1;
    }
  });

  return {
    packagesArray,
    packageBarcodes,
    totalContentQuantity,
  };
}

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
      findCustomerByPhone(senderPhone),
      findCustomerByPhone(recipientPhone),
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
        actorUid: request.auth.uid,
        bundleMode,
        name,
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
      currentTruckTripId: null,
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
