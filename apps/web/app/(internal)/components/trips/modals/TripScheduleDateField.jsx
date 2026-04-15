"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

function getDayLabel(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PH", {
    weekday: "long",
  });
}

function formatDisplayDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TripScheduleDateField({
  label,
  icon,
  value,
  onChange,
  theme,
  type = "datetime-local",
  disabled = false,
}) {
  const dayLabel = getDayLabel(value);

  return (
    <div className="space-y-2">
      <label
        className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 ${theme.label}`}
      >
        <FontAwesomeIcon icon={icon} className="text-[10px]" />
        {label}
      </label>

      <div className="space-y-2">
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors ${theme.input}`}
        />

        <div
          className={`rounded-xl border px-3 py-2 text-xs flex items-center justify-between gap-3 ${theme.input}`}
        >
          <span className={`font-semibold ${theme.title}`}>{dayLabel}</span>
          <span className={theme.helperText}>
            {formatDisplayDateTime(value)}
          </span>
        </div>
      </div>
    </div>
  );
}
