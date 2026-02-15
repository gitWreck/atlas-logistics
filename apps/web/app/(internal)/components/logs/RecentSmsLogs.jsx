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

export default function RecentSmsLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "sms_logs"),
      orderBy("at", "desc"), // 'at' is your timestamp field
      limit(20),
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full shadow-lg">
      <div className="px-5 py-4 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md">
        <h3 className="text-blue-400 font-bold text-sm uppercase flex items-center gap-2">
          <FontAwesomeIcon icon={faEnvelope} />
          Outgoing Message Logs
        </h3>
        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded-full border border-slate-700">
          History
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
            No messages sent recently.
          </div>
        ) : (
          logs.map((log) => {
            // Determine styling based on type
            const isBroadcast =
              log.type === "BROADCAST" || log.type === "AUTO_STATUS";

            return (
              <div
                key={log.id}
                className="p-3 bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/50 rounded-lg transition-colors group"
              >
                {/* Header: Type & Time */}
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    {isBroadcast ? (
                      <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                        <FontAwesomeIcon icon={faBullhorn} size="xs" />{" "}
                        BROADCAST
                      </span>
                    ) : (
                      <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                        <FontAwesomeIcon icon={faPaperPlane} size="xs" /> MANUAL
                      </span>
                    )}

                    {/* Target Info */}
                    <span className="text-[10px] text-slate-300 font-mono">
                      {isBroadcast
                        ? `${log.successCount}/${log.totalTargets} Sent`
                        : log.phone || "No Phone"}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-500">
                    {formatDistanceToNow(log.sentAt, { addSuffix: true })}
                  </span>
                </div>

                {/* Message Body */}
                <p className="text-xs text-slate-400 group-hover:text-slate-200 line-clamp-2 leading-relaxed">
                  {log.message}
                </p>

                {/* Footer: Context (Trip or Tracking) */}
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-600">
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
