"use client";
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase"; // Adjust path
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  faCheckCircle,
  faClock,
} from "@fortawesome/free-solid-svg-icons";
import { formatDistanceToNow } from "date-fns";

export default function RecentAlertsLogs() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "admin_alerts"),
      orderBy("createdAt", "desc"), // Newest first
      limit(20),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Convert Timestamp to Date object safely
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));
      setAlerts(data);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full shadow-lg">
      <div className="px-5 py-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
        <h3 className="text-amber-500 font-bold text-sm uppercase flex items-center gap-2">
          <FontAwesomeIcon icon={faTriangleExclamation} />
          Recent Delays & Alerts
        </h3>
        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded-full border border-slate-700">
          Live Feed
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
            No alerts recorded.
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border flex flex-col gap-1 transition-all ${
                alert.status === "UNREAD"
                  ? "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10"
                  : "bg-slate-800/40 border-slate-700 hover:bg-slate-800"
              }`}
            >
              {/* Header: Driver & Time */}
              <div className="flex justify-between items-start">
                <span className="font-bold text-slate-200 text-xs">
                  {alert.driverName || "Unknown Driver"}
                </span>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  {formatDistanceToNow(alert.createdAt, { addSuffix: true })}
                </span>
              </div>

              {/* Body: Reason & Trip */}
              <div className="flex items-center gap-2 mt-1">
                <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] font-mono text-slate-300 border border-slate-600">
                  {alert.tripId || "No Trip"}
                </span>
                <span className="text-xs text-amber-400 font-bold">
                  {alert.reason?.replace(/_/g, " ") || "Delay Reported"}
                </span>
              </div>

              {/* Status Footer */}
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700/50">
                <p className="text-[10px] text-slate-400 italic truncate max-w-[200px]">
                  {alert.notes || "No additional notes"}
                </p>
                {alert.status === "RESOLVED" ? (
                  <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                    <FontAwesomeIcon icon={faCheckCircle} /> Resolved
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-500 flex items-center gap-1 animate-pulse">
                    <FontAwesomeIcon icon={faClock} /> Pending
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
