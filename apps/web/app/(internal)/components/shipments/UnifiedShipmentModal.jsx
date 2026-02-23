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
import { useAlert } from "@/app/context/AlertContext";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export default function UnifiedShipmentModal({ profile, isOpen, onClose, isDark = false }) {
  const { showAlert, showConfirm } = useAlert();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [shipmentDraft, setShipmentDraft] = useState(null);
  const [finalTripId, setFinalTripId] = useState(null);
  const [createdShipmentId, setCreatedShipmentId] = useState(null);

  // NEW: SMS State
  const [sendSms, setSendSms] = useState(true);

  const generateShipmentId = (originCode, destCode) => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Date.now().toString().slice(-6);
    return `AT-${dateStr}-${originCode || "GEN"}-${destCode || "GEN"}-${random}`;
  };

  const handleMasterSubmit = async (tripDecision) => {
    console.log("shipdata to be uploaded: ", shipmentDraft);

    const executeSubmission = async () => {
      setLoading(true);
      try {
        // 1. GENERATE ID HERE (Client Side)
        const originCode = shipmentDraft.routeInfo.originCode || "GEN";
        const destCode = shipmentDraft.routeInfo.destinationCode || "GEN";
        const manualShipmentId = generateShipmentId(originCode, destCode);

        let uploadedUrls = [];
        if (shipmentDraft.imageFiles && shipmentDraft.imageFiles.length > 0) {
          const uploadPromises = shipmentDraft.imageFiles.map(
            async (file, index) => {
              // Filename: AT-2026...-123456_1.jpg
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

        if (uploadedUrls.length === 0) {
          alert("Add Images before proceeding");
          return;
        }

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

          manualShipmentId: manualShipmentId,
          proofOfReceipt: uploadedUrls,
        };

        console.log("payload: ", payload);

        const shipmentRes = await createShipmentWithPackages(payload);
        let newShipmentId = manualShipmentId;
        if (!newShipmentId) {
          newShipmentId = shipmentRes.data.shipmentId;
        }
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
        // showAlert("error", "Error", err.message);
        console.log(err);
        alert("error: ", err.message);
      } finally {
        setLoading(false);
      }
    };

    if (tripDecision && tripDecision.tripId) {
      // Case A: Trip Selected -> Ask Permission -> Then Run
      // showConfirm(
      //   "Confirm Assignment",
      //   `Confirm assignment to Trip: ${tripDecision.tripId}?\nThis will generate labels for this trip immediately.`,
      //   executeSubmission, // <--- PASS THE FUNCTION, DON'T CALL IT
      // );
      alert("Confirm");
    } else {
      // Case B: No Trip -> Run Immediately
      executeSubmission();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md sm:p-4 ${
      isDark ? "bg-slate-950/90" : "bg-black/40"
    }`}>
      <div className={`relative w-full max-w-4xl sm:rounded-xl shadow-xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[90vh] border ${
        isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
      }`}>
        {loading && (
          <div className={`absolute inset-0 z-[100] backdrop-blur-sm flex flex-col items-center justify-center ${
            isDark ? "bg-slate-900/80" : "bg-white/90"
          }`}>
            <FontAwesomeIcon
              icon={faCircleNotch}
              spin
              className="text-4xl text-blue-500 mb-4"
            />
            <p className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Processing Shipment...</p>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {step === 1 && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className={`p-4 sm:p-6 border-b flex justify-between items-center shrink-0 ${
                isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"
              }`}>
                <h2 className={`text-lg sm:text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  1. Shipment Details
                </h2>
                <button
                  onClick={onClose}
                  className={`p-2 transition-colors ${isDark ? "text-slate-500 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
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
                isDark={isDark}
              />
            </div>
          )}

          {/* --- STEP 2: TRIP SELECTION --- */}
          {step === 2 && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className={`p-4 sm:p-6 border-b flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 shrink-0 ${
                isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"
              }`}>
                <div className="flex justify-between items-center w-full sm:w-auto">
                  <h2 className={`text-lg sm:text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    2. Select Trip
                  </h2>
                  <button
                    onClick={onClose}
                    className={`sm:hidden p-2 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:gap-6 w-full sm:w-auto">
                  <label className={`flex items-center gap-2 cursor-pointer group p-2 sm:p-0 rounded-lg sm:border-0 ${
                    isDark ? "bg-slate-900 border border-slate-800" : "bg-slate-100 border border-slate-200 sm:bg-transparent"
                  }`}>
                    <input
                      type="checkbox"
                      className={`w-4 h-4 rounded text-blue-600 focus:ring-blue-500 ${
                        isDark ? "border-slate-700 bg-slate-800 focus:ring-offset-slate-900" : "border-slate-300 bg-white focus:ring-offset-white"
                      }`}
                      checked={sendSms}
                      onChange={(e) => setSendSms(e.target.checked)}
                    />
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold uppercase tracking-tight ${
                        sendSms ? (isDark ? "text-slate-200" : "text-slate-800") : (isDark ? "text-slate-500" : "text-slate-500")
                      }`}>
                        Notify SMS
                      </span>
                    </div>
                  </label>

                  <button
                    onClick={() => handleMasterSubmit(null)}
                    className="flex-1 sm:flex-none text-xs sm:text-sm font-bold text-amber-500 hover:text-amber-400 border border-amber-500/30 bg-amber-500/10 px-3 py-2 sm:py-1.5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Skip trip assignment & Save
                  </button>

                  <button
                    onClick={onClose}
                    className={`hidden sm:block transition-colors ${isDark ? "text-slate-500 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <TripStep
                  shipmentDraft={shipmentDraft}
                  onBack={() => setStep(1)}
                  onComplete={handleMasterSubmit}
                  isDark={isDark}
                />
              </div>
            </div>
          )}

          {/* --- STEP 3: SUCCESS --- */}
          {step === 3 && (
            <div className="p-6 sm:p-12 text-center space-y-6 flex-1 flex flex-col justify-center items-center h-full overflow-y-auto">
              <FontAwesomeIcon
                icon={finalTripId ? faCheckCircle : faBoxOpen}
                className={`text-5xl sm:text-6xl ${finalTripId ? "text-emerald-500" : "text-amber-500"}`}
              />
              <div>
                <h2 className={`text-xl sm:text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  {finalTripId
                    ? `Shipment Assigned to ${finalTripId}`
                    : "Shipment Created as Pending"}
                </h2>
                {sendSms && (
                  <p className="text-emerald-600 text-xs font-bold mt-2 uppercase tracking-widest">
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
                  className={`w-full py-3 sm:py-4 rounded-xl font-bold border transition-colors text-sm sm:text-base ${
                    isDark ? "bg-slate-800 text-white border-slate-700 hover:bg-slate-700" : "bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300"
                  }`}
                >
                  {finalTripId
                    ? "Print Trip Labels"
                    : "Print Individual Waybill"}
                </button>
                <button
                  onClick={() => {
                    onClose();
                    setStep(1);
                  }}
                  className="w-full py-3 sm:py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm sm:text-base"
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
