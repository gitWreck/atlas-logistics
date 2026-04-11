const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { Timestamp } = admin.firestore;

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.createInvoice = onCall(
  {
    region: "asia-southeast1",
    maxInstances: 10,
  },
  async (request) => {
    // 1. AUTH
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const uid = request.auth.uid;

    const {
      shipmentId,
      shipmentTrackingNumber,
      invoiceNumber: manualInvoiceNumber,
      invoiceDate,
      dueDate,
      billingName,
      billingAddress,
      senderName,
      senderPhone,
      recipientName,
      recipientPhone,
      origin,
      destination,
      routeLabel,
      shipmentStatus,
      truckTripId,
      totalPackages,
      totalItems,
      amount,
      notes,
      status,
      shipmentSnapshot,
    } = request.data || {};

    // 2. VALIDATION
    if (!shipmentId) {
      throw new HttpsError("invalid-argument", "Missing shipmentId.");
    }

    if (!billingName) {
      throw new HttpsError("invalid-argument", "Missing billingName.");
    }

    if (amount === undefined || isNaN(Number(amount))) {
      throw new HttpsError("invalid-argument", "Invalid amount.");
    }

    // 3. FETCH SHIPMENT
    const shipmentRef = db.collection("shipments").doc(shipmentId);
    const shipmentDoc = await shipmentRef.get();

    if (!shipmentDoc.exists) {
      throw new HttpsError("not-found", "Shipment not found.");
    }

    const shipmentData = shipmentDoc.data();

    // Prevent duplicate invoice
    const existingInvoice = await db
      .collection("invoices")
      .where("shipmentId", "==", shipmentId)
      .limit(1)
      .get();

    if (!existingInvoice.empty) {
      throw new HttpsError(
        "already-exists",
        "Invoice already exists for this shipment.",
      );
    }

    // 4. ID GENERATION
    const now = Timestamp.now();
    const nowAt = admin.firestore.FieldValue.serverTimestamp();

    let invoiceNumber = manualInvoiceNumber;

    if (!invoiceNumber) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      invoiceNumber = `INV-${dateStr}-${Date.now().toString().slice(-6)}`;
    }

    const invoiceRef = db.collection("invoices").doc(invoiceNumber);

    const collisionCheck = await invoiceRef.get();
    if (collisionCheck.exists) {
      throw new HttpsError("already-exists", "Invoice ID collision.");
    }

    // 5. DERIVE FROM SHIPMENT (fallbacks)
    const finalSenderName = senderName || shipmentData?.sender?.name || "";
    const finalSenderPhone = senderPhone || shipmentData?.sender?.phone || "";
    const finalRecipientName =
      recipientName || shipmentData?.recipient?.name || "";
    const finalRecipientPhone =
      recipientPhone || shipmentData?.recipient?.phone || "";

    const finalOrigin = origin || shipmentData?.origin || "";
    const finalDestination = destination || shipmentData?.destination || "";

    const finalRouteLabel =
      routeLabel || `${finalOrigin} → ${finalDestination}`;

    const finalBillingName = billingName || shipmentData?.sender?.name || "";
    const finalBillingAddress =
      billingAddress || shipmentData?.sender?.formattedAddress || "";

    const finalTrackingNumber =
      shipmentTrackingNumber || shipmentData?.trackingNumber || shipmentId;

    const finalShipmentStatus = shipmentStatus || shipmentData?.status || "";
    const finalTruckTripId =
      truckTripId || shipmentData?.currentTruckTripId || null;

    const finalTotalPackages =
      Number(totalPackages) || shipmentData?.packages?.length || 0;

    const finalTotalItems =
      Number(totalItems) || shipmentData?.totals?.totalItems || 0;

    const finalAmount = Number(amount) || 0;
    const finalStatus = status || "DRAFT";

    // Snapshot fallback
    const finalShipmentSnapshot = shipmentSnapshot || {
      trackingNumber: shipmentData?.trackingNumber || shipmentId,
      sender: shipmentData?.sender || null,
      recipient: shipmentData?.recipient || null,
      origin: shipmentData?.origin || null,
      destination: shipmentData?.destination || null,
      totals: shipmentData?.totals || null,
      packages: shipmentData?.packages || [],
      status: shipmentData?.status || null,
      currentTruckTripId: shipmentData?.currentTruckTripId || null,
    };

    // 6. BATCH WRITE
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
      truckTripId: finalTruckTripId,

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

    // OPTIONAL: Link back to shipment
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

    // ADMIN LOG
    batch.set(db.collection("admin_logs").doc(), {
      action: "CREATE_INVOICE",
      invoiceId: invoiceRef.id,
      invoiceNumber,
      shipmentId,
      amount: finalAmount,
      actorId: uid,
      createdAt: nowAt,
    });

    // EVENT LOG
    batch.set(db.collection("invoice_events").doc(), {
      invoiceId: invoiceRef.id,
      type: "INVOICE_CREATED",
      status: finalStatus,
      actorId: uid,
      at: now,
      note: `Invoice ${invoiceNumber} created`,
    });

    // 7. COMMIT
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
