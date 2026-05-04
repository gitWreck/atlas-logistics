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
  faFilter,
  faHistory,
  faSearch,
  faShieldAlt,
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
  return String(value || "ACTION")
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getTarget(log) {
  return (
    log.targetId ||
    log.shipmentId ||
    log.trackingShipmentId ||
    log.tripId ||
    log.tripDocId ||
    log.invoiceId ||
    log.userId ||
    log.truckId ||
    "System"
  );
}

function getCollection(log) {
  return (
    log.targetCollection ||
    (log.shipmentId || log.trackingShipmentId ? "shipments" : null) ||
    (log.tripId || log.tripDocId ? "truck_trips" : null) ||
    (log.invoiceId ? "invoices" : null) ||
    "admin_logs"
  );
}

function stringifyDetails(log) {
  const details = log.details || log.meta || null;

  if (details && typeof details === "object") {
    const entries = Object.entries(details)
      .filter(([, value]) => value !== undefined && value !== null)
      .slice(0, 4)
      .map(([key, value]) => {
        const safeValue =
          typeof value === "object" ? JSON.stringify(value) : String(value);
        return `${formatLabel(key)}: ${safeValue}`;
      });

    if (entries.length > 0) return entries.join(" | ");
  }

  return (
    log.note ||
    log.reason ||
    log.status ||
    log.newStatus ||
    log.shipmentMode ||
    log.actorRole ||
    "No details"
  );
}

