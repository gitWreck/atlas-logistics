"use client";
import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PrintLabelsBundle from "./PrintLabelsBundle";
import PrintLabelsClient from "./PrintLabelsClient";

// ❌ REMOVED: export const dynamic = "force-dynamic";
// (Move the above line to a separate layout.js or page.js that is a Server Component)

function PrintSwitcher() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "shipment";

  // ✅ This is fine, but ensure both components handle the "id" param correctly
  if (mode === "shipment") {
    return <PrintLabelsBundle />;
  }

  return <PrintLabelsClient />;
}

export default function Page() {
  return (
    <Suspense
      fallback={<div className="p-10 text-center">Loading Print Engine...</div>}
    >
      <PrintSwitcher />
    </Suspense>
  );
}
