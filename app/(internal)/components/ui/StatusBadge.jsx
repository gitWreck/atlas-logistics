import React from "react";

export default function StatusBadge({ status }) {
  const styles = {
    IN_TRANSIT: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    DELIVERED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    DELAYED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    ARRIVED_PORT: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    OUT_FOR_DELIVERY: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };

  const defaultStyle = "bg-slate-800 text-slate-400 border-slate-700";

  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
        styles[status] || defaultStyle
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
