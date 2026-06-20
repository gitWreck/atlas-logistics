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
  faBell,
  faEnvelope,
  faFilter,
  faMobileScreen,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import { formatDistanceToNow } from "date-fns";
import { getTableTheme } from "@/app/utility/constant/theme";
import { retryCustomerNotification } from "@/app/utility/FirebaseFunctions";

const LIMIT_OPTIONS = ["50", "100", "200"];

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatLabel(value) {
  return String(value || "")
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function channelIcon(channel) {
  const key = String(channel || "").toUpperCase();
  if (key === "EMAIL") return faEnvelope;
  if (key === "PUSH") return faBell;
  return faMobileScreen;
}

function statusClass(status, theme) {
  const key = String(status || "").toLowerCase();
  if (key === "sent") return theme.statusSuccess;
  if (key === "failed") return theme.statusDanger;
  if (key === "pending" || key === "queued") return theme.statusWarning;
  return theme.cellSecondary;
}

function formatStatusLabel(log = {}) {
  const status = String(log.status || "unknown").toUpperCase();
  const providerStatus = String(log.providerStatus || "").trim();
  if (providerStatus && log.channel === "SMS") {
    return `${status} · ${providerStatus}`;
  }
  return status;
}

export default function NotificationHistory({ isDark = false }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [limitValue, setLimitValue] = useState("100");
  const [retryingId, setRetryingId] = useState(null);

  const theme = getTableTheme(isDark);

  const handleRetry = async (dedupKey) => {
    if (!dedupKey || retryingId) return;

    setRetryingId(dedupKey);
    try {
      await retryCustomerNotification({ dedupKey });
    } catch (error) {
      console.error("Notification retry failed:", error);
      window.alert(error?.message || "Failed to retry notification.");
    } finally {
      setRetryingId(null);
    }
  };

  useEffect(() => {
    const constraints = [orderBy("createdAt", "desc")];
    if (limitValue !== "all") {
      constraints.push(limit(Number(limitValue)));
    }

    const q = query(collection(db, "notificationLogs"), ...constraints);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [limitValue]);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return logs.filter((log) => {
      if (channelFilter !== "ALL" && log.channel !== channelFilter) {
        return false;
      }
      if (
        statusFilter !== "ALL" &&
        String(log.status).toUpperCase() !== statusFilter
      ) {
        return false;
      }
      if (!term) return true;

      const haystack = [
        log.id,
        log.customerId,
        log.customerPhone,
        log.customerEmail,
        log.tripId,
        log.notificationType,
        log.channel,
        log.source,
        ...(Array.isArray(log.shipmentIds) ? log.shipmentIds : []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [logs, search, channelFilter, statusFilter]);

  return (
    <section
      className={`mt-6 border rounded-xl overflow-hidden shadow-lg ${theme.container}`}
    >
      <div
        className={`px-5 py-4 border-b flex flex-col gap-3 ${theme.header}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3
              className={`${theme.logTitleBlue} font-bold text-sm uppercase flex items-center gap-2`}
            >
              <FontAwesomeIcon icon={faBell} />
              Customer Notification History
            </h3>
            <p className={`text-xs mt-1 ${theme.cellSecondary}`}>
              Deduplicated SMS, email, and push delivery audit log.
            </p>
          </div>
          <span
            className={`text-[10px] px-2 py-1 rounded-full border ${theme.countBadge}`}
          >
            {filteredLogs.length} records
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="relative md:col-span-2">
            <FontAwesomeIcon
              icon={faSearch}
              className={`absolute left-3 top-2.5 text-xs ${theme.inputIcon}`}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, trip, shipment, type..."
              className={`w-full pl-8 pr-3 py-2 rounded-lg border text-xs ${theme.input}`}
            />
          </label>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className={`rounded-lg border px-3 py-2 text-xs ${theme.input}`}
          >
            <option value="ALL">All channels</option>
            <option value="SMS">SMS</option>
            <option value="EMAIL">Email</option>
            <option value="PUSH">Push</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`rounded-lg border px-3 py-2 text-xs ${theme.input}`}
          >
            <option value="ALL">All statuses</option>
            <option value="SENT">Sent</option>
            <option value="QUEUED">Queued</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <FontAwesomeIcon icon={faFilter} className={theme.inputIcon} />
          <span className={theme.cellSecondary}>Show</span>
          {LIMIT_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setLimitValue(value)}
              className={`px-2 py-1 rounded border text-[10px] font-bold ${
                limitValue === value ? theme.roleBadge : theme.neutralBadge
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className={`w-full min-w-[900px] text-left text-xs ${theme.tableText}`}>
          <thead className={`uppercase ${theme.thead}`}>
            <tr>
              {[
                "Channel",
                "Type",
                "Customer",
                "Trip",
                "Shipments",
                "Status",
                "Source",
                "Sent",
                "Actions",
              ].map((heading) => (
                <th key={heading} className="px-4 py-3 font-bold">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y ${theme.tbodyDivide}`}>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={9} className={`px-4 py-10 text-center italic ${theme.emptyText}`}>
                  No notification logs found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const sentAt = toDate(log.sentAt) || toDate(log.createdAt);
                return (
                  <tr key={log.id} className={theme.rowHover}>
                    <td className={`px-4 py-3 ${theme.cellPrimary}`}>
                      <span className="inline-flex items-center gap-2">
                        <FontAwesomeIcon icon={channelIcon(log.channel)} />
                        {log.channel || "—"}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${theme.cellPrimary}`}>
                      {formatLabel(log.notificationType)}
                    </td>
                    <td className={`px-4 py-3 font-mono ${theme.cellPrimary}`}>
                      {log.customerPhone || log.customerEmail || log.customerId || "—"}
                    </td>
                    <td className={`px-4 py-3 font-mono ${theme.cellPrimary}`}>
                      {log.tripId || "—"}
                    </td>
                    <td className={`px-4 py-3 ${theme.cellPrimary}`}>
                      {log.shipmentCount || (log.shipmentIds || []).length || 0}
                    </td>
                    <td className={`px-4 py-3 font-semibold ${statusClass(log.status, theme)}`}>
                      <div>{formatStatusLabel(log)}</div>
                      {log.providerMessageId ? (
                        <div className={`text-[10px] font-normal mt-1 ${theme.cellSecondary}`}>
                          Semaphore #{log.providerMessageId}
                          {log.providerNetwork ? ` · ${log.providerNetwork}` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td className={`px-4 py-3 ${theme.cellSecondary}`}>
                      {formatLabel(log.source)}
                    </td>
                    <td className={`px-4 py-3 ${theme.cellSecondary}`}>
                      {sentAt
                        ? formatDistanceToNow(sentAt, { addSuffix: true })
                        : "—"}
                    </td>
                    <td className={`px-4 py-3 ${theme.cellSecondary}`}>
                      {String(log.status || "").toLowerCase() === "failed" ||
                      String(log.status || "").toLowerCase() === "queued" ? (
                        <button
                          type="button"
                          disabled={retryingId === log.id}
                          onClick={() => handleRetry(log.id)}
                          className={`px-2 py-1 rounded border text-[10px] font-bold ${theme.editButton}`}
                        >
                          {retryingId === log.id ? "Retrying..." : "Retry"}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
