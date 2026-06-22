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
    <div className={`rounded-2xl border p-4 ${palette.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-wide ${palette.title}`}>
            {title}
          </p>
          <p className={`mt-3 text-3xl font-bold leading-none ${palette.value}`}>
            {value}
          </p>
          <p className={`mt-2 text-xs ${palette.subtitle}`}>{subtitle}</p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${palette.iconWrap}`}
        >
          <FontAwesomeIcon icon={icon} className="text-base" />
        </div>
      </div>
    </div>
  );
}

export default function DeliveryCheckerSummaryCards({
  stats = {},
  isDark = false,
}) {
  const palette = getStatCardTheme(isDark);
  const total = Number(stats.total || 0);

  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
