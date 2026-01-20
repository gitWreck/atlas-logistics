"use client";
import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTruckLoading } from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/apps/web/lib/firebase";
import CreateTripModal from "./modals/CreateTripModal";
import TripWorkspace from "./TripWorkspace";
// import TripWorkspace from "./backup/TripWorkspace-orig";
import TripsSidebar from "./TripsSidebar";

export default function ManifestPage() {
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false); // <--- ADD THIS

  const fetchTrips = async () => {
    setLoading(true);
    try {
      // 1. Get Token
      const user = auth.currentUser;
      if (!user) return; // Or redirect to login
      const token = await user.getIdToken();

      // 2. Call API
      const res = await fetch("/api/manifests/trips", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to load trips");

      const data = await res.json();
      setTrips(data.trips);
    } catch (err) {
      console.error("Error loading trips:", err);
      alert("Failed to load trips. Check console.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const openCreateModal = () => {
    setCreateModalOpen(true);
  };

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex gap-3">
              <div className="h-10 w-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500">
                <FontAwesomeIcon icon={faTruckLoading} size="lg" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Manifest & Trip Manager
                </h1>
                <p className="text-xs text-slate-500">
                  Manage truck assignments, lock manifests, and issue
                  certificates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 h-[calc(100vh-140px)] p-6">
        {/* Left Panel: List */}
        <TripsSidebar
          trips={trips}
          loading={loading}
          selectedTripId={selectedTripId}
          onSelectTrip={setSelectedTripId}
          onRefresh={fetchTrips}
          onCreateTrip={openCreateModal} // <--- UPDATE THIS PROP
        />

        {/* Right Panel: Workspace */}
        <TripWorkspace
          tripId={selectedTripId}
          initialTripData={selectedTrip}
          onRefreshTrips={fetchTrips}
        />

        <CreateTripModal
          isOpen={isCreateModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            fetchTrips(); // Refresh list
            // Optional: Show success toast here
          }}
        />
      </div>
    </div>
  );
}
