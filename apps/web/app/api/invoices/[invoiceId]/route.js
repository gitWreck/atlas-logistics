import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { formatFirestoreDate } from "@/app/utility/utilities";
import {
  inferredInvoicePackageIds,
  packageIdFor,
} from "@/lib/packageInvoiceScope.mjs";

export const dynamic = "force-dynamic";

function mergeLiveShipmentIntoInvoiceSnapshot(data, shipmentData) {
  const storedSnapshot =
    data.shipmentSnapshot && typeof data.shipmentSnapshot === "object"
      ? data.shipmentSnapshot
      : {};
  const livePackages = Array.isArray(shipmentData.packages)
    ? shipmentData.packages
    : [];
  const effectivePackageIds = inferredInvoicePackageIds(data, livePackages);
  const effectivePackageIdSet = new Set(effectivePackageIds);
  const packageSource = Array.isArray(storedSnapshot.packages)
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

  return {
    ...storedSnapshot,
    id: data.shipmentId,
    shipmentId:
      shipmentData.shipmentId ||
      shipmentData.trackingNumber ||
      data.shipmentId,
    origin: shipmentData.origin || storedSnapshot.origin || null,
    destination: shipmentData.destination || storedSnapshot.destination || null,
    status: shipmentData.status || storedSnapshot.status || null,
    sender: shipmentData.sender || storedSnapshot.sender || null,
    recipient: shipmentData.recipient || storedSnapshot.recipient || null,
    totals: hasInvoicePackageScope
      ? {
          ...(storedSnapshot.totals || {}),
          totalPackages: scopedPackages.length,
          totalItems: scopedTotalItems,
          totalContentQty: scopedTotalItems,
        }
      : shipmentData.totals || storedSnapshot.totals || null,
    packages: scopedPackages,
    currentTripId:
      data.tripId || storedSnapshot.currentTripId || shipmentData.currentTripId || null,
    createdAt: shipmentData.createdAt
      ? formatFirestoreDate(shipmentData.createdAt)
      : storedSnapshot.createdAt || null,
    updatedAt: shipmentData.updatedAt
      ? formatFirestoreDate(shipmentData.updatedAt)
      : storedSnapshot.updatedAt || null,
  };
}

export async function GET(_request, { params }) {
  try {
    const { invoiceId } = await params;

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID required" },
        { status: 400 },
      );
    }

    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

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

    const invoiceSnap = await adminDb
      .collection("invoices")
      .doc(decodeURIComponent(invoiceId))
      .get();

    if (!invoiceSnap.exists) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const data = invoiceSnap.data();
    let shipmentSnapshot = data.shipmentSnapshot || null;

    if (data.shipmentId) {
      const shipmentSnap = await adminDb
        .collection("shipments")
        .doc(data.shipmentId)
        .get();

      if (shipmentSnap.exists) {
        const shipmentData = shipmentSnap.data();

        shipmentSnapshot = mergeLiveShipmentIntoInvoiceSnapshot(
          data,
          shipmentData,
        );
      }
    }

    return NextResponse.json({
      invoice: {
        id: invoiceSnap.id,
        ...data,
        createdAt: data.createdAt ? formatFirestoreDate(data.createdAt) : null,
        updatedAt: data.updatedAt ? formatFirestoreDate(data.updatedAt) : null,
        invoiceDate: data.invoiceDate
          ? formatFirestoreDate(data.invoiceDate)
          : null,
        dueDate: data.dueDate ? formatFirestoreDate(data.dueDate) : null,
        amount: Number(data.amount || 0),
        status: data.status || "DRAFT",
        totalPackages: Number(
          shipmentSnapshot?.totals?.totalPackages ?? data.totalPackages ?? 0,
        ),
        totalItems: Number(
          shipmentSnapshot?.totals?.totalItems ?? data.totalItems ?? 0,
        ),
        shipmentSnapshot,
      },
    });
  } catch (error) {
    console.error("API Error fetching invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice", details: error.message },
      { status: 500 },
    );
  }
}
