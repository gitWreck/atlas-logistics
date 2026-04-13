"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faCalendarDays,
  faCircleNotch,
  faFloppyDisk,
} from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";
import { buildInitialForm, ReadOnlyField, DateTimeField } from "../utils";

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

  const modalTheme = getModalThemeClasses(isDark);
  const actionTheme = getModalActionClasses();

  useEffect(() => {
    if (isOpen) {
      setForm(buildInitialForm(selectedTripSchedule));
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
    }
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
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (
      form.plannedLoadingStart &&
      form.plannedLoadingEnd &&
      new Date(form.plannedLoadingEnd) < new Date(form.plannedLoadingStart)
    ) {
      setError("Planned loading end must be later than planned loading start.");
      return;
    }

    if (
      form.actualLoadingStart &&
      form.actualLoadingEnd &&
      new Date(form.actualLoadingEnd) < new Date(form.actualLoadingStart)
    ) {
      setError("Actual loading end must be later than actual loading start.");
      return;
    }

    if (
      form.actualDeparture &&
      form.actualArrival &&
      new Date(form.actualArrival) < new Date(form.actualDeparture)
    ) {
      setError("Actual arrival must be later than actual departure.");
      return;
    }

    setError("");

    onSubmit?.({
      tripId: form.tripId,
      plannedLoadingStart: form.plannedLoadingStart || null,
      plannedLoadingEnd: form.plannedLoadingEnd || null,
      actualLoadingStart: form.actualLoadingStart || null,
      actualLoadingEnd: form.actualLoadingEnd || null,
      actualDeparture: form.actualDeparture || null,
      actualArrival: form.actualArrival || null,
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
                    Trip Schedule Modal
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
              {/* Content */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-6">
                <section className="space-y-3">
                  <div>
                    <h3
                      className={`text-xs sm:text-sm font-bold uppercase tracking-widest ${modalTheme.title}`}
                    >
                      Trip Reference
                    </h3>
                    <p className={`text-xs mt-1 ${modalTheme.helperText}`}>
                      Search a trip and update its loading and actual execution
                      schedule.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    <div className="relative xl:col-span-1">
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

                    <ReadOnlyField
                      label="Truck"
                      value={form.truckPlateNumber}
                      theme={modalTheme}
                    />

                    <ReadOnlyField
                      label="Route"
                      value={
                        form.route ||
                        `${form.origin || ""} → ${form.destination || ""}`
                      }
                      theme={modalTheme}
                    />

                    <ReadOnlyField
                      label="Planned Departure"
                      type="datetime-local"
                      value={form.plannedDeparture}
                      theme={modalTheme}
                    />

                    <ReadOnlyField
                      label="Estimated Arrival"
                      type="datetime-local"
                      value={form.estimatedArrival}
                      theme={modalTheme}
                    />

                    <ReadOnlyField
                      label="Trip Status"
                      value={form.status}
                      theme={modalTheme}
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3
                    className={`text-xs sm:text-sm font-bold uppercase tracking-widest ${modalTheme.title}`}
                  >
                    Planned Loading Schedule
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DateTimeField
                      label="Planned Loading Start"
                      value={form.plannedLoadingStart}
                      onChange={(value) =>
                        updateField("plannedLoadingStart", value)
                      }
                      theme={modalTheme}
                    />

                    <DateTimeField
                      label="Planned Loading End"
                      value={form.plannedLoadingEnd}
                      onChange={(value) =>
                        updateField("plannedLoadingEnd", value)
                      }
                      theme={modalTheme}
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3
                    className={`text-xs sm:text-sm font-bold uppercase tracking-widest ${modalTheme.title}`}
                  >
                    Actual Loading Schedule
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DateTimeField
                      label="Actual Loading Start"
                      value={form.actualLoadingStart}
                      onChange={(value) =>
                        updateField("actualLoadingStart", value)
                      }
                      theme={modalTheme}
                    />

                    <DateTimeField
                      label="Actual Loading End"
                      value={form.actualLoadingEnd}
                      onChange={(value) =>
                        updateField("actualLoadingEnd", value)
                      }
                      theme={modalTheme}
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3
                    className={`text-xs sm:text-sm font-bold uppercase tracking-widest ${modalTheme.title}`}
                  >
                    Actual Trip Movement
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DateTimeField
                      label="Actual Departure"
                      value={form.actualDeparture}
                      onChange={(value) =>
                        updateField("actualDeparture", value)
                      }
                      theme={modalTheme}
                    />

                    <DateTimeField
                      label="Actual Arrival"
                      value={form.actualArrival}
                      onChange={(value) => updateField("actualArrival", value)}
                      theme={modalTheme}
                    />
                  </div>
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
