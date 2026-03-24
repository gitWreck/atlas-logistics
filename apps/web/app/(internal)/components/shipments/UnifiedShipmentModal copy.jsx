"use client";
import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faCircleNotch,
  faBoxOpen,
  faCommentSms,
  faArrowRight,
  faStore,
  faTruckPickup,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import ReceivePackageForm from "./ReceivePackageForm/ReceivePackageForm";
import TripStep from "../manifests/CreateTripModal/TripStep";
import {
  createShipmentWithPackages,
  assignShipmentToTruckTrip,
  createShipmentBundle,
} from "@/app/utility/FirebaseFunctions";
import { useAlert } from "@/app/context/AlertContext";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export default function UnifiedShipmentModal({
  profile,
  isOpen,
  onClose,
  isDark = false,
  user,
  onSuccess, // Callback to trigger after successful shipment creation
  resetTrigger, // A prop that can be used to reset the form when needed
}) {
  const { showAlert, showConfirm } = useAlert();

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
    // return `AT-${dateStr}-${originCode || "GEN"}-${destCode || "GEN"}-${random}`;
    return `AT-${dateStr}-SHP-${random}`;
  };

  useEffect(() => {
    if (resetTrigger) {
      setShipmentDraft(null);
      setFinalTripId(null);
      setCreatedShipmentId(null);
      setSendSms(true);
      setIsPickup(false);
    }
  }, [resetTrigger]);

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
        status: isPickup === true ? "PENDING_PICKUP" : "RECEIVED",

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
      const hasBundles = shipmentDraft.items.some(
        (item) =>
          item.packagingType === "Sack" || item.packagingType === "Bundle",
      );

      let shipmentRes;
      if (hasBundles) {
        // Calls the version that puts Quantity INSIDE the package object
        shipmentRes = await createShipmentBundle(payload);
      } else {
        // Calls the original version that loops and creates SHP-01, SHP-02, etc.
        shipmentRes = await createShipmentWithPackages(payload);
      }
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

        setShipmentDraft(null);

        window.open(
          `/components/print/labels?tripId=${targetTripId}`,
          "_blank",
        );
      } else {
        setFinalTripId(null);
      }

      onSuccess(); // Trigger parent callback to refresh data and close modal if needed
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
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md sm:p-4 ${
        isDark ? "bg-slate-950/90" : "bg-black/40"
      }`}
    >
      {/* Modal Container */}
      <div
        className={`relative w-full max-w-4xl sm:rounded-xl shadow-xl overflow-hidden flex flex-col h-full sm:h-auto sm:min-h-[600px] sm:max-h-[90vh] border ${
          isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
        }`}
      >
        {loading && (
          <div
            className={`absolute inset-0 z-[100] backdrop-blur-sm flex flex-col items-center justify-center ${
              isDark ? "bg-slate-900/80" : "bg-white/90"
            }`}
          >
            <FontAwesomeIcon
              icon={faCircleNotch}
              spin
              className="text-4xl text-blue-500 mb-4"
            />
            <p
              className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Processing Shipment...
            </p>
          </div>
        )}

        {/* --- GLOBAL HEADER --- */}
        <div
          className={`p-4 sm:p-6 border-b flex justify-between items-center shrink-0 ${
            isDark
              ? "border-slate-800 bg-slate-950"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="flex flex-col">
            <h2
              className={`text-lg sm:text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
            >
              {step === 1
                ? "1. Shipment Details"
                : step === 2
                  ? "2. Select Trip"
                  : "3. Complete"}
            </h2>
            {step === 1 && (
              <p
                className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
              >
                Fill in the package and routing info.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? "text-slate-500 hover:text-white"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-300"
            }`}
          >
            ✕
          </button>
        </div>

        {/* --- MAIN CONTENT AREA --- */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {step === 1 && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Pickup / Drop-off Toggle Bar */}
              <div
                className={`p-4 border-b flex justify-center shrink-0 ${
                  isDark
                    ? "bg-slate-950 border-slate-800"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div
                  className={`p-1 rounded-xl border flex w-full max-w-md ${
                    isDark
                      ? "bg-slate-900 border-slate-700"
                      : "bg-white border-slate-300"
                  }`}
                >
                  <button
                    onClick={() => setIsPickup(false)}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      !isPickup
                        ? "bg-blue-600 text-white shadow"
                        : isDark
                          ? "text-slate-400 hover:text-slate-200"
                          : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <FontAwesomeIcon icon={faStore} /> Warehouse Drop-off
                  </button>
                  <button
                    onClick={() => setIsPickup(true)}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      isPickup
                        ? "bg-amber-600 text-white shadow"
                        : isDark
                          ? "text-slate-400 hover:text-slate-200"
                          : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <FontAwesomeIcon icon={faTruckPickup} /> Pickup
                  </button>
                </div>
              </div>

              {/* The Form */}
              <ReceivePackageForm
                key={shipmentDraft ? "draft-active" : "new-form"} // ✅ Force re-mount when draft is cleared
                profile={profile}
                onNext={(data) => {
                  setShipmentDraft(data);
                  setStep(2);
                }}
                initialData={shipmentDraft}
                isDark={isDark}
                isPickupMode={isPickup}
                user={user}
              />
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <TripStep
                  key={
                    shipmentDraft
                      ? `trip-${shipmentDraft.routeInfo.destinationCode}`
                      : "trip-reset"
                  }
                  shipmentDraft={shipmentDraft}
                  onBack={() => setStep(1)}
                  onComplete={handleMasterSubmit}
                  isDark={isDark}
                  isPickupMode={isPickup}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="p-6 sm:p-12 text-center space-y-6 flex-1 flex flex-col justify-center items-center h-full overflow-y-auto">
              <FontAwesomeIcon
                icon={finalTripId ? faCheckCircle : faBoxOpen}
                className={`text-5xl sm:text-6xl ${finalTripId ? "text-emerald-500" : "text-amber-500"}`}
              />
              <div>
                <h2
                  className={`text-xl sm:text-2xl font-bold ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {finalTripId
                    ? `Shipment Assigned to ${finalTripId}`
                    : `Shipment Created (${isPickup ? "Pending Pickup" : "Pending"})`}
                </h2>
                {sendSms && (
                  <p
                    className={`text-xs font-bold mt-2 uppercase tracking-widest flex justify-center items-center gap-2 ${
                      isDark ? "text-emerald-400" : "text-emerald-600"
                    }`}
                  >
                    <FontAwesomeIcon icon={faCommentSms} />
                    <span>SMS Notifications Queued</span>
                  </p>
                )}
              </div>
              <div className="w-full max-w-xs space-y-3 mt-4">
                {/* PRINT BUTTON */}
                <button
                  onClick={() =>
                    window.open(
                      finalTripId
                        ? `/components/print/labels?tripId=${finalTripId}`
                        : `/components/print/labels?id=${createdShipmentId}`,
                      "_blank",
                    )
                  }
                  className={`w-full py-3 rounded-xl font-bold border transition-colors ${isDark ? "bg-slate-800 text-white border-slate-700 hover:bg-slate-700" : "bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300"}`}
                >
                  {finalTripId
                    ? "Print Trip Labels"
                    : "Print Individual Waybill"}
                </button>

                {/* ✅ NEW: CREATE ANOTHER BUTTON */}
                <button
                  onClick={() => {
                    setStep(1);
                    setFinalTripId(null);
                    setCreatedShipmentId(null);
                    setShipmentDraft(null); // This triggers the 'key' reset we set up
                  }}
                  className="w-full py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Create Another Shipment</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* --- UNIFIED FOOTER --- */}
        <div
          className={`p-4 sm:p-6 border-t flex flex-col sm:flex-row items-center gap-4 shrink-0 ${
            isDark
              ? "border-slate-800 bg-slate-950"
              : "border-slate-200 bg-slate-50"
          }`}
        >
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
                  className={`w-4 h-4 rounded text-blue-600 focus:ring-blue-500 ${
                    isDark
                      ? "border-slate-700 bg-slate-800 focus:ring-offset-slate-900"
                      : "border-slate-300 bg-white focus:ring-offset-white"
                  }`}
                  checked={sendSms}
                  onChange={(e) => setSendSms(e.target.checked)}
                />
                <span
                  className={`text-xs font-bold uppercase tracking-tight ${
                    sendSms
                      ? isDark
                        ? "text-slate-200"
                        : "text-slate-800"
                      : isDark
                        ? "text-slate-500"
                        : "text-slate-500"
                  }`}
                >
                  Notify Sender/Recipient via SMS
                </span>
              </label>

              {/* Right Side: Actions */}
              <div className="flex w-full sm:w-auto sm:ml-auto gap-2">
                <button
                  onClick={() => setStep(1)}
                  className={`px-6 py-3 rounded-xl border font-bold transition-colors ${
                    isDark
                      ? "border-slate-700 text-slate-400 hover:bg-slate-800"
                      : "border-slate-300 text-slate-600 hover:bg-slate-200"
                  }`}
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
                setFinalTripId(null); // ✅ Clear success state
                setCreatedShipmentId(null); // ✅ Clear success state
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
