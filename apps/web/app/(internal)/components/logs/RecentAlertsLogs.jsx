"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faClock,
  faFilter,
  faListOl,
  faSearch,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { formatDistanceToNow } from "date-fns";
import { getTableTheme } from "@/app/utility/constant/theme";

const LIMIT_OPTIONS = ["50", "100", "200", "all"];

function toDate(value) {
  if (!value) return new Date();
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatLabel(value) {
  return String(value || "PENDING")
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getDetails(alert) {
  return alert.details && typeof alert.details === "object"
    ? alert.details
    : {};
}

function getStatus(alert) {
  return String(alert.status || alert.newStatus || "PENDING").toUpperCase();
}

function getReason(alert) {
  if (alert.logKind === "staff_action") {
    return alert.action || alert.actionType || "Staff Action";
  }

  const details = getDetails(alert);
  return details.reason || alert.reason || alert.type || "Delay Reported";
}

function getDriverName(alert) {
  if (alert.logKind === "staff_action") {
    return (
      alert.actorName ||
      alert.actorId ||
      alert.actorUid ||
      alert.createdBy ||
      alert.updatedBy ||
      "Staff"
    );
  }

  const details = getDetails(alert);
  return details.driverName || alert.driverName || "Unknown Driver";
}

function getNotes(alert) {
  if (alert.logKind === "staff_action") {
    const details = alert.details || alert.meta || null;

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
      alert.note ||
      alert.reason ||
      alert.status ||
      alert.newStatus ||
      alert.actorRole ||
      "No details"
    );
  }

  const details = getDetails(alert);
  return details.notes || alert.notes || "No additional notes";
}

function getTarget(alert) {
  return (
    alert.tripId ||
    alert.targetId ||
    alert.packageId ||
    alert.trackingPackageId ||
    alert.trackingNumber ||
    alert.shipmentId ||
    alert.trackingShipmentId ||
    alert.tripDocId ||
    alert.invoiceId ||
    alert.userId ||
    alert.truckId ||
    "System"
  );
}

function getActorRole(alert) {
  return String(
    alert.actorRole || alert.createdRole || alert.updatedRole || "",
  ).toLowerCase();
}

function isStaffAction(log) {
  return ["admin", "manager"].includes(getActorRole(log));
}

export default function RecentAlertsLogs({ isDark = false }) {
  const [delayAlerts, setDelayAlerts] = useState([]);
  const [staffLogs, setStaffLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [reasonFilter, setReasonFilter] = useState("ALL");
  const [limitValue, setLimitValue] = useState("50");

  useEffect(() => {
    const queryConstraints = [
      where("type", "==", "DELAY_REPORT"),
      orderBy("createdAt", "desc"),
    ];

    if (limitValue !== "all") {
      queryConstraints.push(limit(Number(limitValue)));
    }

    const q = query(collection(db, "admin_alerts"), ...queryConstraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const alert = doc.data();

        return {
          id: doc.id,
          logKind: "delay_alert",
          ...alert,
          createdDate: toDate(alert.createdAt || alert.timestamp || alert.at),
        };
      });

      setDelayAlerts(data);
    });

    return () => unsubscribe();
  }, [limitValue]);

  useEffect(() => {
    const queryConstraints = [orderBy("createdAt", "desc")];

    if (limitValue !== "all") {
      queryConstraints.push(limit(Number(limitValue)));
    }

    const q = query(collection(db, "admin_logs"), ...queryConstraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map((doc) => {
          const log = doc.data();

          return {
            id: doc.id,
            logKind: "staff_action",
            ...log,
            createdDate: toDate(log.createdAt || log.timestamp || log.at),
          };
        })
        .filter(isStaffAction);

      setStaffLogs(data);
    });

    return () => unsubscribe();
  }, [limitValue]);

  const alerts = useMemo(() => {
    const combined = [...delayAlerts, ...staffLogs].sort(
      (a, b) => b.createdDate.getTime() - a.createdDate.getTime(),
    );

    if (limitValue === "all") return combined;
    return combined.slice(0, Number(limitValue));
  }, [delayAlerts, staffLogs, limitValue]);

  const statusOptions = useMemo(
    () => Array.from(new Set(alerts.map(getStatus))).sort(),
    [alerts],
  );

  const reasonOptions = useMemo(
    () =>
      Array.from(
        new Set(alerts.map((alert) => String(getReason(alert))).filter(Boolean)),
      ).sort(),
    [alerts],
  );

  const filteredAlerts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return alerts.filter((alert) => {
      const status = getStatus(alert);
      const reason = String(getReason(alert));
      const searchable = [
        status,
        reason,
        alert.tripId,
        getTarget(alert),
        alert.targetId,
        alert.actorId,
        alert.actorName,
        alert.actorRole,
        getDriverName(alert),
        getNotes(alert),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !keyword || searchable.includes(keyword);
      const matchesStatus =
        statusFilter === "ALL" || status === statusFilter;
      const matchesReason =
        reasonFilter === "ALL" || reason === reasonFilter;

      return matchesSearch && matchesStatus && matchesReason;
    });
  }, [alerts, search, statusFilter, reasonFilter]);

  const theme = getTableTheme(isDark);

  const statusClasses = {
    UNREAD: theme.statusWarning,
    PENDING: theme.statusWarning,
    APPROVED: theme.statusSuccess,
    RESOLVED: theme.statusSuccess,
    COMPLETED: theme.statusSuccess,
    SUCCESS: theme.statusSuccess,
    READ: theme.roleBadge,
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
            className={`${theme.logTitleAmber} font-bold text-sm uppercase flex items-center gap-2`}
          >
            <FontAwesomeIcon icon={faTriangleExclamation} />
            Recent Delays & Staff Actions
          </h3>
          <span
            className={`text-[10px] px-2 py-1 rounded-full border ${theme.countBadge}`}
          >
            {filteredAlerts.length}/{alerts.length}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-[1fr_140px_160px_132px] gap-2">
          <div className="relative col-span-2 sm:col-span-1">
            <FontAwesomeIcon
              icon={faSearch}
              className={`absolute left-3 top-2.5 text-xs ${theme.inputIcon}`}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search trip, driver, reason..."
              className={`w-full border rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-amber-500 ${theme.input}`}
            />
          </div>

          <div className="relative min-w-0">
            <FontAwesomeIcon
              icon={faFilter}
              className={`absolute left-3 top-2.5 text-xs ${theme.inputIcon}`}
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={`w-full border rounded-lg pl-8 pr-3 py-2 text-xs outline-none appearance-none focus:border-amber-500 ${theme.input}`}
            >
              <option value="ALL">All Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </div>

          <select
            value={reasonFilter}
            onChange={(event) => setReasonFilter(event.target.value)}
            className={`w-full min-w-0 border rounded-lg px-3 py-2 text-xs outline-none appearance-none focus:border-amber-500 ${theme.input}`}
          >
            <option value="ALL">All Reasons</option>
            {reasonOptions.map((reason) => (
              <option key={reason} value={reason}>
                {formatLabel(reason)}
              </option>
            ))}
          </select>

          <div className="relative col-span-2 sm:col-span-1">
            <FontAwesomeIcon
              icon={faListOl}
              className={`absolute left-3 top-2.5 text-xs ${theme.inputIcon}`}
            />
            <select
              value={limitValue}
              onChange={(event) => setLimitValue(event.target.value)}
              title="Alert log fetch limit"
              className={`w-full border rounded-lg pl-8 pr-3 py-2 text-xs outline-none appearance-none focus:border-amber-500 ${theme.input}`}
            >
              {LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All Logs" : `Latest ${option}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="md:hidden flex-1 overflow-auto custom-scrollbar max-h-[520px]">
        <div className="p-2 space-y-2">
          {filteredAlerts.length === 0 ? (
            <div className={`px-4 py-10 text-center italic ${theme.emptyText}`}>
              {alerts.length === 0
                ? "No delay or staff action logs recorded."
                : "No logs match the current filters."}
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const status = getStatus(alert);
              const reason = getReason(alert);
              const target = getTarget(alert);
              const actorLabel =
                alert.logKind === "staff_action" ? "Actor" : "Driver";

              return (
                <article
                  key={alert.id}
                  className={`p-4 border rounded-lg transition-colors ${theme.mobileCard} ${theme.rowHover}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 border rounded px-2 py-1 text-[10px] font-bold ${theme.statusWarning}`}
                    >
                      <FontAwesomeIcon icon={faTriangleExclamation} />
                      {formatLabel(reason)}
                    </span>
                    <span
                      className={`border rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        statusClasses[status] || theme.roleBadge
                      }`}
                    >
                      {formatLabel(status)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <div className={theme.mobileCardMuted}>Target</div>
                      <div className={`font-mono truncate ${theme.cellPrimary}`}>
                        {target}
                      </div>
                    </div>
                    <div>
                      <div className={theme.mobileCardMuted}>{actorLabel}</div>
                      <div className={`truncate ${theme.cellPrimary}`}>
                        {getDriverName(alert)}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className={theme.mobileCardMuted}>Notes</div>
                      <p className={`line-clamp-2 ${theme.logMessageText}`}>
                        {getNotes(alert)}
                      </p>
                    </div>
                    <div className="col-span-2 flex items-center gap-1 text-[10px]">
                      <FontAwesomeIcon
                        icon={
                          ["RESOLVED", "APPROVED"].includes(status)
                            ? faCheckCircle
                            : faClock
                        }
                        className={
                          ["RESOLVED", "APPROVED"].includes(status)
                            ? "text-emerald-500"
                            : "text-amber-500"
                        }
                      />
                      <span className={theme.cellSecondary}>
                        {formatDistanceToNow(alert.createdDate, {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      <div className="hidden md:block flex-1 overflow-auto custom-scrollbar max-h-[420px]">
        <table className={`w-full min-w-[760px] text-left text-xs ${theme.tableText}`}>
          <thead className={`sticky top-0 z-[1] uppercase ${theme.thead}`}>
            <tr>
              <th className="px-4 py-3 font-semibold">Target</th>
              <th className="px-4 py-3 font-semibold">Driver / Actor</th>
              <th className="px-4 py-3 font-semibold">Reason / Action</th>
              <th className="px-4 py-3 font-semibold">Notes</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Time</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${theme.tbodyDivide}`}>
            {filteredAlerts.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className={`px-4 py-10 text-center italic ${theme.emptyText}`}
                >
                  {alerts.length === 0
                    ? "No alerts recorded."
                    : "No alerts match the current filters."}
                </td>
              </tr>
            ) : (
              filteredAlerts.map((alert) => {
                const status = getStatus(alert);
                const reason = getReason(alert);
                const target = getTarget(alert);
                const actorLabel =
                  alert.logKind === "staff_action" ? "Actor" : "Driver";

                return (
                  <tr
                    key={alert.id}
                    className={`transition-colors ${theme.rowHover}`}
                  >
                    <td
                      className={`px-4 py-3 align-top font-mono ${theme.cellPrimary}`}
                    >
                      {target}
                    </td>
                    <td className={`px-4 py-3 align-top ${theme.cellPrimary}`}>
                      <div className="max-w-[180px] truncate">
                        {getDriverName(alert)}
                      </div>
                      <div className={`mt-1 text-[10px] ${theme.cellSecondary}`}>
                        {actorLabel}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex items-center gap-1.5 border rounded px-2 py-1 font-bold ${theme.statusWarning}`}
                      >
                        <FontAwesomeIcon
                          icon={faTriangleExclamation}
                          className="text-[10px]"
                        />
                        {formatLabel(reason)}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 align-top ${theme.logMessageText}`}
                    >
                      <div className="line-clamp-2 max-w-[260px]">
                        {getNotes(alert)}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          statusClasses[status] || theme.roleBadge
                        }`}
                      >
                        <FontAwesomeIcon
                          icon={
                            ["RESOLVED", "APPROVED"].includes(status)
                              ? faCheckCircle
                              : faClock
                          }
                        />
                        {formatLabel(status)}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 align-top text-right whitespace-nowrap ${theme.cellSecondary}`}
                    >
                      {formatDistanceToNow(alert.createdDate, {
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
