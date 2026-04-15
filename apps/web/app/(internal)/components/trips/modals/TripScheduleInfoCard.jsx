"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function TripScheduleInfoCard({ label, value, icon, theme }) {
  return (
    <div className={`rounded-xl border p-3 space-y-1 ${theme.panelSurface}`}>
      <div
        className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 ${theme.label}`}
      >
        <FontAwesomeIcon icon={icon} className="text-[10px]" />
        {label}
      </div>

      <div className={`text-sm font-semibold break-words ${theme.title}`}>
        {value || "—"}
      </div>
    </div>
  );
}
