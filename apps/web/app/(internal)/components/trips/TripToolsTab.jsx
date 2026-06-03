import React from "react";
import TripOperations from "./TripOperations";
import DriverMessageWidget from "../messaging/DriverMessageWidget";
import TripBroadcastWidget from "../messaging/TripBroadcastWidget";
import AdminHardDeletePanel from "../admin/AdminHardDeletePanel";
import { deleteTruckTrip } from "@/app/utility/FirebaseFunctions";

export default function TripToolsTab({
  data,
  onRefresh,
  onDeleted,
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

      <hr className={isDark ? "border-slate-800" : "border-slate-200"} />

      <AdminHardDeletePanel
        title="Delete Trip"
        description="Permanently remove this trip from the system. Shipments on the manifest are detached but not deleted. Works for any trip status."
        entityLabel={data.tripId || data.id}
        confirmMessage={`Delete trip ${data.tripId || data.id}? This cannot be undone.`}
        onDelete={({ reason }) =>
          deleteTruckTrip({
            tripId: data.id,
            reason,
          })
        }
        onSuccess={onDeleted}
        isDark={isDark}
        profile={profile}
      />

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
