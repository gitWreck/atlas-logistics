"use client";
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEnvelope,
  faBullhorn,
  faPaperPlane,
} from "@fortawesome/free-solid-svg-icons";
import { formatDistanceToNow } from "date-fns";

export default function RecentSmsLogs({ isDark = false }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "sms_logs"),
      orderBy("at", "desc"), // 'at' is your timestamp field
      limit(10),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        sentAt: doc.data().at?.toDate() || new Date(),
      }));
      setLogs(data);
    });

    return () => unsubscribe();
  }, []);

  const containerClasses = isDark
    ? "bg-slate-900 border-slate-800"
    : "bg-white border-slate-200 shadow-sm";
  const headerClasses = isDark
    ? "bg-slate-900/50 border-slate-800"
    : "bg-slate-50 border-slate-200";
  const titleClasses = isDark ? "text-blue-400" : "text-blue-600";
  const historyBadgeClasses = isDark
    ? "bg-slate-800 text-slate-400 border-slate-700"
    : "bg-slate-200 text-slate-600 border-slate-200";
  const emptyClasses = isDark ? "text-slate-600" : "text-slate-500";
  const cardClasses = isDark
    ? "bg-slate-800/30 hover:bg-slate-800/60 border-slate-700/50"
    : "bg-slate-50 hover:bg-slate-100 border-slate-200";
  const targetClasses = isDark ? "text-slate-300" : "text-slate-600";
  const timeClasses = isDark ? "text-slate-500" : "text-slate-500";
  const bodyClasses = isDark
    ? "text-slate-400 group-hover:text-slate-200"
    : "text-slate-600 group-hover:text-slate-800";
  const footerClasses = isDark ? "text-slate-600" : "text-slate-500";
  const broadcastBadgeClasses = isDark
    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
    : "bg-purple-100 text-purple-700 border-purple-200";
  const manualBadgeClasses = isDark
    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
    : "bg-blue-100 text-blue-700 border-blue-200";

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
          <FontAwesomeIcon icon={faEnvelope} />
          Outgoing Message Logs
        </h3>
        <span
          className={`text-[10px] px-2 py-1 rounded-full border ${historyBadgeClasses}`}
        >
          History
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {logs.length === 0 ? (
          <div
            className={`h-full flex items-center justify-center text-xs italic ${emptyClasses}`}
          >
            No messages sent recently.
          </div>
        ) : (
          logs.map((log) => {
            const isBroadcast =
              log.type === "BROADCAST" || log.type === "AUTO_STATUS";

            return (
              <div
                key={log.id}
                className={`p-3 border rounded-lg transition-colors group ${cardClasses}`}
              >
                {/* Header: Type & Time */}
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    {isBroadcast ? (
                      <span
                        className={`border text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 ${broadcastBadgeClasses}`}
                      >
                        <FontAwesomeIcon icon={faBullhorn} size="xs" />{" "}
                        BROADCAST
                      </span>
                    ) : (
                      <span
                        className={`border text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 ${manualBadgeClasses}`}
                      >
                        <FontAwesomeIcon icon={faPaperPlane} size="xs" />{" "}
                        {log.type.replace(/_/g, " ")}
                      </span>
                    )}

                    <span className={`text-[10px] font-mono ${targetClasses}`}>
                      {isBroadcast
                        ? `${log.successCount}/${log.totalTargets} Sent`
                        : log.phone || "No Phone"}
                    </span>
                  </div>

                  <span className={`text-[10px] ${timeClasses}`}>
                    {formatDistanceToNow(log.sentAt, { addSuffix: true })}
                  </span>
                </div>

                {/* Message Body */}
                <p
                  className={`text-xs line-clamp-2 leading-relaxed ${bodyClasses}`}
                >
                  {log.message}
                </p>

                {/* Footer: Context (Trip or Tracking) */}
                <div
                  className={`mt-2 flex items-center gap-2 text-[10px] ${footerClasses}`}
                >
                  {log.tripId && <span>Trip: {log.tripId}</span>}
                  {log.trackingId && <span>Pkg: {log.trackingId}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
