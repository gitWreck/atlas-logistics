const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { sendShipmentPickup } = require("../messaging/sendShipmentPickup");
const {
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
} = require("../../shared/sms-service");
const { Timestamp } = admin.firestore;

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

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
  return [
    address.unit,
    address.street,
    address.barangay,
    address.city,
    address.province,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
}

function getPublicUserId(user = {}, fallback = null) {
  return (
    user.userId ||
    user.publicId ||
    user.userCode ||
    user.driverCode ||
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

exports.requestShipmentPickup = onCall(
  {
    region: "asia-southeast1",
    secrets: [SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME],
    maxInstances: 10,
  },
  async (request) => {
    // 1. AUTH & VALIDATION
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Login required to request pickup.",
      );
    }

    const {
      sender,
      recipient,
      items,
      remarks,
      location, // ✅ Extract the passed location {lat, lng}
      notifySms = true, // Default to true for customer peace of mind
    } = request.data || {};

    if (!sender || !recipient) {
      throw new HttpsError(
        "invalid-argument",
        "Missing sender or recipient details.",
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "Items array is empty or invalid.",
      );
    }

    if (items.length > 200) {
      throw new HttpsError(
        "invalid-argument",
        "Too many items. Max 200 per request.",
      );
    }

    // 2. STATUS & CODES (Hardcoded for Customer Pickup Requests)
    const initialStatus = "PENDING_PICKUP";
    const initialNote = "Requested for Pickup by Customer";
    const uid = request.auth.uid;
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const senderAddress = normalizeAddress(sender);
    const recipientAddress = normalizeAddress(recipient);
    const senderPhone = normalizePhone(sender.phone || userData.phoneNumber);
    const recipientPhone = normalizePhone(recipient.phone);
    const recipientCustomer = await findCustomerByPhone(recipientPhone);
    const recipientUid = recipient.uid || recipientCustomer?.uid || null;
    const shipmentVisibilityUserIds = [
      ...new Set([uid, recipientUid].filter(Boolean).map(String)),
    ];

    const originCity = senderAddress.city || "Unknown";
    const destCity = recipientAddress.city || "Unknown";
    const originSummary = `${originCity}, ${senderAddress.province || ""}`;

    // Default to GEN since customers don't know routing codes
    const finalOriginCode = "GEN";
    const finalDestCode = "GEN";

    // 3. ID GENERATION
    const timestamp = new Date();
    const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, "");
    const shipmentId = `AT-${dateStr}-SHP-${Date.now().toString().slice(-6)}`;

    const shipmentRef = db.collection("shipments").doc(shipmentId);

    // 4. COMBINED PACKAGING LOGIC (Standard vs Bundle)
    const packagesArray = [];
    const packageBarcodes = [];
    let globalSeq = 1;
    let totalContentQuantity = 0;

    items.forEach((item) => {
      const qty = Number(item.quantity || item.weight) || 1; // Fallback to weight if qty isn't passed
      const pkgType = item.packagingType || item.packaging || "Box";

      totalContentQuantity += qty;

      // Determine if this item should be bundled or split
      const isBundle = pkgType === "Sack" || pkgType === "Bundle";

      if (isBundle) {
        // BUNDLE LOGIC: 1 Physical Barcode, Internal Quantity = QTY
        const seqNum = globalSeq.toString().padStart(2, "0");
        const pkgId = `${shipmentId}-${seqNum}`;

        packagesArray.push({
          packageId: pkgId,
          trackingNumber: pkgId,
          sequence: globalSeq,
          description: item.description || "Bundled Cargo",
          quantity: qty, // Stores internal piece count
          packagingGroup: "BULK",
          packagingType: pkgType,
          declaredValue: Number(item.declaredValue) || 0,
          isFragile: Boolean(item.isFragile),
          isPerishable: Boolean(item.isPerishable),
          status: initialStatus,
          currentLocation: originSummary,
          loadedOnTrip: null,
          isDelayed: false,
          updatedAt: new Date().toISOString(),
          updatedBy: uid,
        });

        packageBarcodes.push(pkgId);
        globalSeq++;
      } else {
        // STANDARD LOGIC: 'QTY' Physical Barcodes, Internal Quantity = 1 per box
        for (let i = 0; i < qty; i++) {
          const seqNum = globalSeq.toString().padStart(2, "0");
          const pkgId = `${shipmentId}-${seqNum}`;

          packagesArray.push({
            packageId: pkgId,
            trackingNumber: pkgId,
            sequence: globalSeq,
            description: item.description || "Standard Package",
            quantity: 1, // 1 unit per physical box
            packagingGroup: "SINGLE",
            packagingType: pkgType,
            declaredValue: (Number(item.declaredValue) || 0) / qty, // Split value evenly
            isFragile: Boolean(item.isFragile),
            isPerishable: Boolean(item.isPerishable),
            status: initialStatus,
            currentLocation: originSummary,
            loadedOnTrip: null,
            isDelayed: false,
            updatedAt: new Date().toISOString(),
            updatedBy: uid,
          });

          packageBarcodes.push(pkgId);
          globalSeq++;
        }
      }
    });

    const now = Timestamp.now();
    const nowAt = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();

    // 5. CREATE SHIPMENT (Parent Document)
    batch.set(shipmentRef, {
      shipmentId,
      trackingNumber: shipmentId,
      currentTripId: null,
      currentTruckTripId: null,
      visibilityUserIds: shipmentVisibilityUserIds,
      createdSource: "mobile_pickup",

      sender: {
        uid,
        userId: getPublicUserId(sender, getPublicUserId(userData)),
        name: sender.name || userData.name || "",
        phone: senderPhone,
        address: senderAddress,
        formattedAddress: formatAddress(senderAddress),
      },
      recipient: {
        uid: recipientUid,
        userId: getPublicUserId(
          recipient,
          getPublicUserId(recipientCustomer),
        ),
        name: recipient.name || "",
        phone: recipientPhone,
        address: recipientAddress,
        formattedAddress: formatAddress(recipientAddress),
      },

      origin: originCity,
      originCode: finalOriginCode,
      destination: destCity,
      destinationCode: finalDestCode,

      createdAt: nowAt,
      updatedAt: nowAt,
      createdBy: uid,
      updatedBy: uid,

      status: initialStatus,
      statusHistory: [
        {
          status: initialStatus,
          at: now,
          note: initialNote,
          location: location ? location : originSummary,
        },
      ],
      ...(location ? { lastLocation: location } : {}),
      public: true,
      archived: false,
      isPickupRequested: true, // Flag specifically for operations dashboard

      // AGGREGATES
      totals: {
        totalItems: packagesArray.length, // Total physical barcodes to scan
        totalContentQty: totalContentQuantity, // Total items inside
        received: 0,
        pending: packagesArray.length,
        loaded: 0,
        delivered: 0,
      },

      remarks: remarks || null,
      packages: packagesArray,
      packageBarcodes: packageBarcodes,
    });

    // 7. AUDIT LOGGING
    batch.set(db.collection("admin_logs").doc(), {
      action: "CUSTOMER_REQUESTED_PICKUP",
      trackingShipmentId: shipmentRef.id,
      shipmentId: shipmentId,
      totalUnits: packagesArray.length,
      actorId: uid,
      createdAt: nowAt,
    });

    // 8. COMMIT & NOTIFY
    try {
      await batch.commit();

      if (notifySms) {
        sendShipmentPickup({
          shipmentId,
          senderPhone,
          recipientPhone,
          actorUid: uid,
        }).catch((err) => console.error("[SMS_ERROR]", err));
      }

      return { success: true, shipmentId, packageBarcodes };
    } catch (error) {
      console.error("Transaction failure:", error);
      throw new HttpsError("internal", "Failed to submit pickup request.");
    }
  },
);
