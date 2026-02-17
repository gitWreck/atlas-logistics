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

export default function RecentAlertsLogs({ isDark = false }) {
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

  const containerClasses = isDark
    ? "bg-slate-900 border-slate-800"
    : "bg-white border-slate-200 shadow-sm";
  const headerClasses = isDark
    ? "bg-slate-900/50 border-slate-800"
    : "bg-slate-50 border-slate-200";
  const titleClasses = isDark ? "text-amber-500" : "text-amber-600";
  const liveBadgeClasses = isDark
    ? "bg-slate-800 text-slate-400 border-slate-700"
    : "bg-slate-200 text-slate-600 border-slate-200";
  const emptyClasses = isDark ? "text-slate-600" : "text-slate-500";
  const cardUnreadClasses = isDark
    ? "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10"
    : "bg-amber-50 border-amber-200 hover:bg-amber-100";
  const cardReadClasses = isDark
    ? "bg-slate-800/40 border-slate-700 hover:bg-slate-800"
    : "bg-slate-50 border-slate-200 hover:bg-slate-100";
  const driverText = isDark ? "text-slate-200" : "text-slate-900";
  const timeText = isDark ? "text-slate-500" : "text-slate-500";
  const tripBadgeClasses = isDark
    ? "bg-slate-700 text-slate-300 border-slate-600"
    : "bg-slate-100 text-slate-700 border-slate-200";
  const reasonClasses = isDark ? "text-amber-400" : "text-amber-700";
  const footerBorder = isDark ? "border-slate-700/50" : "border-slate-200";
  const notesClasses = isDark ? "text-slate-400" : "text-slate-500";

  return (
    <div
      className={`border rounded-xl overflow-hidden flex flex-col h-full shadow-lg ${containerClasses}`}
    >
      <div
        className={`px-5 py-4 border-b flex justify-between items-center sticky top-0 z-10 backdrop-blur-md ${headerClasses}`}
      >
        <h3
          className={`${titleClasses} font-bold text-sm uppercase flex items-center gap-2`}
        >
          <FontAwesomeIcon icon={faTriangleExclamation} />
          Recent Delays & Alerts
        </h3>
        <span
          className={`text-[10px] px-2 py-1 rounded-full border ${liveBadgeClasses}`}
        >
          Live Feed
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {alerts.length === 0 ? (
          <div
            className={`h-full flex items-center justify-center text-xs italic ${emptyClasses}`}
          >
            No alerts recorded.
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border flex flex-col gap-1 transition-all ${
                alert.status === "UNREAD" ? cardUnreadClasses : cardReadClasses
              }`}
            >
              {/* Header: Driver & Time */}
              <div className="flex justify-between items-start">
                <span className={`font-bold text-xs ${driverText}`}>
                  {alert.driverName || "Unknown Driver"}
                </span>
                <span
                  className={`text-[10px] whitespace-nowrap ${timeText}`}
                >
                  {formatDistanceToNow(alert.createdAt, { addSuffix: true })}
                </span>
              </div>

              {/* Body: Reason & Trip */}
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${tripBadgeClasses}`}
                >
                  {alert.tripId || "No Trip"}
                </span>
                <span className={`text-xs font-bold ${reasonClasses}`}>
                  {alert.reason?.replace(/_/g, " ") || "Delay Reported"}
                </span>
              </div>

              {/* Status Footer */}
              <div
                className={`flex justify-between items-center mt-2 pt-2 border-t ${footerBorder}`}
              >
                <p
                  className={`text-[10px] italic truncate max-w-[200px] ${notesClasses}`}
                >
                  {alert.notes || "No additional notes"}
                </p>
                {alert.status === "RESOLVED" ? (
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <FontAwesomeIcon icon={faCheckCircle} /> Resolved
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 flex items-center gap-1 animate-pulse">
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
