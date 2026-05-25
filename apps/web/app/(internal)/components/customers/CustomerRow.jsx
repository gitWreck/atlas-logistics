"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisV,
  faEnvelope,
  faLocationDot,
  faPhone,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";
import { getRowThemeClasses } from "@/app/utility/constant/theme";

function getCustomerStatus(customer) {
  return String(
    customer?.status || (customer?.active === false ? "inactive" : "active"),
  ).toLowerCase();
}

function getCustomerId(customer) {
  return (
    customer?.publicId ||
    customer?.userCode ||
    customer?.customerCode ||
    customer?.uid ||
    customer?.id ||
    "N/A"
  );
}

function getAddressLine(address = {}) {
  return [
    address.street,
    address.barangay,
    address.city,
    address.province,
    address.zipCode || address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function StatusDot({ status }) {
  const color =
    status === "active"
      ? "bg-emerald-500"
      : status === "suspended"
        ? "bg-amber-500"
        : "bg-slate-400";

  return (
    <div className="relative flex items-center justify-center w-3 h-3 shrink-0">
      {status === "active" && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </div>
  );
}

export default function CustomerRow({ customer, onClick, isDark = false }) {
  const theme = getRowThemeClasses(isDark);
  const status = getCustomerStatus(customer);
  const addressLine = getAddressLine(customer.address);
  const lastSeen = formatFirestoreDate(customer.lastAuthAt || customer.updatedAt);

  const statusClass =
    status === "active"
      ? isDark
        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        : "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "suspended"
        ? isDark
          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
          : "bg-amber-50 text-amber-700 border-amber-200"
        : isDark
          ? "bg-slate-800 text-slate-400 border-slate-700"
          : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <div
      className={`relative flex flex-col gap-3 p-4 border-b cursor-pointer transition-colors group md:grid md:grid-cols-12 md:gap-4 md:px-6 md:items-center ${theme.rowBorder} ${theme.rowDefaultHover}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick?.();
      }}
    >
      <div className="flex md:hidden justify-between items-start">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-1">
            <StatusDot status={status} />
          </div>
          <div className="min-w-0">
            <div
              className={`font-semibold truncate flex items-center gap-2 ${theme.primaryText}`}
            >
              <FontAwesomeIcon icon={faUser} className="text-[11px]" />
              {customer.name || "Unnamed customer"}
            </div>
            <div className={`text-[10px] font-mono ${theme.mutedText}`}>
              {getCustomerId(customer)}
            </div>
          </div>
        </div>

        <button
          type="button"
          className={`p-2 -mr-2 rounded ${theme.actionButton}`}
          onClick={(event) => {
            event.stopPropagation();
            onClick?.();
          }}
          aria-label="View customer"
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>

      <div className="md:col-span-3 flex items-center gap-4 min-w-0">
        <div className="hidden md:block">
          <StatusDot status={status} />
        </div>
        <div className="min-w-0">
          <div
            className={`hidden md:flex items-center gap-2 font-semibold truncate ${theme.primaryText}`}
          >
            <FontAwesomeIcon icon={faUser} className="text-[11px]" />
            <span className="truncate">
              {customer.name || "Unnamed customer"}
            </span>
          </div>
          <div className={`text-[10px] font-mono mt-0.5 ${theme.mutedText}`}>
            {getCustomerId(customer)}
          </div>
        </div>
      </div>

      <div
        className={`md:col-span-3 flex flex-col gap-1 border-t md:border-0 pt-2 md:pt-0 min-w-0 ${theme.rowBorder}`}
      >
        <div className={`text-sm truncate ${theme.secondaryText}`}>
          <FontAwesomeIcon icon={faEnvelope} className="mr-2 text-[11px]" />
          {customer.email || "No email"}
        </div>
        <div className={`text-xs truncate ${theme.mutedText}`}>
          <FontAwesomeIcon icon={faPhone} className="mr-2 text-[11px]" />
          {customer.phoneNumber || customer.phone || "No phone"}
        </div>
      </div>

      <div className="md:col-span-3 min-w-0">
        <div className={`text-sm truncate ${theme.secondaryText}`}>
          <FontAwesomeIcon icon={faLocationDot} className="mr-2 text-[11px]" />
          {addressLine || "No address"}
        </div>
        <div className={`text-[10px] mt-0.5 ${theme.mutedText}`}>
          {lastSeen ? `Updated ${lastSeen}` : "No activity recorded"}
        </div>
      </div>

      <div className="md:col-span-2 flex items-center gap-2">
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusClass}`}
        >
          {status}
        </span>
      </div>

      <div className="hidden md:block md:col-span-1 text-right">
        <button
          type="button"
          className={`p-2 rounded-full transition-colors ${theme.actionButton}`}
          onClick={(event) => {
            event.stopPropagation();
            onClick?.();
          }}
          aria-label="View customer"
        >
          <FontAwesomeIcon icon={faEllipsisV} />
        </button>
      </div>
    </div>
  );
}
