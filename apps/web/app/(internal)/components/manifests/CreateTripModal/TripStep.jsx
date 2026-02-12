"use client";
import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruck,
  faPlus,
  faArrowLeft,
  faCheckCircle,
  faRoute,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createTruckTrip } from "@/app/utility/FirebaseFunctions";
import ScheduleSection from "./ScheduleSection";
import VehicleDetails from "./VehicleDetails";
import { useAlert } from "@/app/context/AlertContext";

export default function TripStep({ shipmentDraft, onBack, onComplete }) {
  const { showAlert, showConfirm } = useAlert();

  const [view, setView] = useState("selection");
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const destinationCode = shipmentDraft?.routeInfo?.destinationCode;
  const destination = shipmentDraft?.routeInfo?.destination;

  const [newTripData, setNewTripData] = useState({
    origin: shipmentDraft?.routeInfo?.origin || "",
    originCode: shipmentDraft?.routeInfo?.originCode || "",
    destination: shipmentDraft?.routeInfo?.destination || "",
    destinationCode: destinationCode || "",
    scheduledDeparture: "",
    estimatedArrival: "",
    driverName: "",
    driverId: null,
    truckPlateNumber: "",
    truckId: null,
  });

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "truck_trips"),
        where("destinationCode", "==", destinationCode),
        where("status", "==", "CREATED"),
        orderBy("createdAt", "desc"), // Ensures newest is on top
        limit(10),
      );
      const snap = await getDocs(q);
      setTrips(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === "selection") fetchTrips();
  }, [view]);

  const handleCreateTrip = async () => {
    setLoading(true);
    try {
      await createTruckTrip(newTripData);
      setView("selection"); // Go back to list
      fetchTrips(); // Refresh list to show new trip on top
    } catch (err) {
      showAlert("error", "Failed to create trip", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {view === "selection" ? (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Assign to Trip</h3>
              <p className="text-xs text-slate-400">
                Destination:{" "}
                <span className="text-blue-400 font-bold">{destination}</span>
              </p>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="p-10 text-center text-slate-500 animate-pulse">
                  Updating trips...
                </div>
              ) : (
                trips.map((trip) => (
                  <div key={trip.id} className="relative group">
                    <button
                      onClick={() =>
                        onComplete({ mode: "existing", tripId: trip.id })
                      }
                      className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-900 rounded-lg text-slate-500 group-hover:text-blue-500 transition-colors">
                          <FontAwesomeIcon icon={faTruck} />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-200">
                              {trip.truckPlateNumber}
                            </p>
                            {/* TRUCK/TRIP ID BADGE */}
                            <span className="text-[12px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                              {trip.tripId}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">
                            {trip.driverName}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <FontAwesomeIcon
                          icon={faCheckCircle}
                          className="text-slate-800 group-hover:text-blue-500 transition-colors text-lg"
                        />
                      </div>
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setView("create")}
              className="w-full p-4 rounded-xl border-2 border-dashed border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 font-bold flex items-center justify-center gap-3"
            >
              <FontAwesomeIcon icon={faPlus} /> Create a New Trip
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <button
              onClick={() => setView("selection")}
              className="text-xs text-blue-400 flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faArrowLeft} /> Cancel
            </button>
            <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl flex items-center justify-between">
              <p className="text-sm font-bold text-white uppercase">
                {newTripData.origin} → {newTripData.destination}
              </p>
            </div>
            <ScheduleSection
              formData={newTripData}
              setFormData={setNewTripData}
            />
            <VehicleDetails
              formData={newTripData}
              setFormData={setNewTripData}
            />
          </div>
        )}
      </div>

      <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex gap-3">
        <button
          onClick={onBack}
          className="px-8 py-3.5 rounded-xl border border-slate-700 text-slate-400 font-bold"
        >
          Back
        </button>
        {view === "create" && (
          <button
            onClick={handleCreateTrip}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl"
          >
            {loading ? "Creating Trip..." : "Confirm & Add to List"}
          </button>
        )}
      </div>
    </div>
  );
}
