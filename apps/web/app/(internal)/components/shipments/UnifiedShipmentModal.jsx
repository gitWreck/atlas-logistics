"use client";
import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faCircleNotch,
  faBoxOpen,
  faCommentSms, // New icon for SMS
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
  const [createdShipmentId, setCreatedShipmentId] = useState(null);

  // NEW: SMS State
  const [sendSms, setSendSms] = useState(true);

  const handleMasterSubmit = async (tripDecision) => {
    // NEW: Confirmation Logic for Trip Assignment
    if (tripDecision && tripDecision.tripId) {
      const confirmAssign = window.confirm(
        `Confirm assignment to Trip: ${tripDecision.tripId}?\nThis will generate labels for this trip immediately.`,
      );
      if (!confirmAssign) return;
    }

    setLoading(true);
    try {
      const payload = {
        sender: {
          name: shipmentDraft.sender.name,
          phone: shipmentDraft.sender.phone,
          details: {
            unit: shipmentDraft.sender.unit,
            street: shipmentDraft.sender.street,
            barangay: shipmentDraft.sender.barangay,
            city: shipmentDraft.sender.city, // Optional: Keep manual city entry for door-to-door info
            province: shipmentDraft.sender.province,
          },
        },

        recipient: {
          name: shipmentDraft.recipient.name,
          phone: shipmentDraft.recipient.phone,
          details: {
            unit: shipmentDraft.recipient.unit,
            street: shipmentDraft.recipient.street,
            barangay: shipmentDraft.recipient.barangay,
            city: shipmentDraft.recipient.city,
            province: shipmentDraft.recipient.province,
          },
        },

        // --- 3. UPDATED: USE ROUTE INFO FOR CODES ---

        origin: shipmentDraft.routeInfo.origin,
        originCode: shipmentDraft.routeInfo.originCode,
        destination: shipmentDraft.routeInfo.destination,
        destinationCode: shipmentDraft.routeInfo.destinationCode,
        items: shipmentDraft.items,
        remarks: shipmentDraft.remarks,
        notifySms: sendSms,
      };

      const shipmentRes = await createShipmentWithPackages(payload);
      const newShipmentId = shipmentRes.data.shipmentId;
      setCreatedShipmentId(newShipmentId);

      if (tripDecision && tripDecision.tripId) {
        const targetTripId = tripDecision.tripId;
        await assignShipmentToTruckTrip({
          trackingDocId: newShipmentId,
          truckTripId: targetTripId,
        });

        setFinalTripId(targetTripId);
        window.open(
          `/components/print/labels?tripId=${targetTripId}`,
          "_blank",
        );
      } else {
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
      {/* Backdrop */}
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

          {step === 2 && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">2. Select Trip</h2>

                <div className="flex items-center gap-6">
                  {/* NEW: SMS Notification Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                      checked={sendSms}
                      onChange={(e) => setSendSms(e.target.checked)}
                    />
                    <div className="flex items-center gap-1.5">
                      <FontAwesomeIcon
                        icon={faCommentSms}
                        className={`text-sm ${sendSms ? "text-blue-400" : "text-slate-500"}`}
                      />
                      <span
                        className={`text-xs font-bold uppercase tracking-tight ${sendSms ? "text-slate-200" : "text-slate-500"}`}
                      >
                        Notify SMS
                      </span>
                    </div>
                  </label>

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

          {/* Step 3 remains similar, icons already handle dynamic logic */}
          {step === 3 && (
            <div className="p-12 text-center space-y-6 flex-1 flex flex-col justify-center items-center">
              <FontAwesomeIcon
                icon={finalTripId ? faCheckCircle : faBoxOpen}
                className={`text-6xl ${finalTripId ? "text-emerald-500" : "text-amber-500"}`}
              />
              {/* ... Success Message and Buttons ... */}
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {finalTripId
                    ? `Shipment Assigned to ${finalTripId}`
                    : "Shipment Created as Pending"}
                </h2>
                {sendSms && (
                  <p className="text-emerald-400 text-xs font-bold mt-2 uppercase tracking-widest">
                    <FontAwesomeIcon icon={faCommentSms} className="mr-2" />
                    SMS Notifications Queued
                  </p>
                )}
              </div>
              <div className="w-full max-w-xs space-y-3">
                <button
                  onClick={() =>
                    window.open(
                      finalTripId
                        ? `/components/print/labels?tripId=${finalTripId}`
                        : `/components/print/labels?id=${createdShipmentId}`,
                      "_blank",
                    )
                  }
                  className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold border border-slate-700 hover:bg-slate-700 transition-colors"
                >
                  {finalTripId
                    ? "Print Trip Labels"
                    : "Print Individual Waybill"}
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold"
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
