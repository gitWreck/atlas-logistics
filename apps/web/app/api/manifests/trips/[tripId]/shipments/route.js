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
      const rootPackages = Array.isArray(root.packages) ? root.packages : [];
      const tripBarcodeSet = new Set(
        (data.packageBarcodes || []).filter(Boolean).map(String),
      );
      const packageQty = (pkg) => Math.max(Number(pkg.quantity) || 1, 1);
      const tripPackages = rootPackages.filter((pkg) => {
        const packageTripId = pkg.currentTripId || pkg.loadedOnTrip || null;
        const packageId = pkg.packageId || pkg.trackingNumber || null;

        if (packageTripId) return packageTripId === tripId;
        if (!packageId || !tripBarcodeSet.has(String(packageId))) return false;

        const loadedQty = Math.min(Number(pkg.loadedQty) || 0, packageQty(pkg));
        const receivedQty = Math.min(
          Number(pkg.receivedQty) || 0,
          packageQty(pkg),
        );
        if (loadedQty > 0 || receivedQty > 0) return true;

        return [
          "LOADED",
          "LOADED_TO_TRIP",
          "IN_TRANSIT",
          "OUT_FOR_DELIVERY",
          "ARRIVED_AT_ODIONGAN",
        ].includes(String(pkg.status || "").toUpperCase());
      });
      const hasPackageScopedManifest = tripPackages.length || tripBarcodeSet.size;
      const visiblePackages = hasPackageScopedManifest
        ? tripPackages
        : rootPackages;
      const sumQty = (field) =>
        visiblePackages.reduce(
          (sum, pkg) => sum + Math.min(Number(pkg[field]) || 0, packageQty(pkg)),
          0,
        );
      const shipmentFullPieceTotal = Math.max(
        Number(root.totals?.totalContentQty) || 0,
        Number(root.totals?.totalItems) || 0,
        rootPackages.reduce((sum, pkg) => sum + packageQty(pkg), 0),
        (root.packageBarcodes || []).length,
      );
      const tripScopedPieceTotal = hasPackageScopedManifest
        ? Math.max(
            visiblePackages.reduce((sum, pkg) => sum + packageQty(pkg), 0),
            Number(data.loadedCount) || 0,
            tripBarcodeSet.size,
          )
        : Math.max(
            Number(data.loadedCount) || 0,
            Number(data.totalItems) || 0,
            tripBarcodeSet.size,
          );
      const visibleLoadedQty =
        data.loadedCount ?? sumQty("loadedQty") ?? root.totals?.loaded ?? 0;
      const visibleReceivedQty =
        data.receivedCount ??
        data.deliveredCount ??
        sumQty("receivedQty") ??
        root.totals?.received ??
        0;
      const visibleMissingQty =
        data.missingCount ?? sumQty("missingQty") ?? root.totals?.missing ?? 0;
      const visibleDamagedQty =
        data.damagedCount ?? sumQty("damagedQty") ?? root.totals?.damaged ?? 0;
      const visiblePendingQty =
        data.pendingCount ??
        Math.max(
          tripScopedPieceTotal -
            visibleLoadedQty -
            visibleReceivedQty -
            visibleMissingQty -
            visibleDamagedQty,
          0,
        );
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

        packages: visiblePackages,
        packageBarcodes:
          data.packageBarcodes || visiblePackages.map((pkg) => pkg.packageId),

        totals: {
          ...(root.totals || {}),
          totalItems: hasPackageScopedManifest
            ? visiblePackages.length
            : tripScopedPieceTotal,
          totalContentQty: shipmentFullPieceTotal,
          tripPieceTotal: tripScopedPieceTotal,
          loaded: visibleLoadedQty,
          received: visibleReceivedQty,
          delivered: visibleReceivedQty,
          pending: visiblePendingQty,
          missing: visibleMissingQty,
          damaged: visibleDamagedQty,
        },

        shipmentPieceTotal: shipmentFullPieceTotal,
        totalItems: tripScopedPieceTotal,
        loadedCount: visibleLoadedQty,
        receivedCount: visibleReceivedQty,
        deliveredCount: visibleReceivedQty,
        pendingCount: visiblePendingQty,

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
