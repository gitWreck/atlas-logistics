import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    // 1. AUTHENTICATION & ROLE CHECK (Retained from your code)
    const headersList = await headers();
    const token = headersList.get("authorization")?.split("Bearer ")[1];

    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decodedToken = await adminAuth.verifyIdToken(token);
    const staffDoc = await adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();
    const staffData = staffDoc.data();

    if (
      !staffData ||
      !["admin", "manager", "checker"].includes(staffData.role?.toLowerCase())
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. QUERY PARAMETER (Optional: for searching while typing)
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase() || "";

    // 3. FETCH CUSTOMERS
    // We filter by role and active status
    const snapshot = await adminDb
      .collection("users")
      .where("role", "==", "customer")
      .where("active", "==", true)
      .limit(100)
      .get();

    // 4. TRANSFORM & FILTER
    const customers = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          name: data.name,
          phoneNumber: data.phoneNumber,
          address: data.address || {}, // Nesting exactly like your data example
          email: data.email,
        };
      })
      // Filter by name or phone if a search query exists
      .filter(
        (c) =>
          c.name?.toLowerCase().includes(search) ||
          c.phoneNumber?.includes(search),
      );

    return NextResponse.json({ customers });
  } catch (error) {
    console.error("Customer Fetch Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
