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
import ReceivePackageForm from "../ReceivePackageForm/ReceivePackageForm";
import TripStep from "../../manifests/CreateTripModal/TripStep";
import {
  assignShipmentToTrip,
  createShipment,
} from "@/app/utility/FirebaseFunctions";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";
import { updatedBy } from "@/app/utility/utilities";

export default function NewShipmentModal({
  profile,
  isOpen,
  onClose,
  isDark = false,
  user,
  onSuccess,
  resetTrigger,
  editData = null,
}) {
  const theme = getModalThemeClasses(isDark);
  const actions = getModalActionClasses();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [shipmentDraft, setShipmentDraft] = useState(null);
  const [finalTripId, setFinalTripId] = useState(null);
  const [createdShipmentId, setCreatedShipmentId] = useState(null);

  const [sendSms, setSendSms] = useState(true);
  const [isPickup, setIsPickup] = useState(false);

  const generateShipmentId = (originCode, destCode) => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Date.now().toString().slice(-6);
    return `AT-${dateStr}-SHP-${random}`;
  };

  useEffect(() => {
    if (editData && isOpen) {
      setShipmentDraft({
        routeInfo: {
          origin: editData.origin || "",
          originCode: editData.originCode || "",
          destination: editData.destination || "",
          destinationCode: editData.destinationCode || "",
        },
        sender: {
          name: editData.sender?.name || "",
          phone: editData.sender?.phone || "",
          ...(editData.sender?.address || editData.sender?.details || {}),
        },
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

      setIsPickup(
        editData.isPickupRequested === true ||
          editData.status === "PENDING_PICKUP",
      );
    }
  }, [editData, isOpen]);

  useEffect(() => {
    if (resetTrigger && !editData) {
      setShipmentDraft(null);
      setFinalTripId(null);
      setCreatedShipmentId(null);
      setSendSms(true);
      setIsPickup(false);
    }
  }, [resetTrigger, editData]);

  const handleMasterSubmit = async (tripDecision) => {
    setLoading(true);
    try {
      const originCode = shipmentDraft.routeInfo.originCode || "GEN";
      const destCode = shipmentDraft.routeInfo.destinationCode || "GEN";

      const isEditMode = !!(editData && editData.id);
      const targetShipmentId = isEditMode
        ? editData.id
        : generateShipmentId(originCode, destCode);

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

      if (!isPickup && !isEditMode && uploadedUrls.length === 0) {
        setLoading(false);
        return alert("Add Images before proceeding");
      }

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
        notifySms: sendSms,
        proofOfReceipt: uploadedUrls,
      };

      let finalDocId = targetShipmentId;

      if (isEditMode) {
        await updateShipmentDetails({
          shipmentId: finalDocId,
          ...payload,
        });
      } else {
        payload.manualShipmentId = finalDocId;
        const shipmentRes = await createShipment(payload);
        finalDocId = shipmentRes?.data?.shipmentId || finalDocId;
      }

      setCreatedShipmentId(finalDocId);

      if (tripDecision && tripDecision.tripId) {
        const targetTripId = tripDecision.tripId;
        await assignShipmentToTrip({
          trackingShipmentId: finalDocId,
          tripId: targetTripId,
          updatedBy: updatedBy(profile),
        });

        setFinalTripId(targetTripId);
        setShipmentDraft(null);

        // window.open(
        //   `/components/print/labels?tripId=${targetTripId}`,
        //   "_blank",
        // );
      } else {
        setFinalTripId(null);
      }

      if (onSuccess) onSuccess();
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
      className={`fixed inset-0 z-50 flex items-center justify-center sm:p-4 ${theme.overlay}`}
    >
      <div
        className={`relative w-full max-w-4xl sm:rounded-xl shadow-xl overflow-hidden flex flex-col h-full sm:h-auto sm:min-h-[600px] sm:max-h-[90vh] border ${theme.modal}`}
      >
        {loading && (
          <div
            className={`absolute inset-0 z-[100] backdrop-blur-sm flex flex-col items-center justify-center ${
              theme.processLoading
            }`}
          >
            <FontAwesomeIcon
              icon={faCircleNotch}
              spin
              className="text-4xl text-blue-500 mb-4"
            />
            <p className={`font-bold ${theme.title}`}>Processing Shipment...</p>
          </div>
        )}

        {/* HEADER */}
        <div
          className={`p-4 sm:p-6 border-b flex justify-between items-center shrink-0 ${theme.header}`}
        >
          <div className="flex flex-col">
            <h2 className={`text-lg sm:text-xl font-bold ${theme.title}`}>
              {step === 1
                ? "1. Shipment Details"
                : step === 2
                  ? "2. Select Trip"
                  : "3. Complete"}
            </h2>

            {step === 1 && (
              <p className={`text-xs mt-1 ${theme.label}`}>
                Fill in the package and routing info.
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${theme.closeButton}`}
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {step === 1 && (
            <div className="flex flex-col h-full overflow-hidden">
              <div
                className={`p-4 border-b flex justify-center shrink-0 ${theme.header}`}
              >
                <div
                  className={`p-1 rounded-xl border flex w-full max-w-md ${theme.panelSurface}`}
                >
                  <button
                    onClick={() => setIsPickup(false)}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      !isPickup
                        ? actions.primaryInlineCompact
                        : theme.toggleIdle
                    }`}
                  >
                    <FontAwesomeIcon icon={faStore} />
                    <span>Warehouse Drop-off</span>
                  </button>

                  <button
                    onClick={() => setIsPickup(true)}
                    className={`${
                      isPickup ? actions.warningInline : theme.toggleIdle
                    } flex-1`}
                  >
                    <FontAwesomeIcon icon={faTruckPickup} />
                    <span>Pickup</span>
                  </button>
                </div>
              </div>

              <ReceivePackageForm
                key={shipmentDraft ? "draft-active" : "new-form"}
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
              <div
                className={
                  finalTripId ? theme.successIconWrap : theme.warningIconWrap
                }
              >
                <FontAwesomeIcon
                  icon={finalTripId ? faCheckCircle : faBoxOpen}
                  className="text-5xl sm:text-6xl"
                />
              </div>

              <div>
                <h2 className={`text-xl sm:text-2xl font-bold ${theme.title}`}>
                  {finalTripId
                    ? `Shipment Assigned to ${finalTripId}`
                    : editData
                      ? "Shipment Updated Successfully"
                      : `Shipment Created (${isPickup ? "Pending Pickup" : "Pending"})`}
                </h2>

                {sendSms && (
                  <p
                    className={`text-xs font-bold mt-2 uppercase tracking-widest flex justify-center items-center gap-2 ${
                      theme.notifySendSms
                    }`}
                  >
                    <FontAwesomeIcon icon={faCommentSms} />
                    <span>SMS Notifications Queued</span>
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
                  className={theme.secondaryButton}
                >
                  {finalTripId
                    ? "Print Trip Labels"
                    : "Print Individual Waybill"}
                </button>
                <button
                  onClick={() =>
                    window.open(
                      finalTripId
                        ? `/components/print/labels?tripId=${finalTripId}`
                        : `/components/print/labels?id=${createdShipmentId}`,
                      "_blank",
                    )
                  }
                  className={theme.secondaryButton}
                >
                  {finalTripId
                    ? "Print Trip Labels"
                    : "Print Individual Waybill"}
                </button>

                <button
                  onClick={() => {
                    setStep(1);
                    setFinalTripId(null);
                    setCreatedShipmentId(null);
                    setShipmentDraft(null);
                  }}
                  className={`${actions.primary} flex items-center justify-center gap-2`}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Create Another Shipment</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div
          className={`p-4 sm:p-6 border-t flex flex-col sm:flex-row items-center gap-4 shrink-0 ${theme.header}`}
        >
          {step === 1 && (
            <button
              type="submit"
              form="step1-form"
              className={`${actions.primary} flex justify-center items-center gap-2`}
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
              <label className="flex items-center gap-2 cursor-pointer group w-full sm:w-auto mb-2 sm:mb-0">
                <input
                  type="checkbox"
                  className={`w-4 h-4 rounded text-blue-600 focus:ring-blue-500 ${
                    theme.checkboxActive
                  }`}
                  checked={sendSms}
                  onChange={(e) => setSendSms(e.target.checked)}
                />
                <span
                  className={`text-xs font-bold uppercase tracking-tight ${
                    sendSms ? theme.spanText : theme.helperText
                  }`}
                >
                  Notify Sender/Recipient via SMS
                </span>
              </label>

              <div className="flex w-full sm:w-auto sm:ml-auto gap-2">
                <button
                  onClick={() => setStep(1)}
                  className={theme.secondaryButton}
                >
                  Back
                </button>

                <button
                  onClick={() => handleMasterSubmit(null)}
                  className={`${actions.warningInline} px-6 py-3 text-sm rounded-xl whitespace-nowrap`}
                >
                  Skip & Save
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <button
              onClick={() => {
                onClose();
                setStep(1);
                setFinalTripId(null);
                setCreatedShipmentId(null);
              }}
              className={actions.primary}
            >
              Return to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
