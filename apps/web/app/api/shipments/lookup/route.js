import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const SHIPMENT_REF_PATTERN =
  /^AT-\d{8}-SHP-[A-Z0-9-]+(?:-\d{2})?$/i;

async function authorizeStaff() {
  const headersList = await headers();
  const token = headersList.get("authorization")?.split("Bearer ")[1];

  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
  const role = String(userSnap.data()?.role || "").toLowerCase();

  if (!["admin", "manager"].includes(role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { role };
}

async function resolveShipment(code) {
  const clean = String(code || "").trim();
  if (!clean) return null;

  const directSnap = await adminDb.collection("shipments").doc(clean).get();
  if (directSnap.exists) {
    return {
      shipmentDocId: directSnap.id,
      shipment: directSnap.data() || {},
      matchedBy: "document_id",
      packageLabel: null,
    };
  }

  const byBarcodeSnap = await adminDb
    .collection("shipments")
    .where("packageBarcodes", "array-contains", clean)
    .limit(1)
    .get();

  if (!byBarcodeSnap.empty) {
    const docSnap = byBarcodeSnap.docs[0];
    return {
      shipmentDocId: docSnap.id,
      shipment: docSnap.data() || {},
      matchedBy: "package_label",
      packageLabel: clean,
    };
  }

  const byPublicIdSnap = await adminDb
    .collection("shipments")
    .where("shipmentId", "==", clean)
    .limit(1)
    .get();

  if (!byPublicIdSnap.empty) {
    const docSnap = byPublicIdSnap.docs[0];
    return {
      shipmentDocId: docSnap.id,
      shipment: docSnap.data() || {},
      matchedBy: "shipment_id",
      packageLabel: null,
    };
  }

  return null;
}

export async function GET(request) {
  try {
    const auth = await authorizeStaff();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const code = String(searchParams.get("code") || "").trim();
    const tripId = String(searchParams.get("tripId") || "").trim();

    if (!code) {
      return NextResponse.json(
        { found: false, valid: false, message: "Enter a shipment or package label." },
        { status: 400 },
      );
    }

    if (!SHIPMENT_REF_PATTERN.test(code)) {
      return NextResponse.json({
        found: false,
        valid: false,
        message: "Use a valid Atlas label (e.g. AT-20260612-SHP-677769 or …-09).",
      });
    }

    const resolved = await resolveShipment(code);
    if (!resolved) {
      return NextResponse.json({
        found: false,
        valid: false,
        message: "Label not found in system.",
      });
    }

    const { shipment, shipmentDocId, matchedBy, packageLabel } = resolved;
    const currentTripId = shipment.currentTripId || null;
    let eligible = true;
    let blockReason = null;

    if (tripId && currentTripId && currentTripId !== tripId) {
      eligible = false;
      blockReason = `Assigned to another trip (${currentTripId}).`;
    }

    return NextResponse.json({
      found: true,
      valid: eligible,
      shipmentDocId,
      shipmentId: shipment.shipmentId || shipmentDocId,
      recipientName: shipment.recipient?.name || null,
      status: shipment.status || null,
      matchedBy,
      packageLabel,
      currentTripId,
      alreadyOnTrip: Boolean(tripId && currentTripId === tripId),
      eligible,
      blockReason,
    });
  } catch (error) {
    console.error("Shipment lookup error:", error);
    return NextResponse.json(
      { found: false, valid: false, message: error.message || "Lookup failed." },
      { status: 500 },
    );
  }
}
