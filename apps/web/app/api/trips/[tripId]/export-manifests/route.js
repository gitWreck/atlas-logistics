import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { buildTripManifestsPayload } from "@/lib/tripManifestsData";
import { ensureDeliveryManifestSealed } from "@/lib/sealDeliveryManifest";
import { resolveTripDocument } from "@/lib/printManifestData";

export const dynamic = "force-dynamic";

async function authorizeManager() {
  const headersList = await headers();
  const token = headersList.get("authorization")?.split("Bearer ")[1];

  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  const userSnap = await (await import("@/lib/firebase-admin")).adminDb
    .collection("users")
    .doc(decodedToken.uid)
    .get();
  const role = userSnap.data()?.role?.toLowerCase();

  if (!["admin", "manager"].includes(role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true };
}

export async function GET(_request, { params }) {
  try {
    const auth = await authorizeManager();
    if (auth.error) return auth.error;

    const { tripId } = await params;
    const trip = await resolveTripDocument(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    await ensureDeliveryManifestSealed(trip.id).catch(() => null);
    const payload = await buildTripManifestsPayload(trip.id);

    const filename = `${payload.tripCode || trip.id}-manifests.json`;
    const body = JSON.stringify(payload.exportBundle || payload, null, 2);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("export-manifests GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export manifests" },
      { status: 500 },
    );
  }
}
