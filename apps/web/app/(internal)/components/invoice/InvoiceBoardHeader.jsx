"use client";

import React from "react";
import {
  faFileInvoiceDollar,
  faPenToSquare,
  faCircleCheck,
  faBan,
  faTruckFast,
} from "@fortawesome/free-solid-svg-icons";
import StatsCard from "../statistics/StatsCard";

export default function InvoiceBoardHeader({
  isDark = false,
  totalCount = 0,
  draftCount = 0,
  issuedCount = 0,
  paidCount = 0,
  cancelledCount = 0,
  eligibleShipmentCount = 0,
}) {
  return (
    <section className="space-y-4">
      <div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        //   className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3"
      >
        <StatsCard
          title="Total"
          value={totalCount}
          icon={faFileInvoiceDollar}
          variant="indigo"
          isDark={isDark}
        />

        <StatsCard
          title="Draft"
          value={draftCount}
          icon={faPenToSquare}
          variant="amber"
          isDark={isDark}
        />

        <StatsCard
          title="Issued"
          value={issuedCount}
          icon={faFileInvoiceDollar}
          variant="sky"
          isDark={isDark}
        />

        <StatsCard
          title="Paid"
          value={paidCount}
          icon={faCircleCheck}
          variant="emerald"
          isDark={isDark}
        />

        <StatsCard
          title="Cancelled"
          value={cancelledCount}
          icon={faBan}
          variant="red"
          isDark={isDark}
        />

        <StatsCard
          title="Eligible Shipments"
          value={eligibleShipmentCount}
          icon={faTruckFast}
          variant="blue"
          isDark={isDark}
        />
      </div>
    </section>
  );
}
