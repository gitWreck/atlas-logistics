import React, { useState, useEffect } from "react";
// Firebase
import { db } from "@/lib/firebase"; // Ensure path is correct
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  Timestamp,
} from "firebase/firestore";

import ManagerStats from "./ManagerStatistics";
import ManagerRecentTable from "./ManagerRecentTable";

export default function ManagerOverview({ onNavigateToShipments }) {
  // --- STATE ---
  const [dateRange, setDateRange] = useState("today");
  const [viewLimit, setViewLimit] = useState(5); // Default to 5 recent items

  const [stats, setStats] = useState({ total: 0, delayed: 0, inTransit: 0 });
  const [recentShipments, setRecentShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- HELPER: GET DATE OBJECT ---
  const getStartDate = (range) => {
    const now = new Date();
    if (range === "today") {
      now.setHours(0, 0, 0, 0); // Start of today
    } else if (range === "7days") {
      now.setDate(now.getDate() - 7);
    } else if (range === "30days") {
      now.setDate(now.getDate() - 30);
    }
    return Timestamp.fromDate(now);
  };

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const shipmentsRef = collection(db, "shipments");
        const startDate = getStartDate(dateRange);

        // 1. PREPARE STATS QUERIES (Parallel)
        // Note: 'updatedAt' is better for "Activity" dashboard than 'createdAt'
        const qTotal = query(shipmentsRef, where("updatedAt", ">=", startDate));
        const qDelayed = query(
          shipmentsRef,
          where("updatedAt", ">=", startDate),
          where("status", "==", "DELAYED"), // Requires Index: updatedAt + status
        );
        const qInTransit = query(
          shipmentsRef,
          where("updatedAt", ">=", startDate),
          where("status", "==", "IN_TRANSIT"), // Requires Index: updatedAt + status
        );

        // 2. PREPARE TABLE QUERY (Recent Activity)
        // This is separate from Date Range stats. Recent is always "Latest N items".
        const qRecent = query(
          shipmentsRef,
          orderBy("updatedAt", "desc"),
          limit(viewLimit),
        );

        // 3. EXECUTE ALL
        const [snapTotal, snapDelayed, snapTransit, snapRecent] =
          await Promise.all([
            getCountFromServer(qTotal),
            getCountFromServer(qDelayed),
            getCountFromServer(qInTransit),
            getDocs(qRecent),
          ]);

        // 4. SET STATE
        setStats({
          total: snapTotal.data().count,
          delayed: snapDelayed.data().count,
          inTransit: snapTransit.data().count,
        });

        const shipmentsData = snapRecent.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRecentShipments(shipmentsData);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [dateRange, viewLimit]); // Re-run when range OR limit changes

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* --- A. CONTROLS HEADER --- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white">Performance Overview</h2>
          <p className="text-xs text-slate-500">
            Metrics based on updates since{" "}
            <span className="text-blue-400 font-bold uppercase">
              {dateRange}
            </span>
          </p>
        </div>

        {/* DATE TOGGLE */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
          {["today", "7days", "30days"].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${
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
      <ManagerStats stats={stats} loading={loading} />

      {/* --- C. RECENT TABLE (With View Limit Prop) --- */}
      <ManagerRecentTable
        shipments={recentShipments}
        loading={loading}
        viewLimit={viewLimit}
        setViewLimit={setViewLimit}
        onViewAll={onNavigateToShipments} // <--- Pass it here
      />
    </div>
  );
}
