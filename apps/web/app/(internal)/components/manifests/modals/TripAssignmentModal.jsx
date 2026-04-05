import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faIdCard,
  faTruck,
  faUserSlash,
  faSave,
  faTimes,
  faUser,
  faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";
import {
  assignDriverToTruckTrip,
  assignmentToTruckTrip,
  removeAssignmentFromTruckTrip,
  unassignDriverFromTruckTrip,
} from "@/app/utility/FirebaseFunctions";
import DriverSelectInput from "../DriverSelectInput";
import TruckSelectInput from "../TruckSelectInput";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";

export default function TripAssignmentModal({
  isOpen,
  onClose,
  trip,
  onSuccess,
  isDark = false,
}) {
  const modalTheme = getModalThemeClasses(isDark);
  const actionClasses = getModalActionClasses();

  const [formData, setFormData] = useState({
    driverName: "",
    driverId: "",
    truckPlateNumber: "",
    truckId: "",
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && trip) {
      setFormData({
        driverName: trip.driverName || "",
        driverId: trip.driverId || "",
        truckPlateNumber: trip.truckPlateNumber || "",
        truckId: trip.truckId || "",
      });
    }
  }, [isOpen, trip]);

  const hasExistingAssignment = useMemo(() => {
    return Boolean(
      (trip?.driverId && trip?.driverName) ||
      trip?.driverName ||
      trip?.driverId ||
      trip?.truckId ||
      trip?.truckPlateNumber,
    );
  }, [trip]);

  const canSave = useMemo(() => {
    return Boolean(formData.driverId || formData.truckId);
  }, [formData.driverId, formData.truckId]);

  if (!isOpen || !trip) return null;

  const handleAssign = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // await assignDriverToTruckTrip({
      await assignmentToTruckTrip({
        truckTripId: trip.id,
        driverId: formData.driverId || null,
        truckId: formData.truckId || null,
        truckPlateNumber: formData.truckPlateNumber || null,
      });

      onSuccess?.();
      onClose?.();
    } catch (err) {
      alert(err?.message || "Failed to save assignment.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async () => {
    const confirmed = window.confirm(
      "Remove the current driver and truck assignment from this trip?",
    );
    if (!confirmed) return;

    setLoading(true);

    try {
      // await unassignDriverFromTruckTrip({
      await removeAssignmentFromTruckTrip({
        truckTripId: trip.id,
      });

      onSuccess?.();
      onClose?.();
    } catch (err) {
      alert(err?.message || "Failed to remove assignment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${modalTheme.overlay}`}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl ${modalTheme.modal}`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b px-5 py-4 rounded-t-2xl ${modalTheme.header}`}
        >
          <div>
            <h3
              className={`text-base font-bold flex items-center gap-2 ${modalTheme.title}`}
            >
              <FontAwesomeIcon icon={faIdCard} className="text-blue-500" />
              Manage Assignment
            </h3>
            <p className={`text-xs mt-1 ${modalTheme.helperText}`}>
              Assign or remove the driver and truck for this trip.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={`p-1.5 rounded-lg ${modalTheme.closeButton}`}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form onSubmit={handleAssign} className="p-5 space-y-5">
          {/* Current assignment summary */}
          <div
            className={`rounded-xl border p-4 space-y-3 ${modalTheme.panelSurface}`}
          >
            <div className="flex items-center gap-2">
              <FontAwesomeIcon
                icon={faCircleInfo}
                className={modalTheme.accentText}
              />
              <p className={`text-sm font-semibold ${modalTheme.title}`}>
                Current Assignment
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={`rounded-xl border p-3 ${modalTheme.statsCard}`}>
                <p
                  className={`text-[11px] uppercase font-bold ${modalTheme.label}`}
                >
                  Driver
                </p>
                <p className={`mt-1 text-sm font-medium ${modalTheme.title}`}>
                  {trip.driverName || "No driver assigned"}
                </p>
              </div>

              <div className={`rounded-xl border p-3 ${modalTheme.statsCard}`}>
                <p
                  className={`text-[11px] uppercase font-bold ${modalTheme.label}`}
                >
                  Truck
                </p>
                <p className={`mt-1 text-sm font-medium ${modalTheme.title}`}>
                  {trip.truckPlateNumber || "No truck assigned"}
                </p>
              </div>
            </div>
          </div>

          {/* Driver */}
          <div className="space-y-1.5">
            {/* <label
              className={`text-xs font-bold uppercase tracking-wide flex items-center gap-2 ${modalTheme.label}`}
            >
              <FontAwesomeIcon icon={faUser} />
              Driver
            </label> */}

            <DriverSelectInput
              value={formData.driverName}
              onChange={(text) =>
                setFormData((prev) => ({
                  ...prev,
                  driverName: text,
                  driverId: "",
                }))
              }
              onSelectId={(id) =>
                setFormData((prev) => ({
                  ...prev,
                  driverId: id || "",
                }))
              }
              isDark={isDark}
            />
          </div>

          {/* Truck */}
          <div className="space-y-1.5">
            {/* <label
              className={`text-xs font-bold uppercase tracking-wide flex items-center gap-2 ${modalTheme.label}`}
            >
              <FontAwesomeIcon icon={faTruck} />
              Truck
            </label> */}

            <TruckSelectInput
              value={formData.truckPlateNumber}
              onChange={(val) =>
                setFormData((prev) => ({
                  ...prev,
                  truckPlateNumber: val,
                  truckId: "",
                }))
              }
              onSelectId={(id) =>
                setFormData((prev) => ({
                  ...prev,
                  truckId: id || "",
                }))
              }
              isDark={isDark}
            />
          </div>

          {/* Helper text */}
          <div className={`text-xs leading-relaxed ${modalTheme.helperText}`}>
            Save the selected driver and truck for this trip. Removing the
            assignment here only clears this trip’s assignment.
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={modalTheme.secondaryButton}
            >
              Cancel
            </button>

            {hasExistingAssignment && (
              <button
                type="button"
                onClick={handleUnassign}
                disabled={loading}
                className={actionClasses.danger}
                title="Remove Assignment"
              >
                <FontAwesomeIcon icon={faUserSlash} />
                {loading ? "Removing..." : "Remove"}
              </button>
            )}

            <button
              type="submit"
              disabled={loading || !canSave}
              className={actionClasses.primaryInline}
            >
              {loading ? (
                "Saving..."
              ) : (
                <>
                  <FontAwesomeIcon icon={faSave} />
                  Save
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
