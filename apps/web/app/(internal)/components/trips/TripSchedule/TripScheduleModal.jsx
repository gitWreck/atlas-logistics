"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faCalendarDays,
  faCircleNotch,
  faFloppyDisk,
  faTruck,
  faRoute,
  faBell,
} from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";
import { buildInitialForm } from "../utils";
import TripScheduleInfoCard from "../modals/TripScheduleInfoCard";
import TripScheduleDateField from "../modals/TripScheduleDateField";

export default function TripScheduleModal({
  isOpen = false,
  loading = false,
  mode = "create",
  selectedTripSchedule = null,
  trips = [],
  onClose,
  onSubmit,
  isDark = false,
}) {
  const [form, setForm] = useState(buildInitialForm(selectedTripSchedule));
  const [tripQuery, setTripQuery] = useState("");
  const [showTripDropdown, setShowTripDropdown] = useState(false);
  const [error, setError] = useState("");
  const [sendNotification, setsendNotification] = useState(false);

  const modalTheme = getModalThemeClasses(isDark);
  const actionTheme = getModalActionClasses();

  useEffect(() => {
    if (!isOpen) return;

    const nextForm = buildInitialForm(selectedTripSchedule);

    setForm(nextForm);
    setTripQuery(
      selectedTripSchedule
        ? `${selectedTripSchedule.tripId || selectedTripSchedule.id} — ${
            selectedTripSchedule.route ||
            `${selectedTripSchedule.origin || ""} → ${selectedTripSchedule.destination || ""}`
          }`
        : "",
    );
    setError("");
    setShowTripDropdown(false);
    setsendNotification(false);
  }, [isOpen, selectedTripSchedule]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const filteredTrips = useMemo(() => {
    const keyword = tripQuery.toLowerCase().trim();

    if (!keyword) return trips;

    return trips.filter((item) => {
      return `
        ${item.id || ""}
        ${item.tripId || ""}
        ${item.route || ""}
        ${item.origin || ""}
        ${item.destination || ""}
        ${item.originCode || ""}
        ${item.destinationCode || ""}
        ${item.truckPlateNumber || ""}
        ${item.driverName || ""}
        ${item.status || ""}
      `
        .toLowerCase()
        .includes(keyword);
    });
  }, [trips, tripQuery]);

  const handleSelectTrip = (trip) => {
    setTripQuery(
      `${trip.tripId || trip.id} — ${
        trip.route ||
        `${trip.origin || "Unknown"} → ${trip.destination || "Unknown"}`
      }`,
    );
    setForm(buildInitialForm(trip));
    setShowTripDropdown(false);
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.tripId) {
      setError("Please select a trip first.");
      return;
    }

    if (!form.plannedDeparture) {
      setError("Planned departure is required.");
      return;
    }

    if (!form.estimatedArrival) {
      setError("Estimated arrival is required.");
      return;
    }

    if (
      form.plannedDeparture &&
      form.estimatedArrival &&
      new Date(form.estimatedArrival) < new Date(form.plannedDeparture)
    ) {
      setError("Estimated arrival must be later than planned departure.");
      return;
    }

    setError("");

    onSubmit?.({
      tripId: form.tripId,
      plannedDeparture: form.plannedDeparture || null,
      estimatedArrival: form.estimatedArrival || null,
      plannedLoadingStart: form.plannedLoadingStart || null,
      sendNotification,
    });
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] ${modalTheme.overlay}`}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="h-full w-full flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className={`w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl border shadow-2xl rounded-none sm:rounded-2xl flex flex-col ${modalTheme.modal}`}
          >
            {/* Header */}
            <div
              className={`shrink-0 px-4 sm:px-6 py-4 border-b flex items-start sm:items-center justify-between gap-3 ${modalTheme.header}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center border shrink-0 ${
                    isDark
                      ? "bg-blue-500/10 text-blue-300 border-blue-500/20"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}
                >
                  <FontAwesomeIcon icon={faCalendarDays} />
                </div>

                <div className="min-w-0">
                  <h2
                    className={`text-base sm:text-lg font-bold ${modalTheme.title}`}
                  >
                    {mode === "edit" ? "Edit Trip Schedule" : "Trip Schedule"}
                  </h2>
                  <p
                    className={`text-xs sm:text-sm truncate ${modalTheme.bodyText}`}
                  >
                    {form.tripId || "No trip selected"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`${modalTheme.closeButton} shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-xl`}
                aria-label="Close modal"
              >
                <FontAwesomeIcon icon={faTimes} className="text-lg" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-6">
                {/* Trip Reference */}
                <section className="space-y-4">
                  <div>
                    <h3
                      className={`text-xs sm:text-sm font-bold uppercase tracking-widest ${modalTheme.title}`}
                    >
                      Trip Reference
                    </h3>
                    <p className={`text-xs mt-1 ${modalTheme.helperText}`}>
                      Select a trip and update its planned schedule.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <label
                        className={`text-xs font-semibold ${modalTheme.label}`}
                      >
                        Trip
                      </label>

                      <input
                        type="text"
                        value={mode === "edit" ? form.tripId || "" : tripQuery}
                        placeholder="Search trip ID, route, truck, driver..."
                        disabled={mode === "edit"}
                        onChange={(e) => {
                          setTripQuery(e.target.value);
                          setShowTripDropdown(true);
                        }}
                        onFocus={() => {
                          if (mode !== "edit") setShowTripDropdown(true);
                        }}
                        className={`w-full rounded-xl border px-3 py-2.5 text-sm mt-1 ${modalTheme.input}`}
                      />

                      {mode !== "edit" &&
                        showTripDropdown &&
                        filteredTrips.length > 0 && (
                          <div
                            className={`absolute z-50 left-0 right-0 mt-1 rounded-xl border shadow-xl overflow-hidden max-h-64 overflow-y-auto ${
                              isDark
                                ? "bg-slate-900 border-slate-700"
                                : "bg-white border-slate-200"
                            }`}
                          >
                            {filteredTrips.slice(0, 10).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectTrip(item)}
                                className={`w-full text-left px-3 py-3 text-xs transition-colors ${
                                  isDark
                                    ? "hover:bg-slate-800 text-slate-300"
                                    : "hover:bg-slate-100 text-slate-700"
                                }`}
                              >
                                <div className="font-bold">
                                  {item.tripId || item.id}
                                </div>
                                <div className="opacity-70 break-words">
                                  {item.route ||
                                    `${item.origin || "Unknown"} → ${item.destination || "Unknown"}`}
                                </div>
                                <div className="opacity-50 text-[10px] break-words">
                                  {item.truckPlateNumber
                                    ? `${item.truckPlateNumber} • `
                                    : ""}
                                  {item.driverName || "No driver"}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                      {mode !== "edit" && loading && (
                        <div
                          className={`text-xs mt-2 ${modalTheme.helperText}`}
                        >
                          <FontAwesomeIcon
                            icon={faCircleNotch}
                            spin
                            className="mr-2"
                          />
                          Loading trips...
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <TripScheduleInfoCard
                        label="Truck"
                        value={form.truckPlateNumber}
                        icon={faTruck}
                        theme={modalTheme}
                      />

                      <TripScheduleInfoCard
                        label="Route"
                        value={
                          form.route ||
                          `${form.origin || ""} → ${form.destination || ""}`
                        }
                        icon={faRoute}
                        theme={modalTheme}
                      />

                      <TripScheduleInfoCard
                        label="Trip Status"
                        value={form.status}
                        icon={faCalendarDays}
                        theme={modalTheme}
                      />
                    </div>
                  </div>
                </section>

                {/* Schedule */}
                <section className="space-y-4">
                  <div>
                    <h3
                      className={`text-xs sm:text-sm font-bold uppercase tracking-widest ${modalTheme.title}`}
                    >
                      Planned Schedule
                    </h3>
                    <p className={`text-xs mt-1 ${modalTheme.helperText}`}>
                      Edit the departure, arrival, and loading start. Each field
                      shows its weekday automatically.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <TripScheduleDateField
                      label="Planned Departure"
                      icon={faCalendarDays}
                      value={form.plannedDeparture}
                      onChange={(value) =>
                        updateField("plannedDeparture", value)
                      }
                      theme={modalTheme}
                    />

                    <TripScheduleDateField
                      label="Estimated Arrival"
                      icon={faCalendarDays}
                      value={form.estimatedArrival}
                      onChange={(value) =>
                        updateField("estimatedArrival", value)
                      }
                      theme={modalTheme}
                    />

                    <TripScheduleDateField
                      label="Planned Loading Start"
                      icon={faCalendarDays}
                      value={form.plannedLoadingStart}
                      onChange={(value) =>
                        updateField("plannedLoadingStart", value)
                      }
                      theme={modalTheme}
                    />
                  </div>
                </section>

                {/* Notification */}
                <section className="space-y-3">
                  <div>
                    <h3
                      className={`text-xs sm:text-sm font-bold uppercase tracking-widest ${modalTheme.title}`}
                    >
                      Customer Notification
                    </h3>
                    <p className={`text-xs mt-1 ${modalTheme.helperText}`}>
                      Choose whether the Firebase Function should send schedule
                      updates to customers.
                    </p>
                  </div>

                  <label
                    className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer ${modalTheme.panelSurface}`}
                  >
                    <input
                      type="checkbox"
                      checked={sendNotification}
                      onChange={(e) => setsendNotification(e.target.checked)}
                      className="mt-1 h-4 w-4"
                    />

                    <div className="min-w-0">
                      <div
                        className={`text-sm font-semibold flex items-center gap-2 ${modalTheme.title}`}
                      >
                        <FontAwesomeIcon icon={faBell} />
                        Send notification to customers
                      </div>
                      {/* <p className={`text-xs mt-1 ${modalTheme.helperText}`}>
                        When enabled, `sendNotification` will be passed
                        to your `onSubmit` payload.
                      </p> */}
                    </div>
                  </label>
                </section>

                {error ? (
                  <div className={modalTheme.errorBox}>{error}</div>
                ) : null}
              </div>

              {/* Footer */}
              <div
                className={`shrink-0 px-4 sm:px-6 py-4 border-t ${modalTheme.divider}`}
              >
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className={`${actionTheme.secondary} w-full sm:w-auto`}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className={`${actionTheme.primaryInlineCompact} px-4 w-full sm:w-auto`}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <FontAwesomeIcon icon={faCircleNotch} spin />
                        Saving...
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center gap-2">
                        <FontAwesomeIcon icon={faFloppyDisk} />
                        Save Schedule
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
