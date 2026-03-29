import React from "react";
import {
  faBoxOpen,
  faExclamationTriangle,
  faTruckFast,
} from "@fortawesome/free-solid-svg-icons";
import StatsCardGrid from "../statistics/StatsCardGrid";

export default function ManagerStatistics({ stats, loading, isDark = false }) {
  const cards = [
    {
      title: "Total Shipments",
      value: stats.total,
      subtitle: "All shipments in range",
      icon: faBoxOpen,
      variant: "indigo",
    },
    {
      title: "Delayed",
      value: stats.delayed,
      subtitle: "Requiring attention",
      icon: faExclamationTriangle,
      variant: "amber",
    },
    {
      title: "In Transit",
      value: stats.inTransit,
      subtitle: "Currently moving",
      icon: faTruckFast,
      variant: "sky",
    },
  ];

  return (
    <StatsCardGrid
      cards={cards}
      loading={loading}
      isDark={isDark}
      gridClassName="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
    />
  );
}
