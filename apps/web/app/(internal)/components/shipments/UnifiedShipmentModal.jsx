"use client";
import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faCircleNotch,
  faBoxOpen, // Icon for 'Pending' state
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
  const [createdShipmentId, setCreatedShipmentId] = useState(null); // Track ID for printing

  const handleMasterSubmit = async (tripDecision) => {
    setLoading(true);
    try {
      // 1. Always create the shipment first
      const shipmentRes = await createShipmentWithPackages({
        ...shipmentDraft,
        origin: shipmentDraft.routeInfo.origin,
        originCode: shipmentDraft.routeInfo.originCode,
        destination: shipmentDraft.routeInfo.destination,
        destinationCode: shipmentDraft.routeInfo.destinationCode,
      });

      const newShipmentId = shipmentRes.data.shipmentId;
      setCreatedShipmentId(newShipmentId);

      // 2. Check if the user selected a trip or clicked "Skip"
      if (tripDecision && tripDecision.tripId) {
        const targetTripId = tripDecision.tripId;

        // Assign to the trip
        await assignShipmentToTruckTrip({
          trackingDocId: newShipmentId,
          truckTripId: targetTripId,
        });

        setFinalTripId(targetTripId);
        // Only auto-open print labels if assigned to a trip (optional preference)
        window.open(`/admin/print-labels?tripId=${targetTripId}`, "_blank");
      } else {
        // Skip assignment logic
        setFinalTripId(null);
      }

      setStep(3);
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
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <FontAwesomeIcon
              icon={faCircleNotch}
              spin
              className="text-4xl text-blue-500 mb-4"
            />
            <p className="text-white font-bold">Processing Shipment...</p>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* STEP 1: DETAILS */}
          {step === 1 && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex justify-between">
                <h2 className="text-xl font-bold text-white">
                  1. Shipment Details
                </h2>
                <button
                  onClick={onClose}
                  className="text-slate-500 hover:text-white"
                >
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

          {/* STEP 2: TRIP SELECTION (With Skip Option) */}
          {step === 2 && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">2. Select Trip</h2>

                <div className="flex items-center gap-4">
                  {/* NEW: Skip Button */}
                  <button
                    onClick={() => handleMasterSubmit(null)}
                    className="text-sm font-bold text-amber-500 hover:text-amber-400 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Skip & Save as Pending
                  </button>

                  <button
                    onClick={onClose}
                    className="text-slate-500 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <TripStep
                shipmentDraft={shipmentDraft}
                onBack={() => setStep(1)}
                onComplete={handleMasterSubmit}
              />
            </div>
          )}

          {/* STEP 3: SUCCESS (Dynamic based on assignment) */}
          {step === 3 && (
            <div className="p-12 text-center space-y-6 flex-1 flex flex-col justify-center items-center">
              <FontAwesomeIcon
                icon={finalTripId ? faCheckCircle : faBoxOpen}
                className={`text-6xl ${finalTripId ? "text-emerald-500" : "text-amber-500"}`}
              />

              <div>
                <h2 className="text-2xl font-bold text-white">
                  {finalTripId
                    ? `Shipment Linked to ${finalTripId}`
                    : "Shipment Created Successfully"}
                </h2>
                {!finalTripId && (
                  <p className="text-slate-400 mt-2">
                    This shipment is saved in the warehouse (Pending) and can be
                    assigned to a trip later.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="w-full max-w-xs space-y-3">
                {/* Only show "Print Trip Labels" if assigned, otherwise show "Print Waybill" */}
                {finalTripId ? (
                  <button
                    onClick={() =>
                      window.open(
                        `/admin/print-labels?tripId=${finalTripId}`,
                        "_blank",
                      )
                    }
                    className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold border border-slate-700 hover:bg-slate-700 transition-colors"
                  >
                    Print Trip Labels
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      window.open(
                        `/admin/print-waybill?id=${createdShipmentId}`, // Assuming you have a single waybill print page
                        "_blank",
                      )
                    }
                    className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold border border-slate-700 hover:bg-slate-700 transition-colors"
                  >
                    Print Individual Waybill
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
