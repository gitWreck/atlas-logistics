"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBox,
  faCheck,
  faTruck,
  faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";
import { getStatCardTheme } from "@/app/utility/constant/theme";
import { formatCheckerStatPercent } from "@/app/utility/deliveryOperationsCheckers";

function SummaryStatCard({ palette, icon, title, value, subtitle }) {
  return (
    <div className={`rounded-xl border p-3 sm:rounded-2xl sm:p-4 ${palette.card}`}>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-wide sm:text-[11px] ${palette.title}`}>
            {title}
          </p>
          <p className={`mt-2 text-2xl font-bold leading-none sm:mt-3 sm:text-3xl ${palette.value}`}>
            {value}
          </p>
          <p className={`mt-1 truncate text-[11px] sm:mt-2 sm:text-xs ${palette.subtitle}`}>
            {subtitle}
          </p>
        </div>

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-11 sm:w-11 ${palette.iconWrap}`}
        >
          <FontAwesomeIcon icon={icon} className="text-sm sm:text-base" />
        </div>
      </div>
    </div>
  );
}

export default function DeliveryCheckerSummaryCards({
  stats = {},
  isDark = false,
  className = "",
}) {
  const palette = getStatCardTheme(isDark);
  const total = Number(stats.total || 0);

  return (
    <div
      className={`grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4 ${className}`}
    >
      <SummaryStatCard
        palette={palette.blue}
        icon={faBox}
        title="Total Packages"
        value={total}
        subtitle="Packages"
      />
      <SummaryStatCard
        palette={palette.emerald}
        icon={faCheck}
        title="Delivered"
        value={Number(stats.delivered || 0)}
        subtitle={formatCheckerStatPercent(stats.delivered, total)}
      />
      <SummaryStatCard
        palette={palette.amber}
        icon={faTruck}
        title="Out for Delivery"
        value={Number(stats.outForDelivery || 0)}
        subtitle={formatCheckerStatPercent(stats.outForDelivery, total)}
      />
      <SummaryStatCard
        palette={palette.violet}
        icon={faRotateLeft}
        title="Returned / Failed"
        value={Number(stats.returnedFailed || 0)}
        subtitle={formatCheckerStatPercent(stats.returnedFailed, total)}
      />
    </div>
  );
}
