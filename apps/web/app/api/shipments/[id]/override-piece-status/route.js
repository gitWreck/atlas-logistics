import { NextResponse } from "next/server";
import { createRequire } from "node:module";
import { headers } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

const require = createRequire(import.meta.url);
const {
  OverrideShipmentPieceStatusError,
  runOverrideShipmentPieceStatus,
} = require("../../../../../../functions/src/shipments/overrideShipmentPieceStatusCore");

export const dynamic = "force-dynamic";

const STATUS_BY_CODE = {
  "invalid-argument": 400,
  "failed-precondition": 409,
  "not-found": 404,
  "permission-denied": 403,
  unauthenticated: 401,
};

async function authorizeAdminOrManager() {
  const headersList = await headers();
  const token = headersList.get("authorization")?.split("Bearer ")[1];

  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  const userSnap = await adminDb.collection("users").doc(decodedToken.uid).get();
  const userData = userSnap.data() || {};
  const role = String(userData.role || "").toLowerCase();

  if (!userSnap.exists || userData.active !== true) {
    return {
      error: NextResponse.json(
        { error: "Inactive or missing user" },
        { status: 403 },
      ),
    };
  }

  if (!["admin", "manager"].includes(role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return {
    actor: {
      uid: decodedToken.uid,
      role,
      name:
        userData.name ||
        decodedToken.name ||
        decodedToken.email ||
        "Admin",
    },
  };
}

export async function POST(request, { params }) {
  try {
    const auth = await authorizeAdminOrManager();
    if (auth.error) return auth.error;

    const { id: shipmentId } = await params;
    const body = await request.json().catch(() => ({}));
    const packageId = body.packageId;
    const newStatus = body.newStatus;
    const remarks = body.remarks ?? null;
    const sourceUI = body.sourceUI || "SHIPMENT_DRAWER_API";

    const result = await runOverrideShipmentPieceStatus(adminDb, {
      shipmentId,
      packageId,
      newStatus,
      remarks,
      sourceUI,
      actor: auth.actor,
      fieldValue: FieldValue,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OverrideShipmentPieceStatusError) {
      return NextResponse.json(
        { error: error.message },
        { status: STATUS_BY_CODE[error.code] || 400 },
      );
    }

    console.error("override-piece-status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update piece status." },
      { status: 500 },
    );
  }
}
