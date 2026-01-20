import { NextResponse } from "next/server";
import { db } from "@/apps/web/lib/firebase";

export async function GET() {
  try {
    // Fetch last 50 packages
    const snapshot = await db
      .collection("packages")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const packages = snapshot.docs.map((doc) => ({
      id: doc.id, // This is the tracking number
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
    }));

    return NextResponse.json({ packages });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch packages" },
      { status: 500 },
    );
  }
}
