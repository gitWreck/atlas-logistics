import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faSync,
  faPlus,
  faLock,
  faScroll,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../../ui/StatusBadge";
export default function TripsSidebar({
  trips,
  loading,
  selectedTripId,
  onSelectTrip,
  onRefresh,
  onCreateTrip,
}) {
  const [search, setSearch] = useState("");

  const filtered = trips.filter((t) => {
    const hay = [t.tripId, t.driverName, t.route, t.status]
      .join(" ")
      .toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-xl backdrop-blur-sm">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/50">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
            Trips
          </h2>
          <button
            onClick={onCreateTrip}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
          >
            <FontAwesomeIcon icon={faPlus} /> New
          </button>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3 top-2.5 text-slate-500 text-xs"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, Driver..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white focus:border-blue-500 outline-none transition-colors"
            />
          </div>
          <button
            onClick={onRefresh}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 px-3 rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={faSync} spin={loading} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            Loading trips...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            No trips found.
          </div>
        ) : (
          filtered.map((t) => {
            const isActive = t.id === selectedTripId;
            const isLocked = t.manifestLocked;
            const isCert = !!t.certificate;

            return (
              <div
                key={t.id}
                onClick={() => onSelectTrip(t.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-1.5 ${
                  isActive
                    ? "bg-blue-600/10 border-blue-500/50 shadow-md shadow-blue-900/20"
                    : "bg-slate-900/40 border-slate-800/50 hover:bg-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span
                    className={`font-mono text-sm font-bold ${
                      isActive ? "text-blue-400" : "text-slate-200"
                    }`}
                  >
                    {t.tripId || "NO-ID"}
                  </span>
                  {/* Status Badges */}
                  <div className="flex gap-1">
                    {isCert && (
                      <span
                        className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20"
                        title="Certified"
                      >
                        <FontAwesomeIcon icon={faScroll} />
                      </span>
                    )}
                    {isLocked && (
                      <span
                        className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20"
                        title="Locked"
                      >
                        <FontAwesomeIcon icon={faLock} />
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>{t.route || "No Route"}</span>
                  <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-400">
                    {t.totalItems || 0} Pkgs
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${
                      t.status === "COMPLETED"
                        ? "bg-emerald-500"
                        : "bg-blue-500"
                    }`}
                  ></div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">
                    {<StatusBadge status={t.status} /> || "OPEN"}
                  </span>
                  {t.delayReason ? (
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">
                      {(
                        <StatusBadge status={t.status} reason={t.delayReason} />
                      ) || "OPEN"}
                    </span>
                  ) : (
                    ""
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
