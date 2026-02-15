import React, { useState, useEffect } from "react";
// Firebase
import ManagerRecentTable from "./ManagerRecentTable";
import ManagerStatistics from "./ManagerStatistics";
import DelayApprovalWidget from "../delay/DelayWidget";
import RecentAlertsLogs from "../logs/RecentAlertsLogs";
import RecentSmsLogs from "../logs/RecentSmsLogs";

export default function ManagerOverview({
  user,
  userRole,
  profile,
  onNavigateToShipments,
}) {
  const [dateRange, setDateRange] = useState("today");
  const [viewLimit, setViewLimit] = useState(5); // Default to 5 recent items

  const [stats, setStats] = useState({ total: 0, delayed: 0, inTransit: 0 });
  const [recentShipments, setRecentShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = await user.getIdToken();

      // 3. Make the Fetch Call with Headers
      const res = await fetch(
        `/api/manager/dashboard?range=${dateRange}&limit=${viewLimit}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // <--- Pass token here
          },
          cache: "no-store", // Ensure we don't get stale data
        },
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || errorData.error || "Server Error");
      }

      const data = await res.json();
      setStats(data.stats);
      setRecentShipments(data.recentShipments);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, viewLimit]);
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <DelayApprovalWidget />

      {/* --- A. CONTROLS HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        {/* TEXT SECTION */}
        <div>
          <h2 className="text-lg font-bold text-white">Overview</h2>
          <p className="text-xs text-slate-500">
            Metrics based on updates since{" "}
            <span className="text-blue-400 font-bold uppercase">
              {dateRange === "today"
                ? "Today"
                : dateRange === "7days"
                  ? "Last 7 Days"
                  : "Last 30 Days"}
            </span>
          </p>
        </div>

        {/* DATE TOGGLE */}
        {/* w-full sm:w-auto: Stretches full width on mobile, shrinks on desktop */}
        <div className="flex w-full sm:w-auto bg-slate-950 p-1 rounded-lg border border-slate-800">
          {["today", "7days", "30days"].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              /* flex-1: Makes buttons equal width on mobile */
              /* sm:flex-none: Returns to natural width on desktop */
              className={`flex-1 sm:flex-none px-4 py-2 sm:py-1.5 text-xs font-bold uppercase rounded-md transition-all text-center ${
                dateRange === range
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {range === "today"
                ? "Today"
                : range === "7days"
                  ? "7 Days"
                  : "30 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* --- B. STATS --- */}
      <ManagerStatistics stats={stats} loading={loading} />

      {/* --- C. RECENT TABLE (With View Limit Prop) --- */}
      <ManagerRecentTable
        shipments={recentShipments}
        loading={loading}
        viewLimit={viewLimit}
        setViewLimit={setViewLimit}
        onViewAll={onNavigateToShipments} // <--- Pass it here
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px] mb-8">
        {/* LEFT: INCOMING ALERTS */}
        <RecentAlertsLogs />

        {/* RIGHT: OUTGOING LOGS */}
        <RecentSmsLogs />
      </div>
    </div>
  );
}
