"use client";

import React, { useState, useEffect } from "react";
import ManagerRecentTable from "./ManagerRecentTable";
import ManagerStatistics from "./ManagerStatistics";
import DelayApprovalWidget from "../delay/DelayWidget";
import RecentAlertsLogs from "../logs/RecentAlertsLogs";
import RecentSmsLogs from "../logs/RecentSmsLogs";
import { getOverviewThemeClasses } from "@/app/utility/constant/theme";
import Statistics from "../statistics/Statistics";
import {
  faBoxOpen,
  faExclamationTriangle,
  faTruckFast,
} from "@fortawesome/free-solid-svg-icons";

export default function ManagerOverview({
  user,
  onNavigateToShipments,
  isDark = false,
}) {
  const [dateRange, setDateRange] = useState("today");
  const [viewLimit, setViewLimit] = useState(5);
  const [stats, setStats] = useState({ total: 0, delayed: 0, inTransit: 0 });
  const [recentShipments, setRecentShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  const theme = getOverviewThemeClasses(isDark);

  const fetchDashboardData = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const token = await user.getIdToken();

      const res = await fetch(
        `/api/shipments/statistics?range=${dateRange}&limit=${viewLimit}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || errorData.error || "Server Error");
      }

      const data = await res.json();
      setStats(data.stats || { total: 0, delayed: 0, inTransit: 0 });
      setRecentShipments(data.recentShipments || []);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, viewLimit, user]);

  const rangeLabel =
    dateRange === "today"
      ? "Today"
      : dateRange === "7days"
        ? "Last 7 Days"
        : "Last 30 Days";

  const managerCards = [
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <DelayApprovalWidget isDark={isDark} />

      <Statistics
        title="Statistics"
        description="Metrics based on updates since"
        rangeLabel={rangeLabel}
        dateRange={dateRange}
        setDateRange={setDateRange}
        cards={managerCards}
        loading={loading}
        isDark={isDark}
        theme={theme}
        gridClassName="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
      />

      <ManagerRecentTable
        shipments={recentShipments}
        loading={loading}
        viewLimit={viewLimit}
        setViewLimit={setViewLimit}
        onViewAll={onNavigateToShipments}
        isDark={isDark}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <RecentAlertsLogs isDark={isDark} />
        <RecentSmsLogs isDark={isDark} />
      </div>
    </div>
  );
}
