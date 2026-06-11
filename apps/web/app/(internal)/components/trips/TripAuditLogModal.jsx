"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardList, faTimes } from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { useAuth } from "@/app/context/AuthContext";
import { formatFirestoreDate } from "@/app/utility/utilities";

function formatAuditValue(value) {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function TripAuditLogModal({
  isOpen,
  onClose,
  trip,
  isDark = false,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState([]);
  const { user } = useAuth();
  const theme = getModalThemeClasses(isDark);

  const tripDocId = trip?.id || trip?.tripDocId;
  const tripCode = trip?.tripId || tripDocId;

  useEffect(() => {
    if (!isOpen || !tripDocId || !user) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      setEntries([]);

      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/trips/${tripDocId}/audit-log`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load audit log.");
        }

        if (!cancelled) {
          setEntries(payload.entries || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load audit log.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, tripDocId, user]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 99999 }}
    >
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-3xl max-h-[85vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${theme.modal}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`px-5 py-4 border-b flex justify-between items-center shrink-0 ${theme.header}`}
        >
          <h3
            className={`font-bold text-sm uppercase flex items-center gap-2 ${theme.title}`}
          >
            <FontAwesomeIcon icon={faClipboardList} />
            Trip Audit Log — {tripCode}
          </h3>
          <button type="button" onClick={onClose} className={theme.closeButton}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {loading && (
            <p className={`text-sm ${theme.label}`}>Loading audit entries...</p>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {!loading && !error && entries.length === 0 && (
            <p className={`text-sm ${theme.label}`}>No audit entries found.</p>
          )}

          {entries.map((entry) => (
            <div
              key={`${entry.source || "log"}-${entry.id}`}
              className={`rounded-xl border p-3 text-xs ${isDark ? "border-slate-700 bg-slate-950/40" : "border-slate-200 bg-slate-50"}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                <span className="font-bold uppercase tracking-wide">
                  {entry.action || "EVENT"}
                </span>
                <span className={theme.label}>
                  {formatFirestoreDate(entry.timestamp)}
                </span>
                {entry.user && (
                  <span className={theme.label}>by {entry.user}</span>
                )}
                {entry.source && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-600"}`}
                  >
                    {entry.source}
                  </span>
                )}
              </div>

              {entry.reason && (
                <p className={`mb-2 ${theme.label}`}>
                  <span className="font-semibold">Reason:</span> {entry.reason}
                </p>
              )}

              {entry.note && entry.note !== entry.action && (
                <p className={`mb-2 ${theme.label}`}>{entry.note}</p>
              )}

              <div className="grid md:grid-cols-2 gap-2">
                <div>
                  <div className={`font-semibold mb-1 ${theme.label}`}>
                    Previous
                  </div>
                  <pre
                    className={`whitespace-pre-wrap break-words rounded p-2 text-[10px] max-h-32 overflow-y-auto ${isDark ? "bg-slate-900" : "bg-white border border-slate-200"}`}
                  >
                    {formatAuditValue(entry.previousValue)}
                  </pre>
                </div>
                <div>
                  <div className={`font-semibold mb-1 ${theme.label}`}>
                    New
                  </div>
                  <pre
                    className={`whitespace-pre-wrap break-words rounded p-2 text-[10px] max-h-32 overflow-y-auto ${isDark ? "bg-slate-900" : "bg-white border border-slate-200"}`}
                  >
                    {formatAuditValue(entry.newValue)}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
