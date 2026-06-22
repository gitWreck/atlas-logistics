import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import { invokeCallable } from "@/lib/invokeCallable";
import {
  formatHandoffReconciliationResponse,
  runTripHandoffReconciliation,
} from "@/lib/tripHandoffReconciliation";

export const dynamic = "force-dynamic";

async function authorizeManager() {
  const headersList = await headers();
  const token = headersList.get("authorization")?.split("Bearer ")[1];

  if (!token) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  const userSnap = await adminDb
    .collection("users")
    .doc(decodedToken.uid)
    .get();
  const role = userSnap.data()?.role?.toLowerCase();

  if (!["admin", "manager"].includes(role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { token };
}

export async function GET(_request, { params }) {
  try {
    const auth = await authorizeManager();
    if (auth.error) return auth.error;

    const { tripId } = await params;
    if (!tripId) {
      return NextResponse.json({ error: "Trip ID required" }, { status: 400 });
    }

    const payload = await runTripHandoffReconciliation(tripId);
    if (payload.error) {
      return NextResponse.json(
        { error: payload.error },
        { status: payload.status || 400 },
      );
    }

    return NextResponse.json(formatHandoffReconciliationResponse(payload));
  } catch (error) {
    console.error("Handoff reconciliation GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reconcile manifest" },
      { status: 500 },
    );
  }
}

/**
 * Step 1.2 — Finalize reconcile: auto-promote trip to ARRIVED when ready.
 * Body: { notify?: boolean, autoPromote?: boolean }
 */
export async function POST(request, { params }) {
  try {
    const auth = await authorizeManager();
    if (auth.error) return auth.error;

    const { tripId } = await params;
    if (!tripId) {
      return NextResponse.json({ error: "Trip ID required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const notify = body.notify === true;
    const autoPromote = body.autoPromote !== false;

    const payload = await runTripHandoffReconciliation(tripId);
    if (payload.error) {
      return NextResponse.json(
        { error: payload.error },
        { status: payload.status || 400 },
      );
    }

    let promoted = false;
    let promotionSkippedReason = null;
    let tripStatus = payload.tripStatus;

    const tripAlreadyArrived =
      String(payload.tripStatus || "").toUpperCase() === "ARRIVED";

    if (!autoPromote) {
      promotionSkippedReason = "AUTO_PROMOTE_DISABLED";
    } else if (payload.ready && tripAlreadyArrived) {
      await invokeCallable(
        "updateTripStatus",
        {
          tripId,
          status: "ARRIVED",
          notify,
          promotionSource: "RECONCILIATION",
          markReconciled: true,
        },
        auth.token,
      );
      promoted = true;
      tripStatus = "ARRIVED";
    } else if (!payload.lifecycle.canPromoteToArrived) {
      promotionSkippedReason = payload.lifecycle.promotionReason;
    } else {
      await invokeCallable(
        "updateTripStatus",
        {
          tripId,
          status: "ARRIVED",
          notify,
          promotionSource: "RECONCILIATION",
          markReconciled: true,
        },
        auth.token,
      );
      promoted = true;
      tripStatus = "ARRIVED";
    }

    const refreshed = await runTripHandoffReconciliation(tripId);
    const merged = {
      ...formatHandoffReconciliationResponse({
        ...refreshed,
        tripStatus: refreshed.trip?.status || tripStatus,
      }),
      promoted,
      promotionSkippedReason,
    };

    if (refreshed.error) {
      merged.tripStatus = tripStatus;
      merged.lifecycle = {
        ...payload.lifecycle,
        canReleaseForDelivery: promoted,
        releaseBlockReason: promoted
          ? null
          : payload.lifecycle.releaseBlockReason,
      };
    }

    return NextResponse.json(merged);
  } catch (error) {
    console.error("Handoff reconciliation POST error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to finalize reconciliation" },
      { status: 500 },
    );
  }
}
