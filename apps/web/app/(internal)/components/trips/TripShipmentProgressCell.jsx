"use client";

import React, { useMemo } from "react";
import { getShipmentTripProgressDisplay } from "@/app/utility/tripStats";
import { getTableTheme } from "@/app/utility/constant/theme";

export default function TripShipmentProgressCell({
  shipment,
  trip,
  isDark = false,
  compact = false,
}) {
  const progress = useMemo(
    () => getShipmentTripProgressDisplay(shipment, trip),
    [shipment, trip],
  );

  const theme = getTableTheme(isDark);
  const isComplete =
    progress.total > 0 && progress.count >= progress.total;
  const badgeClass = isComplete
    ? theme.countBadgeLoaded
    : theme.countBadgeDefault;

  return (
    <span
      className={`text-[10px] font-bold border ${
        compact ? "px-2.5 py-1.5 rounded-lg" : "px-2 py-2 rounded"
      } ${badgeClass}`}
    >
      {progress.displayValue}
    </span>
  );
}
