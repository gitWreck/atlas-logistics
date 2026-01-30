import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faExclamationTriangle,
  faTruckFast,
} from "@fortawesome/free-solid-svg-icons";

export default function ManagerStatistics({ stats, loading }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard
        title="Total Shipments"
        value={stats.total}
        icon={faBoxOpen}
        color="text-blue-400"
        bg="bg-blue-500/10"
        border="border-blue-500/20"
        loading={loading}
      />
      <StatCard
        title="Delayed"
        value={stats.delayed}
        icon={faExclamationTriangle}
        color="text-amber-400"
        bg="bg-amber-500/10"
        border="border-amber-500/20"
        loading={loading}
      />
      <StatCard
        title="In Transit"
        value={stats.inTransit}
        icon={faTruckFast}
        color="text-purple-400"
        bg="bg-purple-500/10"
        border="border-purple-500/20"
        loading={loading}
      />
    </div>
  );
}

// Internal Helper for Cards
function StatCard({ title, value, icon, color, bg, border, loading }) {
  return (
    <div
      className={`p-6 rounded-xl border ${bg} ${border} flex items-center justify-between relative overflow-hidden group`}
    >
      <div className="relative z-10">
        <p
          className={`text-xs font-bold uppercase tracking-wider mb-1 ${color} opacity-80`}
        >
          {title}
        </p>
        <div className="text-3xl font-mono font-bold text-white">
          {loading ? <span className="animate-pulse">...</span> : value}
        </div>
      </div>
      <div
        className={`text-3xl ${color} opacity-50 group-hover:scale-110 transition-transform duration-500`}
      >
        <FontAwesomeIcon icon={icon} />
      </div>

      {/* Decorative Blur Background */}
      <div
        className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full ${color.replace(
          "text-",
          "bg-",
        )} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity duration-500`}
      ></div>
    </div>
  );
}
