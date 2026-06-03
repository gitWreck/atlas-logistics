import React, { useState } from "react";
import TripOperations from "./TripOperations"; // Your existing operations component
import DriverMessageWidget from "../messaging/DriverMessageWidget";
import TripBroadcastWidget from "../messaging/TripBroadcastWidget";

export default function TripToolsTab({
  data,
  onRefresh,
  isDark = false,
  profile,
}) {
  const isManager = String(profile?.role || "").toLowerCase() === "manager";

  return (
    <div className="animate-in zoom-in-95 duration-200 space-y-6">
      {/* 1. CRITICAL OPERATIONS (Status, Delay, Assign) */}
      {!isManager && (
        <TripOperations
          tripId={data.tripId}
          isLocked={data.manifestLocked}
          onSuccess={() => onRefresh()}
          isDark={isDark}
          profile={profile}
        />
      )}

      {!isManager && (
        <hr className={isDark ? "border-slate-800" : "border-slate-200"} />
      )}

      {/* 2. COMMUNICATION CARD */}
      <TripBroadcastWidget trip={data} isDark={isDark} profile={profile} />

      <DriverMessageWidget trip={data} isDark={isDark} profile={profile} />

      {/* 3. QUICK ACTIONS GRID */}
      {/* <div className="grid grid-cols-2 gap-3">
        <button className="p-3 bg-slate-800 border border-slate-700 hover:border-emerald-500 hover:text-white text-slate-400 rounded-lg flex flex-col items-center gap-2 transition-all shadow-sm hover:shadow-md">
          <FontAwesomeIcon icon={faMapMarkerAlt} className="text-lg" />
          <span className="text-xs font-bold">Track GPS</span>
        </button>

        <button className="p-3 bg-slate-800 border border-slate-700 hover:border-blue-500 hover:text-white text-slate-400 rounded-lg flex flex-col items-center gap-2 transition-all shadow-sm hover:shadow-md">
          <FontAwesomeIcon icon={faPhone} className="text-lg" />
          <span className="text-xs font-bold">Call Driver</span>
        </button>

        <button className="p-3 bg-slate-800 border border-slate-700 hover:border-amber-500 hover:text-white text-slate-400 rounded-lg flex flex-col items-center gap-2 transition-all shadow-sm hover:shadow-md col-span-2">
          <FontAwesomeIcon icon={faFileContract} className="text-lg" />
          <span className="text-xs font-bold">View Incident Reports</span>
        </button>
      </div> */}
    </div>
  );
}
