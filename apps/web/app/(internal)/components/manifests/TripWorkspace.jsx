import React, { useState, useEffect } from "react";
import { auth } from "@/apps/web/lib/firebase";

// Components
import TripHeader from "./TripHeader";
import TripManifestTable from "./TripManifestTable";
import TripOperations from "./TripOperations"; // <--- Now Self-Contained
import TripModals from "./TripModals";

export default function TripWorkspace({
  tripId,
  initialTripData,
  onRefreshTrips,
}) {
  // --- SHARED DATA STATE ---
  const [trip, setTrip] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loadingShips, setLoadingShips] = useState(false);

  // --- MODAL STATES (Keep here so siblings can trigger them) ---
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [isDriverModalOpen, setDriverModalOpen] = useState(false);
  const [isDisableModalOpen, setDisableModalOpen] = useState(false);
  const [shipmentToUnassign, setShipmentToUnassign] = useState(null);

  useEffect(() => {
    setTrip(initialTripData);
    if (tripId) fetchShipments();
  }, [tripId, initialTripData]);

  // --- DATA FETCHING ---
  const fetchShipments = async () => {
    if (!tripId) return;
    setLoadingShips(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/manifests/trips/${tripId}/shipments`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      const data = await res.json();
      setShipments(data.shipments || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingShips(false);
    }
  };

  // Wrapper to refresh everything
  const handleRefresh = () => {
    onRefreshTrips?.(); // Refresh Sidebar/Parent
    fetchShipments(); // Refresh Table
  };

  if (!tripId)
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500 h-full">
        Select a trip to begin operations.
      </div>
    );

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2">
      {/* 1. Header (Stateless UI) */}
      <TripHeader
        trip={trip}
        onDriverClick={() => setDriverModalOpen(true)}
        onDisableClick={() => setDisableModalOpen(true)}
        onRefresh={handleRefresh}
      />

      {/* 2. Table (Needs Data from Parent, triggers Modals in Parent) */}
      <TripManifestTable
        shipments={shipments}
        loading={loadingShips}
        isLocked={trip?.manifestLocked}
        onSplit={(s) => {
          setSelectedShipment(s);
          setSplitModalOpen(true);
        }}
        onUnassign={(s) => setShipmentToUnassign(s)}
      />

      {/* 3. Operations (COMPLETELY SELF-CONTAINED NOW) */}
      <TripOperations
        tripId={tripId}
        isLocked={trip?.manifestLocked}
        onSuccess={handleRefresh} // <--- The only link needed!
      />

      {/* 4. Modals (Controlled by Parent State) */}
      <TripModals
        trip={trip}
        state={{
          splitModalOpen,
          selectedShipment,
          isDriverModalOpen,
          isDisableModalOpen,
          shipmentToUnassign,
        }}
        actions={{
          setSplitModalOpen,
          setDriverModalOpen,
          setDisableModalOpen,
          setShipmentToUnassign,
          handleRefresh,
          fetchShipments,
          onRefreshTrips,
        }}
      />
    </div>
  );
}
