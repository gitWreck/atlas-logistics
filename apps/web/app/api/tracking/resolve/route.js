import { NextResponse } from "next/server";
import { resolveTrackingCode } from "@/lib/resolveTrackingCode";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = String(searchParams.get("code") || "").trim();
    const result = await resolveTrackingCode(code);

    if (!result.found) {
      return NextResponse.json(result, { status: result.searchedCode ? 404 : 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Public tracking resolve error:", error);
    return NextResponse.json(
      {
        found: false,
        message: "System offline. Please try again later.",
      },
      { status: 500 },
    );
  }
}
