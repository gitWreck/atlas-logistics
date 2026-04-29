const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { Timestamp } = admin.firestore;

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const ALLOWED_STATUSES = new Set(["DRAFT", "ISSUED"]);

exports.createInvoice = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const uid = request.auth.uid;

    const {
      shipmentId,
      invoiceDate,
      dueDate,
      billingName,
      billingAddress,
      amount,
      notes,
      status,
    } = request.data || {};

    if (!shipmentId) {
      throw new HttpsError("invalid-argument", "Missing shipmentId.");
    }

    if (!billingName) {
      throw new HttpsError("invalid-argument", "Missing billingName.");
    }

    if (amount === undefined || isNaN(Number(amount))) {
      throw new HttpsError("invalid-argument", "Invalid amount.");
    }

    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const shipmentDoc = await shipmentRef.get();

    if (!shipmentDoc.exists) {
      throw new HttpsError("not-found", "Shipment not found.");
    }

    const shipmentData = shipmentDoc.data();

    const existingInvoices = await db
      .collection("invoices")
      .where("shipmentId", "==", shipmentId)
      .get();

    const hasActiveInvoice = existingInvoices.docs.some((doc) => {
      const invoiceStatus = doc.data()?.status || "DRAFT";
      return invoiceStatus !== "CANCELLED";
    });

    if (hasActiveInvoice) {
      throw new HttpsError(
        "already-exists",
        "An active invoice already exists for this shipment.",
      );
    }

    const now = Timestamp.now();
    const nowAt = admin.firestore.FieldValue.serverTimestamp();

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const invoiceNumber = `INV-${dateStr}-${Date.now().toString().slice(-6)}`;

    const invoiceRef = db.collection("invoices").doc(invoiceNumber);
    const collisionCheck = await invoiceRef.get();

    if (collisionCheck.exists) {
      throw new HttpsError("already-exists", "Invoice ID collision.");
    }

    const finalSenderName = shipmentData?.sender?.name || "";
    const finalSenderPhone = shipmentData?.sender?.phone || "";
    const finalRecipientName = shipmentData?.recipient?.name || "";
    const finalRecipientPhone = shipmentData?.recipient?.phone || "";

    const finalOrigin = shipmentData?.origin || "";
    const finalDestination = shipmentData?.destination || "";
    const finalRouteLabel = `${finalOrigin || "Unknown"} → ${finalDestination || "Unknown"}`;

    const finalBillingName = billingName || shipmentData?.sender?.name || "";
    const finalBillingAddress =
      billingAddress || shipmentData?.sender?.formattedAddress || "";

    const finalTrackingNumber =
      shipmentData?.trackingNumber || shipmentData?.shipmentId || shipmentId;

    const finalShipmentStatus = shipmentData?.status || "";
    const finalTripId = shipmentData?.currentTripId || null;

    const finalTotalPackages = shipmentData?.packages?.length || 0;
    const finalTotalItems = shipmentData?.totals?.totalItems || 0;

    const finalAmount = Number(amount) || 0;
    const finalStatus = ALLOWED_STATUSES.has(status) ? status : "DRAFT";

    const finalShipmentSnapshot = {
      id: shipmentId,
      shipmentId: finalTrackingNumber,
      sender: shipmentData?.sender || null,
      recipient: shipmentData?.recipient || null,
      origin: shipmentData?.origin || null,
      destination: shipmentData?.destination || null,
      totals: shipmentData?.totals || null,
      packages: shipmentData?.packages || [],
      status: shipmentData?.status || null,
      currentTripId: finalTripId,
    };

    const batch = db.batch();

    batch.set(invoiceRef, {
      invoiceNumber,
      shipmentId,
      shipmentTrackingNumber: finalTrackingNumber,

      billingName: finalBillingName,
      billingAddress: finalBillingAddress,

      senderName: finalSenderName,
      senderPhone: finalSenderPhone,
      recipientName: finalRecipientName,
      recipientPhone: finalRecipientPhone,

      origin: finalOrigin,
      destination: finalDestination,
      routeLabel: finalRouteLabel,

      shipmentStatus: finalShipmentStatus,
      tripId: finalTripId,

      totalPackages: finalTotalPackages,
      totalItems: finalTotalItems,
      amount: finalAmount,
      notes: notes || "",
      status: finalStatus,

      invoiceDate: invoiceDate || null,
      dueDate: dueDate || null,

      shipmentSnapshot: finalShipmentSnapshot,

      createdAt: nowAt,
      updatedAt: nowAt,
      createdBy: uid,
      updatedBy: uid,
    });

    batch.set(
      shipmentRef,
      {
        invoiceId: invoiceRef.id,
        invoiceNumber,
        invoiceStatus: finalStatus,
        hasInvoice: true,
        updatedAt: nowAt,
        updatedBy: uid,
      },
      { merge: true },
    );

    batch.set(db.collection("admin_logs").doc(), {
      action: "CREATE_INVOICE",
      invoiceId: invoiceRef.id,
      invoiceNumber,
      shipmentId,
      amount: finalAmount,
      actorId: uid,
      createdAt: nowAt,
    });

    batch.set(db.collection("invoice_events").doc(), {
      invoiceId: invoiceRef.id,
      invoiceNumber,
      type: "INVOICE_CREATED",
      status: finalStatus,
      actorId: uid,
      at: now,
      note: `Invoice ${invoiceNumber} created`,
    });

    try {
      await batch.commit();

      return {
        success: true,
        invoiceId: invoiceRef.id,
        invoiceNumber,
      };
    } catch (error) {
      console.error("Invoice creation failed:", error);
      throw new HttpsError("internal", "Failed to create invoice.");
    }
  },
);
