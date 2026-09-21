import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { formatFirestoreDate } from "@/app/utility/utilities";
import {
  inferredInvoicePackageIds,
  packageIdFor,
} from "@/lib/packageInvoiceScope.mjs";

export const dynamic = "force-dynamic";

function buildInvoiceShipmentSnapshot(data, linkedShipment, shipmentId) {
  const storedSnapshot =
    data.shipmentSnapshot && typeof data.shipmentSnapshot === "object"
      ? data.shipmentSnapshot
      : null;

  if (!linkedShipment) return storedSnapshot;

  const livePackages = Array.isArray(linkedShipment.packages)
    ? linkedShipment.packages
    : [];
  const effectivePackageIds = inferredInvoicePackageIds(data, livePackages);
  const effectivePackageIdSet = new Set(effectivePackageIds);
  const packageSource = Array.isArray(storedSnapshot?.packages)
    ? storedSnapshot.packages
    : Array.isArray(data.packageLineItems)
      ? data.packageLineItems
      : livePackages;
  const filteredPackages = packageSource.filter((pkg) =>
    effectivePackageIdSet.has(packageIdFor(pkg)),
  );
  const hasInvoicePackageScope = effectivePackageIds.length > 0;
  const scopedPackages = hasInvoicePackageScope
    ? filteredPackages.length > 0
      ? filteredPackages
      : data.packageLineItems || []
    : packageSource;
  const scopedTotalItems = scopedPackages.reduce(
    (total, pkg) => total + Math.max(Number(pkg.quantity) || 1, 1),
    0,
  );
  const scopedTotals = hasInvoicePackageScope
    ? {
        ...(storedSnapshot?.totals || {}),
        totalPackages: scopedPackages.length,
        totalItems: scopedTotalItems,
        totalContentQty: scopedTotalItems,
      }
    : linkedShipment.totals || storedSnapshot?.totals || null;

  return {
    ...(storedSnapshot || {}),
    id: shipmentId,
    shipmentId:
      linkedShipment.shipmentId || linkedShipment.trackingNumber || shipmentId,
    origin: linkedShipment.origin || storedSnapshot?.origin || null,
    destination:
      linkedShipment.destination || storedSnapshot?.destination || null,
    status: linkedShipment.status || storedSnapshot?.status || null,
    sender: linkedShipment.sender || storedSnapshot?.sender || null,
    recipient: linkedShipment.recipient || storedSnapshot?.recipient || null,
    totals: scopedTotals,
    packages: scopedPackages,
    currentTripId:
      data.tripId || storedSnapshot?.currentTripId || linkedShipment.currentTripId || null,
    createdAt: linkedShipment.createdAt
      ? formatFirestoreDate(linkedShipment.createdAt)
      : storedSnapshot?.createdAt || null,
    updatedAt: linkedShipment.updatedAt
      ? formatFirestoreDate(linkedShipment.updatedAt)
      : storedSnapshot?.updatedAt || null,
  };
}

export async function GET() {
  try {
    // 1. AUTHENTICATION
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // 2. CHECK ROLE
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data();

    if (
      !userData ||
      !["admin", "manager", "driver", "checker"].includes(
        userData.role?.toLowerCase(),
      )
    ) {
      return NextResponse.json(
        { error: "Forbidden: Staff Access Only" },
        { status: 403 },
      );
    }

    // 3. FETCH INVOICES
    const snapshot = await adminDb
      .collection("invoices")
      .orderBy("updatedAt", "desc")
      .get();

    // 4. PRE-FETCH RELATED SHIPMENTS
    const uniqueShipmentIds = new Set();

    snapshot.docs.forEach((doc) => {
      const shipmentId = doc.data().shipmentId;
      if (shipmentId) uniqueShipmentIds.add(shipmentId);
    });

    let shipmentMap = {};

    if (uniqueShipmentIds.size > 0) {
      const shipmentRefs = Array.from(uniqueShipmentIds).map((id) =>
        adminDb.collection("shipments").doc(id),
      );

      const shipmentSnapshots = await adminDb.getAll(...shipmentRefs);

      shipmentSnapshots.forEach((snap) => {
        if (snap.exists) {
          shipmentMap[snap.id] = snap.data();
        }
      });
    }

    // 5. TRANSFORM INVOICES
    const invoices = snapshot.docs.map((doc) => {
      const data = doc.data();
      const linkedShipment = data.shipmentId
        ? shipmentMap[data.shipmentId]
        : null;

      const createdAt = data.createdAt
        ? formatFirestoreDate(data.createdAt)
        : null;

      const updatedAt = data.updatedAt
        ? formatFirestoreDate(data.updatedAt)
        : null;

      const invoiceDate = data.invoiceDate
        ? formatFirestoreDate(data.invoiceDate)
        : null;

      const dueDate = data.dueDate ? formatFirestoreDate(data.dueDate) : null;
      const shipmentSnapshot = buildInvoiceShipmentSnapshot(
        data,
        linkedShipment,
        data.shipmentId,
      );

      return {
        id: doc.id,
        ...data,
        createdAt,
        updatedAt,
        invoiceDate,
        dueDate,

        amount: Number(data.amount || 0),
        status: data.status || "DRAFT",
        totalPackages: Number(
          shipmentSnapshot?.totals?.totalPackages ?? data.totalPackages ?? 0,
        ),
        totalItems: Number(
          shipmentSnapshot?.totals?.totalItems ?? data.totalItems ?? 0,
        ),
        shipmentSnapshot,
      };
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("API Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices", details: error.message },
      { status: 500 },
    );
  }
}
