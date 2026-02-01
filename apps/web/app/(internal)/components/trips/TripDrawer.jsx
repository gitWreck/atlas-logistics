import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruck,
  faClipboardList, // Manifest Icon
  faWrench,
  faPaperPlane,
  faMapMarkerAlt,
  faCheckCircle,
  faLock,
  faScroll,
  faUnlock,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../ui/StatusBadge"; // Ensure this path is correct
// import TripManifestRow from "./TripManifestRow"; // We will create a simple inline version below
import StatusButton from "../ui/StatusButton"; // Assuming you have this
import {
  generateTripManifest,
  generateTripCertificate,
  reopenTrip,
} from "@/app/utility/FirebaseFunctions"; // Import your backend calls
import { runAction } from "@/app/utility/utilities";
import { auth } from "@/lib/firebase";

function calculateCurrentStep(status) {
  return status;
}

export default function TripDrawer({ isOpen, onClose, data, onAddShipment }) {
  const [activeTab, setActiveTab] = useState("TIMELINE");
  const [messageBody, setMessageBody] = useState("");
  const [shipments, setShipments] = useState([]);
  const [loadingShips, setLoadingShips] = useState(false);

  const [lockStatus, setLockStatus] = useState("IDLE");
  const isLocked = data?.manifestLocked;
  const isCertified = !!data?.certificate;

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab("TIMELINE");
      setMessageBody(
        `Hello ${data?.driverName || "Driver"}, regarding trip ${data?.tripId}...`,
      );
    }
  }, [isOpen, data]);

  useEffect(() => {
    setTrip(data.shipments);
    if (data.tripId) fetchShipments();
  }, [data.tripId, data.shipments]);

  const fetchShipments = async () => {
    if (!data.tripId) return;
    setLoadingShips(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/manifests/trips/${data.tripId}/shipments`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      const data = await res.json();
      setShipments(data.shipments || []);

      // console.log("Total Loaded:", data.stats.totalLoaded);
      // console.log("Total Pending:", data.stats.totalPending);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingShips(false);
    }
  };

  const handleSendMessage = () => {
    // Integration logic here (e.g., Push Notification or SMS to Driver)
    alert(
      `Sending Message to Driver (${data.driverName}):\n\n"${messageBody}"`,
    );
  };

  const handleAction = async (actionType) => {
    // You can define a local loading state for these if needed,
    // or just use a simple async wrapper
    try {
      if (actionType === "generateTripCertificate")
        await generateTripCertificate({ tripDocId: data.tripId });
      if (actionType === "reopenTrip")
        await reopenTrip({ tripDocId: data.tripId });
      // Refresh parent logic would go here if needed, or close drawer
    } catch (e) {
      alert(e.message);
    }
  };

  if (!data) return null;

  console.log("shipments: ", data);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <aside
        className={`
          fixed top-0 right-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 shadow-2xl transform transition-transform duration-300 flex flex-col
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* HEADER */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-950">
          <div>
            <div className="text-[10px] uppercase text-emerald-500 font-bold tracking-wider mb-1">
              Active Trip
            </div>
            <h2 className="text-xl font-mono text-white font-bold tracking-tight">
              {data.tripId}
            </h2>
            <div className="flex gap-2 mt-2 items-center">
              <StatusBadge status={data.status} />
              <span className="text-xs text-slate-400 border-l border-slate-700 pl-2 ml-1">
                {data.route}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white p-2 hover:bg-slate-800 rounded-lg"
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-slate-800 bg-slate-900">
          <TabButton
            isActive={activeTab === "TIMELINE"}
            onClick={() => setActiveTab("TIMELINE")}
            icon={faTruck}
            label="Status"
          />
          <TabButton
            isActive={activeTab === "MANIFEST"}
            onClick={() => setActiveTab("MANIFEST")}
            icon={faClipboardList}
            label={`Manifest (${data.totalItems || 0})`}
          />
          <TabButton
            isActive={activeTab === "TOOLS"}
            onClick={() => setActiveTab("TOOLS")}
            icon={faWrench}
            label="Actions"
          />
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
          {/* --- TAB 1: TIMELINE --- */}
          {activeTab === "TIMELINE" && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              {/* Trip Details */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                <InfoCard label="Driver" value={data.driverName} />
                <InfoCard label="Plate Number" value={data.truckPlateNumber} />
                <InfoCard label="Origin" value={data.origin} />
                <InfoCard label="Destination" value={data.destination} />
              </div>

              {/* Status Flow */}
              <div className="text-slate-500">
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 pl-1">
                  Trip Progress
                </h3>
                <div className="space-y-0 relative pl-4 border-l-2 border-slate-800 ml-2">
                  {[
                    "CREATED",
                    "LOADING",
                    "LOADED",
                    "IN_TRANSIT",
                    "COMPLETED", // Simplified Trip Stages
                  ].map((step, idx) => {
                    // Logic to determine if step is done (Adjust based on your real status enum)
                    const isDone =
                      data.status === step ||
                      step === "CREATED" ||
                      data.status === "COMPLETED";
                    // Note: You might need a proper helper like 'getTripStepIndex' for accurate progress bars

                    const isCurrent =
                      calculateCurrentStep(data.status) === step;

                    return (
                      <div key={step} className="relative pb-8 last:pb-0">
                        {/* Dot */}
                        <div
                          className={`
                            absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center
                            ${
                              isDone
                                ? "bg-emerald-600 border-emerald-600"
                                : "bg-slate-900 border-slate-700"
                            }
                            ${isCurrent ? "ring-4 ring-emerald-500/20" : ""}
                          `}
                        >
                          {isDone && (
                            <FontAwesomeIcon
                              icon={faCheckCircle}
                              className="text-white text-[8px]"
                            />
                          )}
                        </div>

                        {/* Text */}
                        <div
                          className={`-mt-1.5 ml-2 ${isDone ? "opacity-100" : "opacity-40"}`}
                        >
                          <p
                            className={`text-sm font-bold ${isDone ? "text-white" : "text-slate-400"}`}
                          >
                            {step.replace(/_/g, " ")}
                          </p>
                          {isCurrent && (
                            <p className="text-[10px] text-emerald-400 mt-0.5">
                              Current Status • Updated {data.updatedAt}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* --- TAB 2: MANIFEST (With Add Button) --- */}
          {activeTab === "MANIFEST" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* HEADER WITH BUTTON */}
              <div className="bg-slate-800/20 border border-slate-800 p-3 rounded-lg flex justify-between items-center mb-2">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase">
                    Total Cargo
                  </span>
                  <div className="text-sm font-bold text-white">
                    {data.totalPackages || 0} Packages
                  </div>
                </div>

                {/* --- ADD SHIPMENTS BUTTON (Moved Here) --- */}
                <button
                  onClick={onAddShipment}
                  disabled={isLocked}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span className="hidden sm:inline">Add Shipments</span>
                </button>
              </div>

              {/* LIST */}
              {(shipments || []).length === 0 ? (
                <div className="text-center p-8 text-slate-500 italic text-sm border border-dashed border-slate-800 rounded-xl">
                  No shipments assigned to this trip yet.
                </div>
              ) : (
                shipments.map((shipment, idx) => (
                  <ShipmentManifestRow
                    key={shipment.id || idx}
                    shipment={shipment}
                    idx={idx}
                  />
                ))
              )}
            </div>
          )}

          {/* --- TAB 3: TOOLS (ACTIONS) --- */}
          {activeTab === "TOOLS" && (
            <div className="space-y-8 animate-in zoom-in-95 duration-200">
              {/* Message Driver */}
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                  <FontAwesomeIcon
                    icon={faPaperPlane}
                    className="text-emerald-500"
                  />
                  Message Driver
                </h3>

                <div className="text-xs text-slate-500 mb-2">
                  To:{" "}
                  <span className="text-slate-300">
                    {data.driverName || "Unassigned"}
                  </span>
                </div>

                <textarea
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none mb-3 h-24 resize-none"
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                />

                <button
                  onClick={handleSendMessage}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Send Message
                </button>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button className="p-3 bg-slate-800 border border-slate-700 hover:border-emerald-500 hover:text-white text-slate-400 rounded-lg flex flex-col items-center gap-2 transition-all">
                  <FontAwesomeIcon icon={faMapMarkerAlt} />
                  <span className="text-xs font-bold">Track GPS</span>
                </button>
                {/* Add more tools here */}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-3">
          {/* Row 1: Action Buttons (Lock, Cert, Reopen) */}
          <div className="flex gap-3">
            <StatusButton
              status={lockStatus}
              label="Lock Manifest"
              icon={faLock}
              idleColor="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30"
              disabled={isLocked}
              onClick={() =>
                runAction(
                  setLockStatus,
                  () => generateTripManifest({ tripDocId: data.id }), // Use document ID
                  () => {
                    /* Refresh logic if passed */
                  },
                )
              }
            />

            <button
              disabled={!isLocked || isCertified}
              onClick={() => handleAction("generateTripCertificate")}
              className="flex-1 py-2 rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex justify-center items-center gap-2"
            >
              <FontAwesomeIcon icon={faScroll} /> Certificate
            </button>

            <button
              disabled={!isCertified}
              onClick={() => handleAction("reopenTrip")}
              className="flex-1 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-600/20 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex justify-center items-center gap-2"
            >
              <FontAwesomeIcon icon={faUnlock} /> Reopen
            </button>
          </div>

          {/* Row 2: Standard Reports */}
          <div className="flex gap-3">
            <button className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-sm transition-colors">
              Print Manifest
            </button>
            <button className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-colors shadow-lg shadow-blue-500/20">
              Trip Report
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// --- HELPER COMPONENTS ---

// --- INLINE COMPONENT FOR SHIPMENT ROW ---
function ShipmentManifestRow({ shipment, idx }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700 p-3 rounded-lg flex justify-between items-center hover:bg-slate-800/60 transition-colors">
      <div className="flex gap-3 items-center">
        <div className="h-8 w-8 bg-slate-900 rounded flex items-center justify-center text-xs font-mono font-bold text-slate-500 border border-slate-700">
          {idx + 1}
        </div>
        <div>
          <div className="text-slate-200 text-sm font-bold">
            {shipment.trackingNumber}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <span className="text-slate-400">
              {shipment.recipient?.name || "Customer"}
            </span>
            <span>•</span>
            <span>{shipment.destinationCity || "Unknown City"}</span>
          </div>
        </div>
      </div>
      <StatusBadge status={shipment.status} size="xs" />
    </div>
  );
}

function TabButton({ isActive, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-2 uppercase tracking-wide ${
        isActive
          ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
          : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
      }`}
    >
      <FontAwesomeIcon icon={icon} /> {label}
    </button>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-800">
      <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">
        {label}
      </div>
      <div className="text-slate-300 text-sm font-medium truncate">
        {value || "—"}
      </div>
    </div>
  );
}
