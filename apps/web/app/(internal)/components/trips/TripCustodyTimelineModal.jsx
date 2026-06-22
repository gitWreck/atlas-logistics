"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRoute, faTimes } from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { formatFirestoreDate } from "@/app/utility/utilities";

function TimelineRow({ entry, isLast, isDark }) {
  return (
    <div className="flex gap-4">
      <div className="w-28 shrink-0 pt-1">
        <p className={`text-[11px] font-mono font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
          {entry.displayAt || formatFirestoreDate(entry.timestamp) || "—"}
        </p>
      </div>
      <div className="relative flex-1 pb-6">
        {!isLast && (
          <div
            className={`absolute left-[7px] top-3 bottom-0 w-0.5 ${
              isDark ? "bg-slate-700" : "bg-slate-200"
            }`}
          />
        )}
        <div
          className={`relative pl-6 p-3 rounded-xl border ${
            isDark
              ? "bg-slate-800/30 border-slate-700"
              : "bg-slate-50 border-slate-200"
          }`}
        >
          <div
            className={`absolute left-0 top-4 w-3.5 h-3.5 rounded-full border-2 ${
              isDark ? "bg-emerald-500 border-emerald-400" : "bg-emerald-500 border-white"
            }`}
          />
          <p className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
            {entry.label}
          </p>
          {entry.actorName && (
            <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {entry.actorName}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TripCustodyTimelineModal({
  isOpen,
  onClose,
  trip,
  milestones = [],
  isDark = false,
  user,
}) {
  const [auditEntries, setAuditEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const theme = getModalThemeClasses(isDark);
  const tripDocId = trip?.id || trip?.tripDocId;

  useEffect(() => {
    if (!isOpen || !tripDocId || !user) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/trips/${tripDocId}/audit-log`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!cancelled && res.ok) {
          setAuditEntries(json.entries || []);
        }
      } catch {
        if (!cancelled) setAuditEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, tripDocId, user]);

  if (!isOpen) return null;

  const combined = [
    ...milestones.map((m) => ({ ...m, kind: "milestone" })),
    ...auditEntries.slice(0, 30).map((entry) => ({
      key: entry.id,
      label: entry.action || "Activity",
      actorName: entry.user,
      displayAt: formatFirestoreDate(entry.timestamp),
      kind: "audit",
    })),
  ];

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col ${theme.panel}`}
      >
        <div className={`flex items-center justify-between px-5 py-4 border-b ${theme.header}`}>
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faRoute} className="text-emerald-500" />
            <div>
              <h3 className={`font-bold ${theme.title}`}>Chain of Custody Report</h3>
              <p className={`text-xs ${theme.muted}`}>{trip?.tripId || tripDocId}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className={theme.closeButton}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className={`text-sm ${theme.muted}`}>Loading timeline...</p>
          ) : combined.length === 0 ? (
            <p className={`text-sm ${theme.muted}`}>No custody events recorded.</p>
          ) : (
            combined.map((entry, index) => (
              <TimelineRow
                key={entry.key || `${entry.label}-${index}`}
                entry={entry}
                isLast={index === combined.length - 1}
                isDark={isDark}
              />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