export default function RecentAdminLogs({ isDark = false }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [collectionFilter, setCollectionFilter] = useState("ALL");

  useEffect(() => {
    const q = query(
      collection(db, "admin_logs"),
      orderBy("createdAt", "desc"),
      limit(50),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const log = doc.data();

        return {
          id: doc.id,
          ...log,
          createdDate: toDate(log.createdAt || log.timestamp || log.at),
        };
      });

      setLogs(data);
    });

    return () => unsubscribe();
  }, []);

  const actionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          logs.map((log) => log.action || log.actionType).filter(Boolean),
        ),
      ).sort(),
    [logs],
  );

  const collectionOptions = useMemo(
    () => Array.from(new Set(logs.map(getCollection).filter(Boolean))).sort(),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return logs.filter((log) => {
      const action = log.action || log.actionType || "ACTION";
      const targetCollection = getCollection(log);
      const target = getTarget(log);
      const details = stringifyDetails(log);
      const searchable = [
        action,
        targetCollection,
        target,
        details,
        log.actorId,
        log.actorUid,
        log.actorName,
        log.actorRole,
        log.createdBy,
        log.updatedBy,
        log.status,
        log.newStatus,
        log.previousStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !keyword || searchable.includes(keyword);
      const matchesAction = actionFilter === "ALL" || action === actionFilter;
      const matchesCollection =
        collectionFilter === "ALL" || targetCollection === collectionFilter;

      return matchesSearch && matchesAction && matchesCollection;
    });
  }, [logs, search, actionFilter, collectionFilter]);

  const theme = getTableTheme(isDark);

  return (
    <div
      className={`border rounded-xl overflow-hidden flex flex-col h-full shadow-lg ${theme.container}`}
    >
      <div
        className={`px-5 py-4 border-b flex flex-col gap-3 sticky top-0 z-10 backdrop-blur-md ${theme.header}`}
      >
        <div className="flex items-center justify-between gap-3">
          <h3
            className={`${theme.logTitleIndigo} font-bold text-sm uppercase flex items-center gap-2`}
          >
            <FontAwesomeIcon icon={faShieldAlt} />
            Recent Logs
          </h3>
          <span
            className={`text-[10px] px-2 py-1 rounded-full border ${theme.countBadge}`}
          >
            {filteredLogs.length}/{logs.length}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_160px] gap-2">
          <div className="relative">
            <FontAwesomeIcon
              icon={faSearch}
              className={`absolute left-3 top-2.5 text-xs ${theme.inputIcon}`}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search action, target, actor..."
              className={`w-full border rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-indigo-500 ${theme.input}`}
            />
          </div>

          <div className="relative">
            <FontAwesomeIcon
              icon={faFilter}
              className={`absolute left-3 top-2.5 text-xs ${theme.inputIcon}`}
            />
            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className={`w-full border rounded-lg pl-8 pr-3 py-2 text-xs outline-none appearance-none focus:border-indigo-500 ${theme.input}`}
            >
              <option value="ALL">All Actions</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {formatLabel(action)}
                </option>
              ))}
            </select>
          </div>

          <select
            value={collectionFilter}
            onChange={(event) => setCollectionFilter(event.target.value)}
            className={`w-full border rounded-lg px-3 py-2 text-xs outline-none appearance-none focus:border-indigo-500 ${theme.input}`}
          >
            <option value="ALL">All Targets</option>
            {collectionOptions.map((targetCollection) => (
              <option key={targetCollection} value={targetCollection}>
                {formatLabel(targetCollection)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="md:hidden flex-1 overflow-auto custom-scrollbar max-h-[560px]">
        <div className="p-2 space-y-2">
          {filteredLogs.length === 0 ? (
            <div className={`px-4 py-10 text-center italic ${theme.emptyText}`}>
              {logs.length === 0
                ? "No admin logs recorded recently."
                : "No admin logs match the current filters."}
            </div>
          ) : (
            filteredLogs.map((log) => {
              const action = log.action || log.actionType || "ACTION";
              const targetCollection = getCollection(log);
              const target = getTarget(log);
              const actor =
                log.actorName ||
                log.actorId ||
                log.actorUid ||
                log.createdBy ||
                log.updatedBy ||
                "SYSTEM";
              const actorRole =
                log.actorRole || log.createdRole || log.updatedRole;

              return (
                <article
                  key={log.id}
                  className={`p-4 border rounded-lg transition-colors ${theme.mobileCard} ${theme.rowHover}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 border rounded px-2 py-1 text-[10px] font-bold ${theme.actionBadgeIndigo}`}
                    >
                      <FontAwesomeIcon icon={faHistory} />
                      {formatLabel(action)}
                    </span>
                    <span className={`text-[11px] ${theme.cellSecondary}`}>
                      {formatDistanceToNow(log.createdDate, {
                        addSuffix: true,
                      })}
                    </span>
                  </div>

                  <p
                    className={`mt-3 text-xs line-clamp-3 ${theme.logMessageText}`}
                  >
                    {stringifyDetails(log)}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <div className={theme.mobileCardMuted}>Target</div>
                      <div
                        className={`font-mono truncate ${theme.cellPrimary}`}
                      >
                        {target}
                      </div>
                      <div className={theme.cellSecondary}>
                        {formatLabel(targetCollection)}
                      </div>
                    </div>
                    <div>
                      <div className={theme.mobileCardMuted}>Actor</div>
                      <div className={`truncate ${theme.cellPrimary}`}>
                        {actor}
                      </div>
                      {actorRole && (
                        <div className={theme.cellSecondary}>
                          {formatLabel(actorRole)}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      <div className="hidden md:block flex-1 overflow-auto custom-scrollbar max-h-[520px]">
        <table
          className={`w-full min-w-[860px] text-left text-xs ${theme.tableText}`}
        >
          <thead className={`sticky top-0 z-[1] uppercase ${theme.thead}`}>
            <tr>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Target</th>
              <th className="px-4 py-3 font-semibold">Details</th>
              <th className="px-4 py-3 font-semibold">Actor</th>
              <th className="px-4 py-3 font-semibold text-right">Time</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${theme.tbodyDivide}`}>
            {filteredLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className={`px-4 py-10 text-center italic ${theme.emptyText}`}
                >
                  {logs.length === 0
                    ? "No admin logs recorded recently."
                    : "No admin logs match the current filters."}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const action = log.action || log.actionType || "ACTION";
                const targetCollection = getCollection(log);
                const target = getTarget(log);
                const actor =
                  log.actorName ||
                  log.actorId ||
                  log.actorUid ||
                  log.createdBy ||
                  log.updatedBy ||
                  "SYSTEM";
                const actorRole =
                  log.actorRole || log.createdRole || log.updatedRole;

                return (
                  <tr
                    key={log.id}
                    className={`transition-colors ${theme.rowHover}`}
                  >
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex items-center gap-1.5 border rounded px-2 py-1 font-bold ${theme.actionBadgeIndigo}`}
                      >
                        <FontAwesomeIcon
                          icon={faHistory}
                          className="text-[10px]"
                        />
                        {formatLabel(action)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 align-top ${theme.cellPrimary}`}>
                      <div
                        className="font-mono max-w-[190px] truncate"
                        title={target}
                      >
                        {target}
                      </div>
                      <div className={`mt-1 ${theme.cellSecondary}`}>
                        {formatLabel(targetCollection)}
                      </div>
                    </td>
                    <td
                      className={`px-4 py-3 align-top ${theme.logMessageText}`}
                    >
                      <div
                        className="line-clamp-2 max-w-[360px]"
                        title={stringifyDetails(log)}
                      >
                        {stringifyDetails(log)}
                      </div>
                    </td>
                    <td className={`px-4 py-3 align-top ${theme.cellPrimary}`}>
                      <div className="max-w-[180px] truncate" title={actor}>
                        {actor}
                      </div>
                      {actorRole && (
                        <div className={`mt-1 ${theme.cellSecondary}`}>
                          {formatLabel(actorRole)}
                        </div>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 align-top text-right whitespace-nowrap ${theme.cellSecondary}`}
                    >
                      {formatDistanceToNow(log.createdDate, {
                        addSuffix: true,
                      })}
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
