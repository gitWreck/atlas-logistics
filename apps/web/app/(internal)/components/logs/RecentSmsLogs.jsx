"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  faBullhorn,
  faEnvelope,
  faFilter,
  faPaperPlane,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import { formatDistanceToNow } from "date-fns";
import { getTableTheme } from "@/app/utility/constant/theme";

function toDate(value) {
  if (!value) return new Date();
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatLabel(value) {
  return String(value || "MESSAGE")
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getDeliveryState(log) {
  const failed = Number(log.failedCount ?? log.failCount ?? 0);
  const sent = Number(log.successCount ?? log.sent ?? 0);

  if (log.error || failed > 0) {
    return sent > 0 ? "PARTIAL" : "FAILED";
  }

  return "SUCCESS";
}

function getTarget(log) {
  return (
    log.phone ||
    log.shipmentId ||
    log.trackingId ||
    log.tripId ||
    log.tripDocId ||
    log.invoiceId ||
    log.targetId ||
    "Batch"
  );
}

export default function RecentSmsLogs({ isDark = false }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    const q = query(
      collection(db, "sms_logs"),
      orderBy("at", "desc"),
      limit(50),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const log = doc.data();

        return {
          id: doc.id,
          ...log,
          sentAt: toDate(log.at || log.createdAt || log.timestamp),
        };
      });

      setLogs(data);
    });

    return () => unsubscribe();
  }, []);

  const typeOptions = useMemo(
    () =>
      Array.from(
        new Set(logs.map((log) => log.type || log.action).filter(Boolean)),
      ).sort(),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return logs.filter((log) => {
      const type = log.type || log.action || "MESSAGE";
      const deliveryState = getDeliveryState(log);
      const searchable = [
        type,
        deliveryState,
        log.status,
        log.message,
        log.phone,
        log.shipmentId,
        log.trackingId,
        log.tripId,
        log.tripDocId,
        log.invoiceId,
        log.targetId,
        log.requestedBy,
        log.actorId,
        log.provider,
        log.error,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !keyword || searchable.includes(keyword);
      const matchesType = typeFilter === "ALL" || type === typeFilter;
      const matchesStatus =
        statusFilter === "ALL" || deliveryState === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [logs, search, typeFilter, statusFilter]);

  const theme = getTableTheme(isDark);

  const statusClasses = {
    SUCCESS: theme.statusSuccess,
    PARTIAL: theme.statusWarning,
    FAILED: theme.statusDanger,
  };

  return (
    <div
      className={`border rounded-xl overflow-hidden flex flex-col h-full shadow-lg ${theme.container}`}
    >
      <div
        className={`px-5 py-4 border-b flex flex-col gap-3 sticky top-0 z-10 backdrop-blur-md ${theme.header}`}
      >
        <div className="flex items-center justify-between gap-3">
          <h3
            className={`${theme.logTitleBlue} font-bold text-sm uppercase flex items-center gap-2`}
          >
            <FontAwesomeIcon icon={faEnvelope} />
            Outgoing Message Logs
          </h3>
          <span
            className={`text-[10px] px-2 py-1 rounded-full border ${theme.countBadge}`}
          >
            {filteredLogs.length}/{logs.length}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px_130px] gap-2">
          <div className="relative">
            <FontAwesomeIcon
              icon={faSearch}
              className={`absolute left-3 top-2.5 text-xs ${theme.inputIcon}`}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search message, target, actor..."
              className={`w-full border rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-blue-500 ${theme.input}`}
            />
          </div>

          <div className="relative">
            <FontAwesomeIcon
              icon={faFilter}
              className={`absolute left-3 top-2.5 text-xs ${theme.inputIcon}`}
            />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className={`w-full border rounded-lg pl-8 pr-3 py-2 text-xs outline-none appearance-none focus:border-blue-500 ${theme.input}`}
            >
              <option value="ALL">All Types</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {formatLabel(type)}
                </option>
              ))}
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={`w-full border rounded-lg px-3 py-2 text-xs outline-none appearance-none focus:border-blue-500 ${theme.input}`}
          >
            <option value="ALL">All Results</option>
            <option value="SUCCESS">Success</option>
            <option value="PARTIAL">Partial</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      <div className="md:hidden flex-1 overflow-auto custom-scrollbar max-h-[520px]">
        <div className="p-2 space-y-2">
          {filteredLogs.length === 0 ? (
            <div className={`px-4 py-10 text-center italic ${theme.emptyText}`}>
              {logs.length === 0
                ? "No messages sent recently."
                : "No messages match the current filters."}
            </div>
          ) : (
            filteredLogs.map((log) => {
              const type = log.type || log.action || "MESSAGE";
              const isBroadcast = type.includes("BROADCAST");
              const deliveryState = getDeliveryState(log);
              const successCount = Number(log.successCount ?? log.sent ?? 0);
              const totalTargets = Number(log.totalTargets || 0);
              const target = getTarget(log);

              return (
                <article
                  key={log.id}
                  className={`p-4 border rounded-lg transition-colors ${theme.mobileCard} ${theme.rowHover}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 border rounded px-2 py-1 text-[10px] font-bold ${theme.roleBadge}`}
                    >
                      <FontAwesomeIcon
                        icon={isBroadcast ? faBullhorn : faPaperPlane}
                      />
                      {formatLabel(type)}
                    </span>
                    <span
                      className={`border rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClasses[deliveryState]}`}
                    >
                      {deliveryState}
                    </span>
                  </div>

                  <p
                    className={`mt-3 text-xs line-clamp-3 ${theme.logMessageText}`}
                  >
                    {log.message || log.error || "No message body"}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <div className={theme.mobileCardMuted}>Target</div>
                      <div
                        className={`font-mono truncate ${theme.cellPrimary}`}
                      >
                        {target}
                      </div>
                    </div>
                    <div>
                      <div className={theme.mobileCardMuted}>Sent</div>
                      <div className={`font-mono ${theme.cellPrimary}`}>
                        {totalTargets > 0
                          ? `${successCount}/${totalTargets}`
                          : "1/1"}
                      </div>
                    </div>
                    <div>
                      <div className={theme.mobileCardMuted}>By</div>
                      <div className={`truncate ${theme.cellPrimary}`}>
                        {log.requestedBy || log.actorId || "SYSTEM"}
                      </div>
                    </div>
                    <div>
                      <div className={theme.mobileCardMuted}>Time</div>
                      <div className={theme.cellSecondary}>
                        {formatDistanceToNow(log.sentAt, { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      <div className="hidden md:block flex-1 overflow-auto custom-scrollbar max-h-[420px]">
        <table
          className={`w-full min-w-[760px] text-left text-xs ${theme.tableText}`}
        >
          <thead className={`sticky top-0 z-[1] uppercase ${theme.thead}`}>
            <tr>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Target</th>
              <th className="px-4 py-3 font-semibold">Message</th>
              <th className="px-4 py-3 font-semibold">Sent</th>
              <th className="px-4 py-3 font-semibold">Result</th>
              <th className="px-4 py-3 font-semibold text-right">Time</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${theme.tbodyDivide}`}>
            {filteredLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className={`px-4 py-10 text-center italic ${theme.emptyText}`}
                >
                  {logs.length === 0
                    ? "No messages sent recently."
                    : "No messages match the current filters."}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                // console.log("Rendering log:", log);
                const type = log.type || log.action || "MESSAGE";
                const isBroadcast = type.includes("BROADCAST");
                const deliveryState = getDeliveryState(log);
                const successCount = Number(log.successCount ?? log.sent ?? 0);
                const totalTargets = Number(log.totalTargets || 0);
                const target = getTarget(log);

                return (
                  <tr
                    key={log.id}
                    className={`transition-colors ${theme.rowHover}`}
                  >
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex items-center gap-1.5 border rounded px-2 py-1 font-bold ${theme.roleBadge}`}
                      >
                        <FontAwesomeIcon
                          icon={isBroadcast ? faBullhorn : faPaperPlane}
                          className="text-[10px]"
                        />
                        {formatLabel(type)}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 align-top font-mono ${theme.cellPrimary}`}
                    >
                      <div className="max-w-[150px] truncate" title={target}>
                        {target}
                      </div>
                      <div className={`mt-1 font-sans ${theme.cellSecondary}`}>
                        {log.actorName ||
                          log.provider ||
                          log.requestedBy ||
                          "SYSTEM"}
                      </div>
                    </td>
                    <td
                      className={`px-4 py-3 align-top ${theme.logMessageText}`}
                    >
                      <div
                        className="line-clamp-2 max-w-[300px]"
                        title={log.message || ""}
                      >
                        {log.message || log.error || "No message body"}
                      </div>
                      {log.error && (
                        <div className="mt-1 text-red-500 line-clamp-1">
                          {log.error}
                        </div>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 align-top font-mono ${theme.cellPrimary}`}
                    >
                      {totalTargets > 0
                        ? `${successCount}/${totalTargets}`
                        : "1/1"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`border rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClasses[deliveryState]}`}
                      >
                        {deliveryState}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 align-top text-right whitespace-nowrap ${theme.cellSecondary}`}
                    >
                      {formatDistanceToNow(log.sentAt, { addSuffix: true })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
