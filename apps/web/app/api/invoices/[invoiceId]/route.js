import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { formatFirestoreDate } from "@/app/utility/utilities";

export const dynamic = "force-dynamic";

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

        shipmentSnapshot = {
          id: data.shipmentId,
          shipmentId:
            shipmentData.shipmentId || shipmentData.trackingNumber || data.shipmentId,
          origin: shipmentData.origin || null,
          destination: shipmentData.destination || null,
          status: shipmentData.status || null,
          sender: shipmentData.sender || null,
          recipient: shipmentData.recipient || null,
          totals: shipmentData.totals || null,
          packages: shipmentData.packages || [],
          currentTripId: shipmentData.currentTripId || null,
          createdAt: shipmentData.createdAt
            ? formatFirestoreDate(shipmentData.createdAt)
            : null,
          updatedAt: shipmentData.updatedAt
            ? formatFirestoreDate(shipmentData.updatedAt)
            : null,
        };
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
