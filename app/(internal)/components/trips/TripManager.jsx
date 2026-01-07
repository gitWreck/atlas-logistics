"use client";
import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faPlus, faSync } from "@fortawesome/free-solid-svg-icons";
import CreateTripModal from "./CreateTripModal";
import TripDetail from "./TripDetail";

export default function TripManager() {
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  // 1. Load Trips (Real-time)
  useEffect(() => {
    const q = query(
      collection(db, "truck_trips"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTrips(list);
    });
    return () => unsub();
  }, []);

  // Filter
  const filteredTrips = trips.filter(
    (t) =>
      (t.tripId || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.driverName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-140px)] flex gap-6">
      {/* LEFT: TRIP LIST */}
      <div className="w-1/3 flex flex-col bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-white">Active Trips</h2>
            <button
              onClick={() => setModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
            >
              <FontAwesomeIcon icon={faPlus} /> Create
            </button>
          </div>
          <div className="relative">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3 top-2.5 text-slate-500 text-xs"
            />
            <input
              type="text"
              placeholder="Search Trip ID / Driver..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {filteredTrips.map((trip) => (
            <div
              key={trip.id}
              onClick={() => setSelectedTripId(trip.id)}
              className={`p-3 rounded-lg cursor-pointer border transition-all ${
                selectedTripId === trip.id
                  ? "bg-blue-600/10 border-blue-500/50 shadow-[0_0_15px_rgba(37,99,235,0.1)]"
                  : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800"
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span
                  className={`font-mono font-bold text-sm ${
                    selectedTripId === trip.id
                      ? "text-blue-400"
                      : "text-slate-200"
                  }`}
                >
                  {trip.tripId}
                </span>
                <StatusBadge
                  status={trip.status}
                  locked={trip.manifestLocked}
                  certified={!!trip.certificate}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{trip.driverName || "No Driver"}</span>
                <span>{trip.packageTotal || 0} pkgs</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: TRIP DETAIL WORKSPACE */}
      <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        {selectedTripId ? (
          <TripDetail tripId={selectedTripId} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
            <FontAwesomeIcon
              icon={faSync}
              className="text-4xl mb-4 opacity-20"
            />
            <p>Select a trip to view manifest details</p>
          </div>
        )}
      </div>

      <CreateTripModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {}}
      />
    </div>
  );
}

// Simple Badge Helper
function StatusBadge({ status, locked, certified }) {
  if (certified)
    return (
      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase">
        Certified
      </span>
    );
  if (locked)
    return (
      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase">
        Locked
      </span>
    );
  return (
    <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600 text-[10px] font-bold uppercase">
      Open
    </span>
  );
}
