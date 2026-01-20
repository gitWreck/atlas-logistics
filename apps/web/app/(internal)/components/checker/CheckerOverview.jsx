"use client";
import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faTruckLoading,
  faClipboardCheck,
  faBarcode,
  faSearch,
  faTruck,
} from "@fortawesome/free-solid-svg-icons";
import StatusCard from "../ui/StatusCard"; // Assuming this exists from your template
import { useRouter } from "next/navigation";

export default function CheckerOverview() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ received: 0, loaded: 0, pending: 0 });
  const [recentShipments, setRecentShipments] = useState([]);
  const [quickScan, setQuickScan] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. CALL THE REAL API
      const res = await fetch("/api/checker/dashboard", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        // timestamp prevents caching if needed
        cache: "no-store",
      });

      if (!res.ok) throw new Error("API Failed");

      const data = await res.json();

      // 2. SET REAL DATA
      setStats({
        received: data.stats.received || 0,
        loaded: data.stats.loaded || 0,
        pending: data.stats.pending || 0,
      });

      setRecentShipments(data.recentShipments || []);
    } catch (err) {
      console.error("Failed to load dashboard", err);
      // Optional: Show an error toast here
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Optional: Refresh every 60 seconds to keep stats live
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 1. HEADER & QUICK ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Warehouse Operations
          </h1>
          <p className="text-slate-400 text-xs">
            Overview for {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* QUICK SCAN WIDGET */}
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input
              value={quickScan}
              onChange={(e) => setQuickScan(e.target.value)}
              placeholder="Quick Lookup ID..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-blue-500 outline-none"
            />
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3 top-3 text-slate-500 text-xs"
            />
          </div>
          <button
            onClick={() => router.push("/checker/scan")} // Link to the dedicated Scanner Page
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20"
          >
            <FontAwesomeIcon icon={faBarcode} />
            <span className="hidden md:inline">Open Scanner</span>
          </button>
        </div>
      </div>

      {/* 2. STATS GRID (Operational) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          title="Received Today"
          value={stats.received}
          icon={faBoxOpen}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
        <StatusCard
          title="Loaded to Trucks"
          value={stats.loaded}
          icon={faTruckLoading}
          color="text-emerald-400"
          bg="bg-emerald-500/10"
        />
        <StatusCard
          title="Pending / Floor"
          value={stats.pending} // Calculated as Received - Loaded usually
          icon={faClipboardCheck}
          color="text-amber-400"
          bg="bg-amber-500/10"
        />
      </div>

      {/* 3. RECENT ACTIVITY TABLE */}
      <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="font-bold text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faTruck} className="text-slate-500" />
            Out for Delivery / Loaded
          </h2>
          <button className="text-xs text-slate-500 hover:text-white transition-colors">
            View All History
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-950 text-slate-500 uppercase font-semibold text-xs">
              <tr>
                <th className="px-6 py-3">Tracking #</th>
                <th className="px-6 py-3">Destination</th>
                <th className="px-6 py-3">Truck / Plate</th>
                <th className="px-6 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td
                    colSpan="4"
                    className="px-6 py-8 text-center text-slate-600"
                  >
                    Loading shipments...
                  </td>
                </tr>
              ) : recentShipments.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    className="px-6 py-8 text-center text-slate-600"
                  >
                    No shipments found for today.
                  </td>
                </tr>
              ) : (
                recentShipments.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-200">{s.id}</div>
                      <div className="text-xs text-slate-500">{s.receiver}</div>
                    </td>
                    <td className="px-6 py-4">{s.area}</td>
                    <td className="px-6 py-4">
                      <span className="font-mono bg-slate-800 px-2 py-1 rounded text-xs border border-slate-700">
                        {s.truck}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          s.status === "OUT_FOR_DELIVERY"
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {s.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
