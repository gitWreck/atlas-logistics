"use client";
import React, { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruck,
  faPlus,
  faArrowLeft,
  faCheckCircle,
  faSearch,
  faSort,
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
import TripScheduleFields from "../../trips/modals/TripScheduleFields";

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
  const [tripSearch, setTripSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "plannedDeparture",
    direction: "asc",
  });

  const destinationCode = shipmentDraft?.routeInfo?.destinationCode;
  const destination = shipmentDraft?.routeInfo?.destination;

  const [newTripData, setNewTripData] = useState({
    origin: shipmentDraft?.routeInfo?.origin || "",
    originCode: shipmentDraft?.routeInfo?.originCode || "",
    destination: shipmentDraft?.routeInfo?.destination || "",
    destinationCode: destinationCode || "",
    plannedDeparture: "",
    estimatedArrival: "",
    driverName: "",
    driverId: null,
    truckPlateNumber: "",
    truckId: null,
    tripType: isPickupMode === true ? "LOCAL_PICKUP" : "HUB_TRANSFER",
  });

  const fetchTrips = async () => {
    if (!destinationCode) return;

    setLoading(true);
    try {
      const constraints = [
        where("destinationCode", "==", destinationCode),
        where("status", "==", "CREATED"),
        orderBy("createdAt", "desc"),
        limit(50),
      ];

      if (isPickupMode === true) {
        constraints.push(where("tripType", "==", "LOCAL_PICKUP"));
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

  const getDateValue = (value) => {
    if (!value) return 0;
    if (typeof value?.toDate === "function") return value.toDate().getTime();
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const formatDate = (value) => {
    const timestamp = getDateValue(value);
    if (!timestamp) return "Not set";

    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(timestamp));
  };

  const getSortValue = (trip, key) => {
    if (key === "plannedDeparture") {
      return getDateValue(trip.plannedDeparture || trip.createdAt);
    }

    return String(trip[key] || "").toLowerCase();
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const visibleTrips = useMemo(() => {
    const keyword = tripSearch.trim().toLowerCase();

    const filtered = trips.filter((trip) => {
      if (!keyword) return true;

      return `
        ${trip.tripId || ""}
        ${trip.id || ""}
        ${trip.driverName || ""}
        ${trip.truckPlateNumber || ""}
        ${trip.route || ""}
        ${trip.origin || ""}
        ${trip.destination || ""}
        ${formatDate(trip.plannedDeparture || trip.createdAt)}
      `
        .toLowerCase()
        .includes(keyword);
    });

    return [...filtered].sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [trips, tripSearch, sortConfig]);

  const renderSortLabel = (key, label) => {
    const isActive = sortConfig.key === key;
    const suffix =
      isActive && sortConfig.direction === "asc"
        ? " asc"
        : isActive
          ? " desc"
          : "";

    return `${label}${suffix}`;
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

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="relative flex-1">
                  <FontAwesomeIcon
                    icon={faSearch}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs ${
                      isDark ? "text-slate-600" : "text-slate-400"
                    }`}
                  />
                  <input
                    type="text"
                    value={tripSearch}
                    onChange={(event) => setTripSearch(event.target.value)}
                    placeholder="Search trip, driver, truck, route, or date..."
                    className={`w-full rounded-xl border pl-9 pr-3 py-2.5 text-sm outline-none ${
                      isDark
                        ? "bg-slate-950 border-slate-800 text-white placeholder:text-slate-600"
                        : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                    }`}
                  />
                </div>

                <div
                  className={`text-xs font-semibold ${
                    isDark ? "text-slate-500" : "text-slate-600"
                  }`}
                >
                  {visibleTrips.length} of {trips.length} trips
                </div>
              </div>

              <div
                className={`rounded-xl border overflow-hidden ${
                  isDark
                    ? "bg-slate-950 border-slate-800"
                    : "bg-white border-slate-200"
                }`}
              >
                {loading ? (
                  <div
                    className={`p-10 text-center animate-pulse ${
                      isDark ? "text-slate-500" : "text-slate-600"
                    }`}
                  >
                    Updating trips...
                  </div>
                ) : visibleTrips.length > 0 ? (
                  <>
                    <div
                      className={`sm:hidden divide-y ${
                        isDark ? "divide-slate-800" : "divide-slate-200"
                      }`}
                    >
                      {visibleTrips.map((trip) => (
                        <TripMobileCard
                          key={trip.id}
                          trip={trip}
                          isDark={isDark}
                          formatDate={formatDate}
                          onSelect={() =>
                            onComplete &&
                            onComplete({
                              mode: "existing",
                              tripId: trip.id,
                            })
                          }
                        />
                      ))}
                    </div>
                    <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead
                        className={`border-b text-[11px] uppercase tracking-wider ${
                          isDark
                            ? "bg-slate-900 border-slate-800 text-slate-500"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        <tr>
                          <SortableHeader
                            label={renderSortLabel("tripId", "Trip")}
                            onClick={() => handleSort("tripId")}
                          />
                          <SortableHeader
                            label={renderSortLabel("driverName", "Driver")}
                            onClick={() => handleSort("driverName")}
                          />
                          <SortableHeader
                            label={renderSortLabel("truckPlateNumber", "Truck")}
                            onClick={() => handleSort("truckPlateNumber")}
                          />
                          <SortableHeader
                            label={renderSortLabel(
                              "plannedDeparture",
                              "Departure",
                            )}
                            onClick={() => handleSort("plannedDeparture")}
                          />
                          <th className="px-4 py-3 font-bold">Route</th>
                          <th className="px-4 py-3 text-right font-bold">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody
                        className={`divide-y ${
                          isDark ? "divide-slate-800" : "divide-slate-200"
                        }`}
                      >
                        {visibleTrips.map((trip) => (
                          <tr
                            key={trip.id}
                            className={`transition-colors ${
                              isDark
                                ? "hover:bg-slate-900/80"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div
                                className={`font-mono text-xs font-bold ${
                                  isDark ? "text-blue-400" : "text-blue-600"
                                }`}
                              >
                                {trip.tripId || trip.id}
                              </div>
                              <div
                                className={`mt-1 text-[11px] ${
                                  isDark ? "text-slate-600" : "text-slate-500"
                                }`}
                              >
                                {trip.tripType || "HUB_TRANSFER"}
                              </div>
                            </td>
                            <td
                              className={`px-4 py-3 font-semibold ${
                                isDark ? "text-slate-200" : "text-slate-800"
                              }`}
                            >
                              {trip.driverName || "No driver"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                                  isDark
                                    ? "bg-slate-900 border-slate-700 text-slate-300"
                                    : "bg-slate-100 border-slate-200 text-slate-700"
                                }`}
                              >
                                <FontAwesomeIcon icon={faTruck} />
                                {trip.truckPlateNumber || "No truck"}
                              </span>
                            </td>
                            <td
                              className={`px-4 py-3 text-xs ${
                                isDark ? "text-slate-400" : "text-slate-600"
                              }`}
                            >
                              {formatDate(trip.plannedDeparture)}
                            </td>
                            <td
                              className={`px-4 py-3 text-xs ${
                                isDark ? "text-slate-400" : "text-slate-600"
                              }`}
                            >
                              {trip.route ||
                                `${trip.origin || "Unknown"} -> ${
                                  trip.destination || "Unknown"
                                }`}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  onComplete &&
                                  onComplete({
                                    mode: "existing",
                                    tripId: trip.id,
                                  })
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500"
                              >
                                <FontAwesomeIcon icon={faCheckCircle} />
                                Select
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </>
                ) : (
                  <div className="p-10 text-center text-slate-500 italic text-sm border border-dashed border-transparent">
                    {tripSearch
                      ? "No trips match your search."
                      : isPickupMode
                        ? "No active Local Pickup routes found for this hub."
                        : "No active trips heading to this destination."}
                  </div>
                )}
              </div>
            </div>
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

            {/* <ScheduleSection
              formData={newTripData}
              setFormData={setNewTripData}
              isDark={isDark}
            /> */}

            <TripScheduleFields
              formData={newTripData}
              setFormData={setNewTripData}
              isDark={isDark}
              // errors={scheduleErrors}
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
    </div>
  );
}

function SortableHeader({ label, onClick }) {
  return (
    <th className="px-4 py-3 font-bold">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 hover:text-blue-500"
      >
        <span>{label}</span>
        <FontAwesomeIcon icon={faSort} className="text-[10px] opacity-60" />
      </button>
    </th>
  );
}

function TripMobileCard({ trip, isDark, formatDate, onSelect }) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={`font-mono text-xs font-bold ${
              isDark ? "text-blue-400" : "text-blue-600"
            }`}
          >
            {trip.tripId || trip.id}
          </div>
          <div
            className={`mt-1 text-base font-bold ${
              isDark ? "text-slate-100" : "text-slate-900"
            }`}
          >
            {trip.driverName || "No driver"}
          </div>
        </div>

        <button
          type="button"
          onClick={onSelect}
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500"
        >
          Select
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <MobileMeta
          label="Truck"
          value={trip.truckPlateNumber || "No truck"}
          isDark={isDark}
        />
        <MobileMeta
          label="Departure"
          value={formatDate(trip.plannedDeparture)}
          isDark={isDark}
        />
        <MobileMeta
          label="Type"
          value={trip.tripType || "HUB_TRANSFER"}
          isDark={isDark}
        />
        <MobileMeta
          label="Route"
          isDark={isDark}
          value={
            trip.route ||
            `${trip.origin || "Unknown"} -> ${trip.destination || "Unknown"}`
          }
        />
      </div>
    </div>
  );
}

function MobileMeta({ label, value, isDark }) {
  return (
    <div
      className={`min-w-0 rounded-lg border p-2 ${
        isDark
          ? "border-slate-800 bg-slate-900"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 truncate font-semibold ${
          isDark ? "text-slate-300" : "text-slate-700"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
