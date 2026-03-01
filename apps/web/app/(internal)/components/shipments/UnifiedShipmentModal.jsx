"use client";
import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faCircleNotch,
  faBoxOpen,
  faCommentSms,
  faArrowRight,
  faStore,
  faTruckPickup,
} from "@fortawesome/free-solid-svg-icons";
import ReceivePackageForm from "./ReceivePackageForm/ReceivePackageForm";
import TripStep from "../manifests/CreateTripModal/TripStep";
import {
  createShipmentWithPackages,
  assignShipmentToTruckTrip,
} from "@/app/utility/FirebaseFunctions";
import { useAlert } from "@/app/context/AlertContext";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export default function UnifiedShipmentModal({ profile, isOpen, onClose }) {
  const { showAlert } = useAlert();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [shipmentDraft, setShipmentDraft] = useState(null);
  const [finalTripId, setFinalTripId] = useState(null);
  const [createdShipmentId, setCreatedShipmentId] = useState(null);

  // States controlled by the Modal Header/Footer, passed down to forms
  const [sendSms, setSendSms] = useState(true);
  const [isPickup, setIsPickup] = useState(false);

  const generateShipmentId = (originCode, destCode) => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Date.now().toString().slice(-6);
    return `AT-${dateStr}-${originCode || "GEN"}-${destCode || "GEN"}-${random}`;
  };

  const handleMasterSubmit = async (tripDecision) => {
    setLoading(true);
    try {
      const originCode = shipmentDraft.routeInfo.originCode || "GEN";
      const destCode = shipmentDraft.routeInfo.destinationCode || "GEN";
      const manualShipmentId = generateShipmentId(originCode, destCode);

      // --- Upload Images ---
      let uploadedUrls = [];
      if (shipmentDraft.imageFiles && shipmentDraft.imageFiles.length > 0) {
        const uploadPromises = shipmentDraft.imageFiles.map(
          async (file, index) => {
            const ext = file.name.split(".").pop();
            const fileName = `proof_of_receipt_${manualShipmentId}_${index + 1}.${ext}`;
            const storageRef = ref(
              storage,
              `shipments/${manualShipmentId}/${fileName}`,
            );
            const snapshot = await uploadBytes(storageRef, file);
            return await getDownloadURL(snapshot.ref);
          },
        );
        uploadedUrls = await Promise.all(uploadPromises);
      }

      if (isPickup !== true) {
        if (uploadedUrls.length === 0) {
          setLoading(false);
          return alert("Add Images before proceeding");
        }
      }

      // --- Construct Payload ---
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

        // Dynamic Status based on Pickup Toggle
        status: isPickup ? "PENDING_PICKUP" : "RECEIVED",

        // If pickup, the location is the sender's city. If dropoff, it's the origin warehouse.
        currentLocation: isPickup
          ? `${shipmentDraft.sender.barangay || ""} ${shipmentDraft.sender.city}`.trim()
          : shipmentDraft.routeInfo.origin,

        origin: shipmentDraft.routeInfo.origin,
        originCode: shipmentDraft.routeInfo.originCode,
        destination: shipmentDraft.routeInfo.destination,
        destinationCode: shipmentDraft.routeInfo.destinationCode,
        items: shipmentDraft.items,
        remarks: shipmentDraft.remarks,
        notifySms: sendSms,
        manualShipmentId: manualShipmentId,
        proofOfReceipt: uploadedUrls,
      };

      // --- Save to DB ---
      const shipmentRes = await createShipmentWithPackages(payload);
      const newShipmentId = shipmentRes?.data?.shipmentId || manualShipmentId;
      setCreatedShipmentId(newShipmentId);

      // --- Assign to Trip if selected ---
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
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md sm:p-4">
      {/* Modal Container */}
      <div className="relative bg-slate-900 border-x border-y border-slate-700 w-full max-w-4xl sm:rounded-xl shadow-xl overflow-hidden flex flex-col h-full sm:h-auto sm:min-h-[600px] sm:max-h-[90vh]">
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

        {/* --- GLOBAL HEADER --- */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex justify-between items-center shrink-0 bg-slate-950">
          <div className="flex flex-col">
            <h2 className="text-lg sm:text-xl font-bold text-white">
              {step === 1
                ? "1. Shipment Details"
                : step === 2
                  ? "2. Select Trip"
                  : "3. Complete"}
            </h2>
            {step === 1 && (
              <p className="text-xs text-slate-500 mt-1">
                Fill in the package and routing info.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white p-2 bg-slate-900 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {step === 1 && (
            <div className="flex flex-col h-full overflow-hidden relative">
              {/* Pickup / Drop-off Toggle Bar */}
              <div className="bg-slate-950/50 p-4 border-b border-slate-800 flex justify-center shrink-0">
                <div className="bg-slate-900 p-1 rounded-xl border border-slate-700 flex w-full max-w-md">
                  <button
                    onClick={() => setIsPickup(false)}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${!isPickup ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    <FontAwesomeIcon icon={faStore} /> Warehouse Drop-off
                  </button>
                  <button
                    onClick={() => setIsPickup(true)}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${isPickup ? "bg-amber-600 text-white shadow" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    <FontAwesomeIcon icon={faTruckPickup} /> Pickup
                  </button>
                </div>
              </div>

              {/* The Form */}
              <ReceivePackageForm
                profile={profile}
                onNext={(data) => {
                  setShipmentDraft(data);
                  setStep(2);
                }}
                initialData={shipmentDraft}
                isPickupMode={isPickup} // Pass mode so form can adjust fields if needed
              />
            </div>
          )}

          {step === 2 && (
            // Notice we removed the header and buttons from TripStep in previous steps
            // so it just renders the list cleanly here.
            <TripStep
              shipmentDraft={shipmentDraft}
              isPickupMode={isPickup} // So TripStep can filter by Local vs Transfer
              onComplete={handleMasterSubmit}
            />
          )}

          {step === 3 && (
            <div className="p-6 sm:p-12 text-center space-y-6 flex-1 flex flex-col justify-center items-center h-full overflow-y-auto">
              <FontAwesomeIcon
                icon={finalTripId ? faCheckCircle : faBoxOpen}
                className={`text-5xl sm:text-6xl ${finalTripId ? "text-emerald-500" : "text-amber-500"}`}
              />
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {finalTripId
                    ? `Shipment Assigned to ${finalTripId}`
                    : `Shipment Created (${isPickup ? "Pending Pickup" : "Pending"})`}
                </h2>
                {sendSms && (
                  <p className="text-emerald-400 text-xs font-bold mt-2 uppercase tracking-widest flex justify-center items-center gap-2">
                    <FontAwesomeIcon icon={faCommentSms} /> SMS Notifications
                    Queued
                  </p>
                )}
              </div>
              <div className="w-full max-w-xs space-y-3 mt-4">
                <button
                  onClick={() =>
                    window.open(
                      finalTripId
                        ? `/components/print/labels?tripId=${finalTripId}`
                        : `/components/print/labels?id=${createdShipmentId}`,
                      "_blank",
                    )
                  }
                  className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold border border-slate-700 hover:bg-slate-700 transition-colors text-sm"
                >
                  {finalTripId
                    ? "Print Trip Labels"
                    : "Print Individual Waybill"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* --- UNIFIED FOOTER --- */}
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center gap-4 shrink-0">
          {step === 1 && (
            <button
              type="submit"
              form="step1-form" // This targets the <form id="step1-form"> inside ReceivePackageForm
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 transition-colors"
            >
              <span>
                {isPickup
                  ? "Continue to Pickup Dispatch"
                  : "Continue to Trip Selection"}
              </span>
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          )}

          {step === 2 && (
            <>
              {/* Left Side: SMS Toggle */}
              <label className="flex items-center gap-2 cursor-pointer group w-full sm:w-auto mb-2 sm:mb-0">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
                  checked={sendSms}
                  onChange={(e) => setSendSms(e.target.checked)}
                />
                <span
                  className={`text-xs font-bold uppercase tracking-tight ${sendSms ? "text-slate-200" : "text-slate-500"}`}
                >
                  Notify Sender/Recipient via SMS
                </span>
              </label>

              {/* Right Side: Actions */}
              <div className="flex w-full sm:w-auto sm:ml-auto gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-xl border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => handleMasterSubmit(null)}
                  className="flex-1 sm:flex-none bg-amber-600/10 border border-amber-600/30 text-amber-500 hover:bg-amber-600/20 font-bold py-3 px-6 rounded-xl transition-colors whitespace-nowrap"
                >
                  Skip & Save as Pending
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <button
              onClick={() => {
                onClose();
                setStep(1);
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 py-3.5 rounded-xl font-bold text-white transition-colors"
            >
              Return to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
