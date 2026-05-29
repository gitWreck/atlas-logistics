"use client";
import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faCircleNotch,
  faBoxOpen,
  faBell,
  faArrowRight,
  faStore,
  faTruckPickup,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import ReceivePackageForm from "../ReceivePackageForm/ReceivePackageForm";
import TripStep from "./TripStep";
import {
  assignShipmentToTrip,
  bulkAssignShipments,
  // createShipmentWithPackages,
  // createShipmentBundle,
  createShipment,
} from "@/app/utility/FirebaseFunctions";
import { useAlert } from "@/app/context/AlertContext";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import {
  packageLabelUrl,
  shipmentLabelUrl,
} from "@/app/utility/constant/templates";
import { updatedBy } from "@/app/utility/utilities";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import CustomerNotificationChannels, {
  DEFAULT_CUSTOMER_NOTIFICATION_CHANNELS,
} from "../../notifications/CustomerNotificationChannels";

export default function UnifiedShipmentModal({
  profile,
  isOpen,
  onClose,
  isDark = false,
  user,
  onSuccess, // Callback to trigger after successful shipment creation
  resetTrigger, // A prop that can be used to reset the form when needed
  editData = null, // ✅ NEW: Accept existing shipment data
}) {
  const { showAlert, showConfirm } = useAlert();
  console.log("UnifiedShipmentModal Rendered with editData:", editData);
  const modalTheme = getModalThemeClasses(isDark);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [shipmentDraft, setShipmentDraft] = useState(null);
  const [finalTripId, setFinalTripId] = useState(null);
  const [createdShipmentId, setCreatedShipmentId] = useState(null);
  const [wantsTripAssignment, setWantsTripAssignment] = useState(false);

  // States controlled by the Modal Header/Footer, passed down to forms
  const [notificationChannels, setNotificationChannels] = useState(
    DEFAULT_CUSTOMER_NOTIFICATION_CHANNELS,
  );
  const [isPickup, setIsPickup] = useState(false);

  const generateShipmentId = (originCode, destCode) => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Date.now().toString().slice(-6);
    // return `AT-${dateStr}-${originCode || "GEN"}-${destCode || "GEN"}-${random}`;
    return `AT-${dateStr}-SHP-${random}`;
  };

  // ✅ FIXED 1 & 2: Pre-fill form and explicitly flatten the nested address data
  useEffect(() => {
    if (editData && isOpen) {
      setShipmentDraft({
        routeInfo: {
          origin: editData.origin || "",
          originCode: editData.originCode || "",
          destination: editData.destination || "",
          destinationCode: editData.destinationCode || "",
        },
        // Flatten the sender address so ReceivePackageForm can read it properly
        sender: {
          name: editData.sender?.name || "",
          phone: editData.sender?.phone || "",
          ...(editData.sender?.address || editData.sender?.details || {}),
        },
        // Flatten the recipient address
        recipient: {
          name: editData.recipient?.name || "",
          phone: editData.recipient?.phone || "",
          ...(editData.recipient?.address || editData.recipient?.details || {}),
        },
        items: editData.packages || editData.items || [],
        remarks: editData.remarks || "",
        imageFiles: [],
        previews: [],
      });

      // Force it into pickup mode if the original was a pickup
      setIsPickup(
        editData.isPickupRequested === true ||
          editData.status === "PENDING_PICKUP",
      );
    }
  }, [editData, isOpen]);

  // ✅ FIXED 3: Prevent race condition by NOT resetting if we are in "Edit Mode"
  useEffect(() => {
    // Only reset if resetTrigger fires AND we are not trying to edit
    if (resetTrigger && !editData) {
      setShipmentDraft(null);
      setFinalTripId(null);
      setCreatedShipmentId(null);
      setWantsTripAssignment(false);
      setNotificationChannels(DEFAULT_CUSTOMER_NOTIFICATION_CHANNELS);
      setIsPickup(false);
    }
  }, [resetTrigger, editData]);

  // to update with new firebase function
  const handleMasterSubmit = async (tripDecision) => {
    console.log("shipment draft: ", shipmentDraft);
    setLoading(true);
    try {
      const originCode = shipmentDraft.routeInfo.originCode || "GEN";
      const destCode = shipmentDraft.routeInfo.destinationCode || "GEN";

      // We only generate a manual ID if we are creating a NEW shipment
      const isEditMode = !!(editData && editData.id);
      const targetShipmentId = isEditMode
        ? editData.id
        : generateShipmentId(originCode, destCode);

      // --- Upload Images ---
      let uploadedUrls = [];
      if (shipmentDraft.imageFiles && shipmentDraft.imageFiles.length > 0) {
        const uploadPromises = shipmentDraft.imageFiles.map(
          async (file, index) => {
            const ext = file.name.split(".").pop();
            const fileName = `proof_of_receipt_${targetShipmentId}_${index + 1}.${ext}`;
            const storageRef = ref(
              storage,
              `shipments/${targetShipmentId}/${fileName}`,
            );
            const snapshot = await uploadBytes(storageRef, file);
            return await getDownloadURL(snapshot.ref);
          },
        );
        uploadedUrls = await Promise.all(uploadPromises);
      }

      // Enforce image rule only for new drop-offs
      if (!isPickup && !isEditMode && uploadedUrls.length === 0) {
        setLoading(false);
        return alert("Add Images before proceeding");
      }

      // --- Construct Base Payload ---
      const payload = {
        sender: {
          name: shipmentDraft.sender.name,
          phone: shipmentDraft.sender.phone,
          address: {
            unit: shipmentDraft.sender.unit,
            street: shipmentDraft.sender.street,
            barangay: shipmentDraft.sender.barangay,
            city: shipmentDraft.sender.city,
            province: shipmentDraft.sender.province,
          },
        },
        recipient: {
          name: shipmentDraft.recipient.name,
          phone: shipmentDraft.recipient.phone,
          address: {
            unit: shipmentDraft.recipient.unit,
            street: shipmentDraft.recipient.street,
            barangay: shipmentDraft.recipient.barangay,
            city: shipmentDraft.recipient.city,
            province: shipmentDraft.recipient.province,
          },
        },
        // If it's an edit, we don't force it back to PENDING_PICKUP if it's already past that
        status:
          isEditMode && editData.status !== "PENDING_PICKUP"
            ? editData.status
            : isPickup
              ? "PENDING_PICKUP"
              : "RECEIVED",

        currentLocation: isPickup
          ? `${shipmentDraft.sender.barangay || ""} ${shipmentDraft.sender.city}`.trim()
          : shipmentDraft.routeInfo.origin,

        origin: shipmentDraft.routeInfo.origin,
        originCode: shipmentDraft.routeInfo.originCode,
        destination: shipmentDraft.routeInfo.destination,
        destinationCode: shipmentDraft.routeInfo.destinationCode,
        items: shipmentDraft.items,
        remarks: shipmentDraft.remarks,
        notify: Object.values(notificationChannels).some(Boolean),
        notifySms: notificationChannels.sms,
        notifyEmail: notificationChannels.email,
        notifyPush: notificationChannels.push,
        notificationChannels,
        proofOfReceipt: uploadedUrls,
      };

      // --- Save to DB (Branch: Edit vs Create) ---
      let finalDocId = targetShipmentId;

      if (isEditMode) {
        // ✅ UPDATE MODE
        await updateShipmentDetails({
          shipmentId: finalDocId,
          updatedBy: updatedBy(profile),
          ...payload,
        });
      } else {
        // ❌ CREATE MODE
        payload.manualShipmentId = finalDocId; // Only pass manual ID on creation
        const shipmentRes = await createShipment(payload);
        finalDocId = shipmentRes?.data?.shipmentId || finalDocId;
      }

      setCreatedShipmentId(finalDocId);

      // --- Assign to Trip if selected ---
      if (tripDecision && tripDecision.tripId) {
        const targetTripId = tripDecision.tripId;
        // await assignShipmentToTrip({
        //   trackingShipmentId: finalDocId,
        //   tripId: targetTripId,
        // });

        await bulkAssignShipments({
          tripId: targetTripId,
          shipmentIds: [finalDocId],
          updatedBy: updatedBy(profile),
        });

        setFinalTripId(targetTripId);
        setShipmentDraft(null);
      } else {
        setFinalTripId(null);
      }

      if (onSuccess) onSuccess(); // Refresh the board
      setStep(3); // Show completion screen
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
      className={`fixed inset-0 z-50 flex items-center justify-center sm:p-4 ${modalTheme.overlay}`}
    >
      {/* Modal Container */}
      <div
        className={`relative w-full max-w-4xl sm:rounded-xl overflow-hidden flex flex-col h-full sm:h-auto sm:min-h-[600px] sm:max-h-[90vh] border ${modalTheme.modal}`}
      >
        {loading && (
          <div
            className={`absolute inset-0 z-[100] backdrop-blur-sm flex flex-col items-center justify-center ${modalTheme.processLoading}`}
          >
            <FontAwesomeIcon
              icon={faCircleNotch}
              spin
              className="text-4xl text-blue-500 mb-4"
            />
            <p className={`font-bold ${modalTheme.title}`}>
              Processing Shipment...
            </p>
          </div>
        )}

        {/* --- GLOBAL HEADER --- */}
        <div
          className={`p-4 sm:p-6 border-b flex justify-between items-center shrink-0 ${modalTheme.header}`}
        >
          <div className="flex flex-col">
            <h2 className={`text-lg sm:text-xl font-bold ${modalTheme.title}`}>
              {step === 1
                ? "1. Shipment Details"
                : step === 2
                  ? wantsTripAssignment
                    ? "2. Select Trip"
                    : "2. Save Shipment"
                  : "3. Complete"}
            </h2>
            {step === 1 && (
              <p className={`text-xs mt-1 ${modalTheme.bodyText}`}>
                Fill in the package and routing info.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${modalTheme.closeButton}`}
            aria-label="Close modal"
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
                className={`p-4 border-b flex justify-center shrink-0 ${modalTheme.header}`}
              >
                <div
                  className={`p-1 rounded-xl border flex w-full max-w-md ${modalTheme.panelSurface}`}
                >
                  <button
                    onClick={() => setIsPickup(false)}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      !isPickup
                        ? "bg-blue-600 text-white shadow"
                        : modalTheme.toggleIdle
                    }`}
                  >
                    <FontAwesomeIcon icon={faStore} /> Warehouse Drop-off
                  </button>
                  <button
                    onClick={() => setIsPickup(true)}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      isPickup
                        ? "bg-amber-600 text-white shadow"
                        : modalTheme.toggleIdle
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
                  setWantsTripAssignment(false);
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
              {wantsTripAssignment ? (
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <TripStep
                    key={
                      shipmentDraft
                        ? `trip-${shipmentDraft.routeInfo.destinationCode}`
                        : "trip-reset"
                    }
                    shipmentDraft={shipmentDraft}
                    onBack={() => setWantsTripAssignment(false)}
                    onComplete={handleMasterSubmit}
                    isDark={isDark}
                    isPickupMode={isPickup}
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
                  <div
                    className={`w-full max-w-xl rounded-xl border p-5 sm:p-6 space-y-5 ${modalTheme.panelSurface}`}
                  >
                    <div className="text-center space-y-2">
                      <h3 className={`text-lg font-bold ${modalTheme.title}`}>
                        Ready to Save Shipment
                      </h3>
                      <p className={`text-sm ${modalTheme.bodyText}`}>
                        Trip assignment is optional. Save now to keep the
                        shipment unassigned, or assign it to a trip before
                        saving.
                      </p>
                    </div>

                    <div
                      className={`rounded-xl border p-4 text-sm ${
                        isDark
                          ? "border-slate-800 bg-slate-950 text-slate-300"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Route
                          </div>
                          <div className="mt-1 font-bold">
                            {shipmentDraft?.routeInfo?.originCode || "ORG"}{" "}
                            {"->"}{" "}
                            {shipmentDraft?.routeInfo?.destinationCode ||
                              "DEST"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Items
                          </div>
                          <div className="mt-1 font-bold">
                            {shipmentDraft?.items?.length || 0} package type(s)
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setWantsTripAssignment(true)}
                      className="w-full rounded-xl py-3 font-bold flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white transition-colors shadow-sm"
                    >
                      <FontAwesomeIcon icon={faTruckPickup} />
                      <span>
                        {isPickup ? "Assign to Pickup Route" : "Assign to Trip"}
                      </span>
                    </button>
                  </div>
                </div>
              )}
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
                  className={`text-xl sm:text-2xl font-bold ${modalTheme.title}`}
                >
                  {finalTripId
                    ? `Shipment Assigned to ${finalTripId}`
                    : editData
                      ? "Shipment Updated Successfully" // ✅ New text for updates
                      : `Shipment Created (${isPickup ? "Pending Pickup" : "Pending"})`}
                </h2>
                {Object.values(notificationChannels).some(Boolean) && (
                  <p
                    className={`text-xs font-bold mt-2 uppercase tracking-widest flex justify-center items-center gap-2 ${
                      isDark ? "text-emerald-400" : "text-emerald-600"
                    }`}
                  >
                    <FontAwesomeIcon icon={faBell} />
                    <span>Customer Notifications Queued</span>
                  </p>
                )}
              </div>
              <div className="w-full max-w-xs space-y-3 mt-4">
                {/* PRINT BUTTON */}
                {/* <button
                  onClick={() =>
                    window.open(shipmentLabelUrl(createdShipmentId), "_blank")
                  }
                  className={`${modalTheme.secondaryButton} w-full rounded-xl py-3 font-bold`}
                >
                  Print Shipment Label
                </button> */}

                <button
                  onClick={() =>
                    window.open(packageLabelUrl(createdShipmentId), "_blank")
                  }
                  className={`${modalTheme.secondaryButton} w-full rounded-xl py-3 font-bold`}
                >
                  Print Individual Packages
                </button>

                {/* ✅ NEW: CREATE ANOTHER BUTTON */}
                <button
                  onClick={() => {
                    setStep(1);
                    setFinalTripId(null);
                    setCreatedShipmentId(null);
                    setWantsTripAssignment(false);
                    setShipmentDraft(null); // This triggers the 'key' reset we set up
                    setNotificationChannels(
                      DEFAULT_CUSTOMER_NOTIFICATION_CHANNELS,
                    );
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
          className={`p-4 sm:p-6 border-t flex flex-col sm:flex-row items-center gap-4 shrink-0 ${modalTheme.header}`}
        >
          {step === 1 && (
            <button
              type="submit"
              form="step1-form" // This targets the <form id="step1-form"> inside ReceivePackageForm
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl flex justify-center items-center gap-2 transition-colors"
            >
              <span>
                {isPickup ? "Continue to Save Pickup" : "Continue to Save"}
              </span>
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          )}

          {step === 2 && (
            <div className="w-full space-y-4">
              <CustomerNotificationChannels
                value={notificationChannels}
                onChange={setNotificationChannels}
                theme={modalTheme}
              />

              <div className="flex w-full justify-end gap-2">
                <button
                  onClick={() => {
                    if (wantsTripAssignment) {
                      setWantsTripAssignment(false);
                    } else {
                      setStep(1);
                    }
                  }}
                  className={`${modalTheme.secondaryButton} flex-none rounded-xl px-6 py-3 font-bold`}
                >
                  {wantsTripAssignment ? "Hide Trip Assignment" : "Back"}
                </button>
                <button
                  onClick={() => handleMasterSubmit(null)}
                  className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-colors whitespace-nowrap"
                >
                  Save Shipment
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <button
              onClick={() => {
                onClose();
                setStep(1);
                setFinalTripId(null); // ✅ Clear success state
                setCreatedShipmentId(null); // ✅ Clear success state
                setWantsTripAssignment(false);
                setNotificationChannels(DEFAULT_CUSTOMER_NOTIFICATION_CHANNELS);
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
