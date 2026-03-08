"use client";
import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruck,
  faPlus,
  faArrowLeft,
  faCheckCircle,
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
import { useAlert } from "@/app/context/AlertContext";
import ScheduleSection from "./ScheduleSection";
import VehicleDetails from "./VehicleDetails";

export default function TripStep({
  shipmentDraft,
  onBack,
  onComplete,
  isDark = false,
  isPickupMode = false,
}) {
  const { showAlert } = useAlert();

  const [view, setView] = useState("selection"); // "selection" | "create"
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
    tripType: isPickupMode ? "LOCAL_PICKUP" : "HUB_TRANSFER",
  });

  const fetchTrips = async () => {
    if (!destinationCode) return;

    setLoading(true);
    try {
      const constraints = [
        where("destinationCode", "==", destinationCode),
        where("status", "==", "CREATED"),
        orderBy("createdAt", "desc"),
        limit(10),
      ];

      if (isPickupMode) {
        constraints.push(where("tripType", "==", "LOCAL"));
      }

      const q = query(collection(db, "truck_trips"), ...constraints);
      const snap = await getDocs(q);
      setTrips(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
      showAlert(
        "error",
        "Failed to load trips",
        err.message || "Unknown error",
      );
    } finally {
      setLoading(false);
    }
  };
  // Inside TripStep.js
  useEffect(() => {
    if (shipmentDraft) {
      setNewTripData((prev) => ({
        ...prev,
        origin: shipmentDraft.routeInfo?.origin || "",
        originCode: shipmentDraft.routeInfo?.originCode || "",
        destination: shipmentDraft.routeInfo?.destination || "",
        destinationCode: shipmentDraft.routeInfo?.destinationCode || "",
      }));
    }
  }, [shipmentDraft]);

  useEffect(() => {
    if (view === "selection") {
      fetchTrips();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, isPickupMode, destinationCode]);

  const handleCreateTrip = async () => {
    setLoading(true);
    try {
      await createTruckTrip(newTripData);
      setView("selection");
      fetchTrips();
    } catch (err) {
      console.error(err);
      showAlert(
        "error",
        "Failed to create trip",
        err.message || "Unknown error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {view === "selection" ? (
          <div className="space-y-6">
            <div className="text-center">
              <h3
                className={`text-lg font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {isPickupMode ? "Assign to Pickup Route" : "Assign to Trip"}
              </h3>
              <p
                className={`text-xs ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}
              >
                {isPickupMode ? "Processing Hub: " : "Destination: "}
                <span
                  className={`font-bold ${
                    isDark ? "text-blue-400" : "text-blue-600"
                  }`}
                >
                  {destination}
                </span>
              </p>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div
                  className={`p-10 text-center animate-pulse ${
                    isDark ? "text-slate-500" : "text-slate-600"
                  }`}
                >
                  Updating trips...
                </div>
              ) : trips.length > 0 ? (
                trips.map((trip) => (
                  <div key={trip.id} className="relative group">
                    <button
                      onClick={() =>
                        onComplete &&
                        onComplete({ mode: "existing", tripId: trip.id })
                      }
                      className={`w-full p-4 rounded-xl transition-all flex items-center justify-between border ${
                        isDark
                          ? "bg-slate-950 border-slate-800 hover:border-blue-500"
                          : "bg-slate-50 border-slate-200 hover:border-blue-500/60"
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div
                          className={`p-3 rounded-lg transition-colors shrink-0 ${
                            isDark
                              ? "bg-slate-900 text-slate-500 group-hover:text-blue-500"
                              : "bg-slate-100 text-slate-500 group-hover:text-blue-600"
                          }`}
                        >
                          <FontAwesomeIcon icon={faTruck} />
                        </div>
                        <div className="text-left">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={`font-bold text-sm sm:text-base ${
                                isDark ? "text-slate-200" : "text-slate-900"
                              }`}
                            >
                              {trip.truckPlateNumber}
                            </p>
                            <span
                              className={`text-[10px] sm:text-[12px] font-mono px-1.5 py-0.5 rounded border ${
                                isDark
                                  ? "bg-slate-800 text-slate-400 border-slate-700"
                                  : "bg-slate-100 text-slate-600 border-slate-300"
                              }`}
                            >
                              {trip.tripId}
                            </span>
                          </div>
                          <p
                            className={`text-[10px] uppercase tracking-wide mt-0.5 ${
                              isDark ? "text-slate-500" : "text-slate-500"
                            }`}
                          >
                            {trip.driverName}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <FontAwesomeIcon
                          icon={faCheckCircle}
                          className={`transition-colors text-lg ${
                            isDark
                              ? "text-slate-800 group-hover:text-blue-500"
                              : "text-slate-300 group-hover:text-blue-600"
                          }`}
                        />
                      </div>
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center text-slate-500 italic text-sm border border-dashed border-slate-800 rounded-xl">
                  {isPickupMode
                    ? "No active Local Pickup routes found for this hub."
                    : "No active trips heading to this destination."}
                </div>
              )}
            </div>

            <button
              onClick={() => setView("create")}
              className={`w-full p-4 rounded-xl border-2 border-dashed font-bold flex items-center justify-center gap-3 text-sm sm:text-base transition-colors ${
                isDark
                  ? "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400"
                  : "border-blue-500/40 bg-blue-50 hover:bg-blue-100 text-blue-700"
              }`}
            >
              <FontAwesomeIcon icon={faPlus} />
              {isPickupMode ? "Create a New Local Route" : "Create a New Trip"}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <button
              onClick={() => setView("selection")}
              className={`text-xs flex items-center gap-2 transition-colors ${
                isDark
                  ? "text-blue-400 hover:text-blue-300"
                  : "text-blue-600 hover:text-blue-700"
              }`}
            >
              <FontAwesomeIcon icon={faArrowLeft} /> Cancel Creation
            </button>

            <div
              className={`p-4 rounded-xl flex flex-col items-center justify-center border ${
                isDark
                  ? "bg-blue-500/5 border-blue-500/20"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                  isDark ? "text-blue-400" : "text-blue-600"
                }`}
              >
                {isPickupMode ? "Local Collection Route" : "Warehouse Transfer"}
              </span>
              <p
                className={`text-sm font-bold uppercase ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {newTripData.origin} → {newTripData.destination}
              </p>
            </div>

            <ScheduleSection
              formData={newTripData}
              setFormData={setNewTripData}
              isDark={isDark}
            />
            <VehicleDetails
              formData={newTripData}
              setFormData={setNewTripData}
              isDark={isDark}
            />

            <button
              onClick={handleCreateTrip}
              disabled={loading}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-60"
            >
              {loading ? "Creating..." : "Confirm & Add Trip"}
            </button>
          </div>
        )}
      </div>

      {/* Footer pinned at bottom */}
      {/* <div
        className={`shrink-0 p-3 sm:p-4 border-t flex items-center gap-3 z-10 ${
          isDark
            ? "border-slate-800 bg-slate-950"
            : "border-slate-200 bg-slate-50"
        }`}
      >
        {onBack && (
          <button
            onClick={onBack}
            className={`px-5 py-3 sm:py-2 rounded-xl border font-bold transition-colors ${
              isDark
                ? "border-slate-700 text-slate-400 hover:bg-slate-800"
                : "border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            Back
          </button>
        )}
        {view === "create" && (
          <button
            onClick={handleCreateTrip}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 sm:py-2 rounded-xl shadow-lg transition-all disabled:opacity-60"
          >
            {loading ? "Creating Trip..." : "Confirm & Add to List"}
          </button>
        )}
      </div> */}
    </div>
  );
}
