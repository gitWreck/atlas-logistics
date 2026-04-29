import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    // 1. Get Trip ID from URL
    // Await params if using Next.js 15
    const { tripId } = await params;

    if (!tripId) {
      return NextResponse.json({ error: "Trip ID required" }, { status: 400 });
    }

    // 2. Auth Check
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await getAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // 3. Role Check (Optional but recommended)
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();
    if (
      !userData ||
      !["admin", "manager"].includes(userData.role?.toLowerCase())
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Fetch the Sub-Collection
    const snapshot = await adminDb
      .collection("truck_trips")
      .doc(tripId)
      .collection("trip_shipments")
      .orderBy("createdAt", "desc") // Optional sorting
      .get();

    const shipmentIds = snapshot.docs.map((doc) => doc.id);

    const rootRefs = shipmentIds.map((id) =>
      adminDb.collection("shipments").doc(id),
    );

    const rootSnaps = await adminDb.getAll(...rootRefs);

    const rootMap = {};
    rootSnaps.forEach((snap) => {
      if (snap.exists) {
        rootMap[snap.id] = snap.data();
      }
    });

    // 5. Transform Data
    const shipments = snapshot.docs.map((doc) => {
      const data = doc.data();
      const root = rootMap[doc.id] || {};
      const hasActiveInvoice =
        root.invoiceStatus !== "CANCELLED" &&
        (root.hasInvoice || Boolean(root.invoiceId));

      return {
        id: doc.id,

        // keep trip shipment data first
        ...data,

        // normalize shipment identifiers
        shipmentId: data.shipmentId || root.id || doc.id,
        trackingShipmentId:
          data.trackingShipmentId ||
          root.trackingNumber ||
          root.shipmentId ||
          doc.id,

        // use full root data when available
        sender: root.sender || data.sender || null,
        recipient: root.recipient || data.recipient || null,

        origin: root.origin || data.origin || null,
        originCode: root.originCode || data.originCode || null,
        destination: root.destination || data.destination || null,
        destinationCode: root.destinationCode || data.destinationCode || null,

        route:
          data.route ||
          root.route ||
          `${root.origin || data.origin || "Unknown"} -> ${
            root.destination || data.destination || "Unknown"
          }`,

        status: root.status || data.status || null,
        currentTripId: root.currentTripId || data.currentTripId || tripId,

        packages: root.packages || data.packages || [],
        packageBarcodes: root.packageBarcodes || data.packageBarcodes || [],

        totals: root.totals || {
          totalItems: data.totalItems || 0,
          loaded: data.loadedCount || 0,
          received: data.receivedCount || 0,
          delivered: data.deliveredCount || 0,
          pending: data.pendingCount || 0,
        },

        totalItems: root.totals?.totalItems || data.totalItems || 0,
        loadedCount: data.loadedCount || root.totals?.loaded || 0,
        receivedCount: data.receivedCount || root.totals?.received || 0,
        deliveredCount: data.deliveredCount || root.totals?.delivered || 0,
        pendingCount: data.pendingCount || root.totals?.pending || 0,

        // invoice fields from root shipment
        hasInvoice: hasActiveInvoice,
        invoiceId: hasActiveInvoice ? root.invoiceId || null : null,
        invoiceNumber: hasActiveInvoice ? root.invoiceNumber || null : null,
        invoiceStatus: root.invoiceStatus || null,

        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : null,
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate().toISOString()
          : null,
      };
    });

    return NextResponse.json({ shipments });
  } catch (error) {
    console.error("API Error fetching shipments:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipments" },
      { status: 500 },
    );
  }
}
