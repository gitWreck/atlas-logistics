import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

// Helper to generate a short, readable tracking number (e.g., "TRK-9X2A")
function generateTrackingId() {
  return "AT-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { sender, recipient, items, createdBy } = body;
    // items = [{ weight: 5, description: "Clothes" }, { weight: 2, ... }]

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in order" }, { status: 400 });
    }

    const orderId = adminDb.collection("orders").doc().id;
    const orderRef = adminDb.collection("orders").doc(orderId);

    // We use a Batch or Transaction to ensure data integrity
    await adminDb.runTransaction(async (t) => {
      // 1. Create the Parent Order Document
      t.set(orderRef, {
        orderId,
        sender, // { name, phone, address }
        recipient, // { name, phone, address }
        totalPackages: items.length,
        status: "received_at_warehouse",
        createdAt: Timestamp.now(),
        createdBy: createdBy || "system", // The Manager's UID
        paymentStatus: "pending",
      });

      // 2. Create a Child Document for EACH Package
      items.forEach((item, index) => {
        const trackingNum = generateTrackingId();
        const pkgRef = adminDb.collection("packages").doc(trackingNum);

        t.set(pkgRef, {
          packageId: trackingNum,
          orderId: orderId, // LINK TO PARENT
          sequence: `${index + 1} of ${items.length}`, // "1 of 3"
          weight: item.weight,
          description: item.description,
          status: "received_at_warehouse", // Initial Status
          currentLocation: "Warehouse A", // Default to Manager's location (Phase 2 enhancement)
          senderName: sender.name, // Denormalized for easier search
          recipientName: recipient.name, // Denormalized for easier search
          createdAt: Timestamp.now(),
          history: [
            {
              status: "received_at_warehouse",
              timestamp: Timestamp.now(),
              note: "Item received at counter",
            },
          ],
        });
      });
    });

    return NextResponse.json({ success: true, orderId });
  } catch (error) {
    console.error("Order Creation Failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
