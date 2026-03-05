"use client";
import React from "react";
import { useSearchParams } from "next/navigation";
import PrintLabelsBundle from "./PrintLabelsBundle";
import PrintLabelsClient from "./PrintLabelsClient";

// Now this works because it's a Server Component
export const dynamic = "force-dynamic";

export default function Page() {
  // Inside PrintLabelsBundle fetchData...
  const mode = useSearchParams().get("mode") || "shipment"; // Default to shipment level

  if (mode === "shipment") return <PrintLabelsBundle />;
  else return <PrintLabelsClient />;
}
