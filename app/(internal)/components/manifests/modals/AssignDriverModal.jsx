import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faIdCard,
  faTruck,
  faUserSlash,
  faSave,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import {
  assignDriverToTruckTrip,
  unassignDriverFromTruckTrip,
} from "@/app/utility/FirebaseFunctions";
import DriverSelectInput from "../DriverSelectInput";

export default function AssignDriverModal({
  isOpen,
  onClose,
  trip,
  onSuccess,
}) {
  const [formData, setFormData] = useState({
    driverName: "",
    driverId: null, // We need to track the ID specifically
    truckPlateNumber: "",
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && trip) {
      setFormData({
        driverName: trip.driverName || "",
        truckPlateNumber: trip.truckPlateNumber || "",
        driverId: trip.driverId || "",
      });
    }
  }, [isOpen, trip]);

  if (!isOpen) return null;

  const handleSubmitAssign = async (e, isUnassign = false) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      await assignDriverToTruckTrip({
        truckTripId: trip.id,
        driverId: isUnassign ? null : formData.driverId,
        truckPlateNumber: isUnassign ? null : formData.truckPlateNumber,
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitUnassign = async (e, isUnassign = false) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      await unassignDriverFromTruckTrip({
        tripDocId: trip.id,
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="p-4 border-b border-slate-800 rounded-t-xl flex justify-between items-center bg-slate-950">
          <h3 className="font-bold text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faIdCard} className="text-blue-500" />
            Manage Driver
          </h3>
          <button onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} className="text-slate-500" />
          </button>
        </div>

        <form
          onSubmit={(e) => handleSubmitAssign(e, false)}
          className="p-6 space-y-4"
        >
          <div className="space-y-1">
            <DriverSelectInput
              value={formData.driverName}
              onChange={(text) =>
                setFormData((prev) => ({ ...prev, driverName: text }))
              }
              onSelectId={(id) =>
                setFormData((prev) => ({ ...prev, driverId: id }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">
              Truck Plate #
            </label>
            <div className="relative">
              <FontAwesomeIcon
                icon={faTruck}
                className="absolute left-2 top-3.5 text-slate-600 text-s"
              />
              <input
                required
                className="w-full bg-slate-950 rounded-lg border border-slate-700 rounded pl-8 p-2 text-white focus:border-blue-500 outline-none uppercase"
                placeholder="ABC-1234"
                value={formData.truckPlateNumber}
                onChange={(e) =>
                  setFormData({ ...formData, truckPlateNumber: e.target.value })
                }
              />
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            {/* UNASSIGN BUTTON */}
            {trip.driverName && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Remove driver and truck info?"))
                    handleSubmitUnassign(null, true);
                }}
                disabled={loading}
                className="px-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
                title="Unassign Driver"
              >
                <FontAwesomeIcon icon={faUserSlash} />
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex justify-center items-center gap-2"
            >
              {loading ? (
                "Saving..."
              ) : (
                <>
                  <FontAwesomeIcon icon={faSave} /> Save Assignment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
