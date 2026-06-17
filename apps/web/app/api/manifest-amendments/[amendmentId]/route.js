import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { buildPrintAmendmentPayload } from "@/lib/printManifestData";

export const dynamic = "force-dynamic";

async function authorizeManager() {
  const headersList = await headers();
  const token = headersList.get("authorization")?.split("Bearer ")[1];

  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  const userSnap = await adminDb.collection("users").doc(decodedToken.uid).get();
  const role = userSnap.data()?.role?.toLowerCase();

  if (!["admin", "manager"].includes(role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true };
}

export async function GET(request, { params }) {
  try {
    const auth = await authorizeManager();
    if (auth.error) return auth.error;

    const { amendmentId } = await params;
    const tripId = new URL(request.url).searchParams.get("tripId");

    const payload = await buildPrintAmendmentPayload({
      amendmentId: amendmentId === "latest" ? null : amendmentId,
      tripIdOrPublicId: tripId,
    });

    if (payload.error) {
      return NextResponse.json(
        { error: payload.error },
        { status: payload.status || 400 },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("manifest-amendment GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load manifest amendment" },
      { status: 500 },
    );
  }
}
