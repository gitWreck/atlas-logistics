"use client";
import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faCircleNotch,
} from "@fortawesome/free-solid-svg-icons";
import ReceivePackageForm from "./ReceivePackageForm/ReceivePackageForm";
import TripStep from "../manifests/CreateTripModal/TripStep";
import {
  createShipmentWithPackages,
  assignShipmentToTruckTrip,
} from "@/app/utility/FirebaseFunctions";

export default function UnifiedShipmentModal({ profile, isOpen, onClose }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [shipmentDraft, setShipmentDraft] = useState(null);
  const [finalTripId, setFinalTripId] = useState(null);

  const handleMasterSubmit = async (tripDecision) => {
    setLoading(true);
    try {
      // Since trip is already created in the Step 2 UI, we just create the shipment
      const shipmentRes = await createShipmentWithPackages({
        ...shipmentDraft,
        origin: shipmentDraft.routeInfo.origin,
        originCode: shipmentDraft.routeInfo.originCode,
        destination: shipmentDraft.routeInfo.destination,
        destinationCode: shipmentDraft.routeInfo.destinationCode,
      });

      const newShipmentId = shipmentRes.data.shipmentId;
      const targetTripId = tripDecision.tripId;

      // Assign to the trip selected from the list
      await assignShipmentToTruckTrip({
        trackingDocId: newShipmentId,
        truckTripId: targetTripId,
      });

      setFinalTripId(targetTripId);
      setStep(3);
      window.open(`/admin/print-labels?tripId=${targetTripId}`, "_blank");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md"
        onClick={loading ? null : onClose}
      />
      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-xl shadow-xl overflow-hidden flex flex-col min-h-[600px] max-h-[90vh]">
        {loading && (
          <div className="absolute inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <FontAwesomeIcon
              icon={faCircleNotch}
              spin
              className="text-4xl text-blue-500 mb-4"
            />
            <p className="text-white font-bold">
              Finalizing Shipment Assignment...
            </p>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {step === 1 && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex justify-between">
                <h2 className="text-xl font-bold text-white">
                  1. Shipment Details
                </h2>
                <button onClick={onClose} className="text-slate-500">
                  ✕
                </button>
              </div>
              <ReceivePackageForm
                profile={profile}
                onNext={(data) => {
                  setShipmentDraft(data);
                  setStep(2);
                }}
                initialData={shipmentDraft}
              />
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex justify-between">
                <h2 className="text-xl font-bold text-white">2. Select Trip</h2>
                <button onClick={onClose} className="text-slate-500">
                  ✕
                </button>
              </div>
              <TripStep
                shipmentDraft={shipmentDraft}
                onBack={() => setStep(1)}
                onComplete={handleMasterSubmit}
              />
            </div>
          )}

          {step === 3 && (
            <div className="p-12 text-center space-y-6 flex-1 flex flex-col justify-center items-center">
              <FontAwesomeIcon
                icon={faCheckCircle}
                className="text-6xl text-emerald-500"
              />
              <h2 className="text-2xl font-bold text-white">
                Shipment Linked to {finalTripId}
              </h2>
              <button
                onClick={() =>
                  window.open(
                    `/admin/print-labels?tripId=${finalTripId}`,
                    "_blank",
                  )
                }
                className="w-full max-w-xs py-4 bg-slate-800 text-white rounded-xl font-bold border border-slate-700"
              >
                Print Labels
              </button>
              <button
                onClick={onClose}
                className="w-full max-w-xs py-4 bg-blue-600 text-white rounded-xl font-bold"
              >
                Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
