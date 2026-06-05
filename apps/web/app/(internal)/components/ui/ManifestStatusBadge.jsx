"use client";

import React from "react";
import StatusBadge from "./StatusBadge";
import {
  isHubTransferTrip,
  resolveManifestStatus,
} from "@/app/utility/manifestStatus";

export default function ManifestStatusBadge({
  trip = null,
  isDark = true,
  className = "",
}) {
  if (!trip || !isHubTransferTrip(trip)) return null;

  const status = resolveManifestStatus(trip);

  return (
    <span className={className}>
      <StatusBadge status={status} isDark={isDark} />
    </span>
  );
}
