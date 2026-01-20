import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLock,
  faScroll,
  faUnlock,
  faFilePdf,
  faMinus,
  faPause,
  faPlay,
  faCut,
  faPen,
  faBan,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import {
  assignShipmentToTruckTrip,
  clearTruckDelay,
  setTruckDelay,
} from "@/apps/web/app/utility/FirebaseFunctions";
import { auth } from "@/apps/web/lib/firebase";
import { formatFirestoreDate } from "@/apps/web/app/utility/utilities";
import { ActionButton } from "../../ui/ActionButton";
import StatusBadge from "../../ui/StatusBadge";
import DisableTripModal from "../modals/DisableTripModal";
import SplitShipmentModal from "../modals/SplitShipmentModal";
import AssignDriverModal from "../modals/AssignDriverModal";
import UnassignShipmentModal from "../modals/UnassignShipmentModal";
import StatusButton from "../../ui/StatusButton"; // Adjust path
import OutcomeModal from "../modals/OutcomeModal";

export default function TripWorkspace({
  tripId,
  initialTripData,
  onRefreshTrips,
}) {
  const [trip, setTrip] = useState(null);
  const [shipments, setShipments] = useState();
  const [loadingShips, setLoadingShips] = useState(false);

  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [isDriverModalOpen, setDriverModalOpen] = useState(false); // Add State
  const [isDisableModalOpen, setDisableModalOpen] = useState(false);
  const [shipmentToUnassign, setShipmentToUnassign] = useState(null);
  const [outcome, setOutcome] = useState({
    isOpen: false,
    type: "SUCCESS", // SUCCESS | ERROR
    title: "",
    message: "",
  });

  const [assignId, setAssignId] = useState("");
  const [assignStatus, setAssignStatus] = useState("IDLE");

  // Add this near your other state definitions
  const [clearStatus, setClearStatus] = useState("IDLE");
  const [delayStatus, setDelayStatus] = useState("IDLE");
  const [delaySelect, setDelaySelect] = useState(""); // Replaces 'delayReason' for the dropdown
  const [customReason, setCustomReason] = useState(""); // Stores the typed text

  useEffect(() => {
    setTrip(initialTripData);
    if (tripId) fetchShipments();
  }, [tripId, initialTripData]);

  const fetchShipments = async () => {
    if (!tripId) return;

    setLoadingShips(true);
    try {
      // 1. Get Token
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();

      // 2. Call API (Dynamic URL)
      const res = await fetch(`/api/manifests/trips/${tripId}/shipments`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to load cargo");

      const data = await res.json();
      console.log(data);
      setShipments(data.shipments);
    } catch (e) {
      console.error("Pkg Load Error", e);
      alert("Failed to load cargo list.");
    } finally {
      setLoadingShips(false);
    }
  };

  // Helper Handler
  const openSplitModal = (shipment) => {
    console.log("test modal split");
    setSelectedShipment(shipment);
    setSplitModalOpen(true);
  };

  // --- ACTIONS ---
  const handleApiCall = async (actionName, payload, callableFn) => {
    try {
      const res = await callableFn(payload);
      // alert(`Success: ${actionName}`); // TODO: Replace with Toast

      if (onRefreshTrips) onRefreshTrips();
      if (fetchShipments) fetchShipments();

      return res.data;
    } catch (e) {
      // 4. Error Handling
      alert(`Error (${actionName}): ${e.message}`);
      console.error(`API Error in ${actionName}:`, e);
      throw e;
    }
  };

  const handleApi = async (apiFn, payload) => {
    try {
      const res = await apiFn(payload);

      // Update Global State (Safe Navigation Operator ?.)
      onRefreshTrips?.();
      fetchShipments?.();

      return res;
    } catch (e) {
      console.error("API Error:", e);
      throw e; // Throw it so the UI layer knows to show the Error X icon
    }
  };

  // UNIVERSAL HANDLER
  const runAction = async (
    setStatus, // The state setter (e.g., setDelayStatus)
    apiPromise, // The actual API call (wrapped in an arrow function)
    onSuccess, // Optional: Callback to clear forms (e.g., setDelaySelect(""))
  ) => {
    setStatus("LOADING");

    try {
      await apiPromise(); // Wait for API

      setStatus("SUCCESS");
      if (onSuccess) onSuccess(); // Run cleanup if provided

      // Optional: Trigger Global Success Modal here if you want
    } catch (e) {
      setStatus("ERROR");

      // Trigger Global Error Modal
      const cleanMsg = e.message?.replace("Error: ", "") || "Operation failed";
      setOutcome({
        isOpen: true,
        type: "ERROR",
        title: "Action Failed",
        message: cleanMsg,
      });
    } finally {
      // Always reset button to IDLE
      setTimeout(() => setStatus("IDLE"), 2000);
    }
  };

  const closeOutcome = () => setOutcome((prev) => ({ ...prev, isOpen: false }));

  if (!tripId)
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500 h-full">
        Select a trip to begin operations.
      </div>
    );

  const isLocked = trip?.manifestLocked;
  const isCertified = !!trip?.certificate;

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2">
      {/* 1. CONTROL BAR */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex flex-wrap justify-between items-center mb-4">
          {/* HEADER SECTION */}
          <div>
            <h2 className="text-xl font-mono font-bold text-white">
              {trip?.tripId}
            </h2>
            <div className="flex gap-3 text-xs text-slate-400 mt-1 items-center">
              {/* DRIVER INFO + EDIT BUTTON */}
              <div className="flex items-center gap-2 bg-slate-800/50 pl-2 pr-1 py-1 rounded">
                <span>
                  Driver:{" "}
                  {trip?.driverName ? (
                    <b className="text-white">{trip?.driverName}</b>
                  ) : (
                    <StatusBadge status={"UNASSIGNED"} />
                  )}
                </span>

                {/* THE NEW BUTTON */}
                <button
                  onClick={() => setDriverModalOpen(true)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  title="Manage Driver"
                >
                  <FontAwesomeIcon icon={faPen} size="xs" />
                </button>
              </div>

              <span>•</span>
              {/* STATUS SECTION (Updated) */}
              <div className="flex items-center gap-2 bg-slate-800/50 pl-2 pr-1 py-1 rounded">
                <span>
                  Status:{" "}
                  <b className="text-slate-200 ">
                    <StatusBadge status={trip?.status} />
                    {/* {trip?.status} */}
                  </b>
                </span>

                <button
                  onClick={() => setDisableModalOpen(true)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                  title="Disable / Cancel Trip"
                  disabled={
                    trip?.active !== false &&
                    trip?.status !== "CANCELLED" &&
                    trip?.status !== "COMPLETED"
                      ? false
                      : true
                  }
                >
                  <FontAwesomeIcon icon={faBan} size="xs" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {/* Dynamic PDF Links */}
            {trip?.manifest?.pdfUrl && (
              <a
                href={trip.manifest.pdfUrl}
                target="_blank"
                className="text-xs text-blue-400 hover:underline flex items-center gap-1"
              >
                <FontAwesomeIcon icon={faFilePdf} /> Manifest
              </a>
            )}
            {trip?.certificate?.pdfUrl && (
              <a
                href={trip.certificate.pdfUrl}
                target="_blank"
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
              >
                <FontAwesomeIcon icon={faFilePdf} /> Certificate
              </a>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-800">
          <ActionButton
            label="Lock Manifest"
            icon={faLock}
            color="blue"
            disabled={isLocked}
            onClick={() =>
              handleApiCall("generateTripManifest", { tripDocId: tripId })
            }
          />
          <ActionButton
            label="Certificate"
            icon={faScroll}
            color="emerald"
            disabled={!isLocked || isCertified}
            onClick={() =>
              handleApiCall("generateTripCertificate", { tripDocId: tripId })
            }
          />
          <ActionButton
            label="Reopen"
            icon={faUnlock}
            color="red"
            disabled={!isCertified}
            onClick={() => handleApiCall("reopenTrip", { tripDocId: tripId })}
          />
        </div>
      </div>

      {/* 2. shipments TABLE */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-xl min-h-[300px]">
        <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-slate-400 text-sm uppercase">
            Cargo Manifest
          </h3>
          <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs font-mono">
            Shipments Count:{" "}
            {shipments?.reduce((sum, p) => sum + (p.totalItems || 0), 0)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-500 font-bold uppercase border-b border-slate-800">
              <tr>
                <th className="p-3">Tracking / ID</th>
                <th className="p-3">Stats</th>
                <th className="p-3">Status</th>
                <th className="p-3">Route</th>
                <th className="p-3">Updated</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {loadingShips ? (
                <tr>
                  <td colSpan="4" className="p-6 text-center text-slate-500">
                    Loading Cargo...
                  </td>
                </tr>
              ) : shipments?.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    className="p-6 text-center text-slate-500 italic"
                  >
                    Truck is empty.
                  </td>
                </tr>
              ) : (
                shipments?.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="p-3">
                      <div className="font-bold text-white">
                        {p.trackingNumber}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {p.id}
                      </div>
                    </td>
                    <td className="p-3">
                      <div>
                        Load: {p.loadedCount}/{p.totalItems}
                      </div>
                      {p.pendingCount > 0 && (
                        <div className="text-red-400 font-bold">
                          Pending: {p.pendingCount}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="p-3">
                      <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                        {p.route}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                        {formatFirestoreDate(p.updatedAt)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        {/* --- NEW SPLIT BUTTON --- */}
                        <button
                          onClick={() => openSplitModal(p)}
                          className="text-slate-500 hover:text-amber-400 p-2 transition-colors"
                          title="Split Order"
                          disabled={isLocked || (p.totalItems || 0) <= 1} // Disable if only 1 item
                        >
                          <FontAwesomeIcon icon={faCut} />
                        </button>
                        <button
                          onClick={() => setShipmentToUnassign(p)} // Just set the state to open modal
                          className="text-slate-500 hover:text-red-400 p-2 transition-colors"
                          disabled={isLocked}
                          title="Unassign / Remove"
                        >
                          <FontAwesomeIcon icon={faMinus} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. OPERATIONS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
        {/* ASSIGNMENT CARD */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
          <h4 className="text-xs font-bold text-slate-500 uppercase">
            Manual Assignment
          </h4>

          <input
            value={assignId}
            onChange={(e) => setAssignId(e.target.value)}
            placeholder="Paste Shipment ID..."
            // Add visual error border if status is ERROR
            className={`w-full bg-slate-950 border rounded p-2 text-xs text-white outline-none transition-colors ${
              assignStatus === "ERROR"
                ? "border-red-500"
                : "border-slate-700 focus:border-blue-500"
            }`}
            disabled={isLocked || assignStatus === "LOADING"}
            onKeyDown={(e) => e.key === "Enter" && runAction()}
          />

          <div className="flex gap-2">
            {/* REUSABLE COMPONENT */}
            <StatusButton
              status={assignStatus}
              onClick={() =>
                runAction(
                  setAssignStatus, // 1. Pass the State Setter (So it knows which button to spin)

                  () =>
                    handleApi(assignShipmentToTruckTrip, {
                      // 2. The API Call
                      trackingDocId: assignId,
                      truckTripId: tripId,
                    }),

                  () => setAssignId(""), // 3. Cleanup: Clear the input on success
                )
              }
              disabled={isLocked || !assignId}
              // IDLE Configuration
              icon={faPlus}
              label="Assign"
              // Custom Text for states
              loadingLabel="Assigning..."
              successLabel="Assigned!"
              errorLabel="Failed"
            />
          </div>
        </div>

        {/* DELAY CARD */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg transition-all">
          <h4 className="text-xs font-bold text-slate-500 uppercase">
            Delay Controls
          </h4>

          {/* 1. The Dropdown */}
          <select
            value={delaySelect}
            onChange={(e) => setDelaySelect(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:border-amber-500 outline-none"
          >
            <option value="">Select Reason...</option>
            <option value="WEATHER">Weather</option>
            <option value="MECHANICAL">Mechanical</option>
            <option value="PORT_CONGESTION">Port Congestion</option>
            <option value="TRAFFIC">Heavy Traffic</option>
            <option value="OTHER">Other / Custom...</option> {/* NEW OPTION */}
          </select>

          {/* 2. The Custom Input (Only shows if "OTHER" is selected) */}
          {delaySelect === "OTHER" && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Type specific reason..."
                className="w-full bg-slate-950 border border-amber-500/50 rounded p-2 text-xs text-white focus:border-amber-500 outline-none"
                autoFocus
              />
            </div>
          )}

          {/* 3. The Buttons */}
          <div className="flex gap-2">
            {/* <button
              onClick={() => {
                // LOGIC: Use custom text if "OTHER", otherwise use dropdown value
                const finalReason =
                  delaySelect === "OTHER" ? customReason : delaySelect;
                handleApi(setTruckDelay, {
                  truckTripId: tripId,
                  reason: finalReason,
                });
              }}
              // DISABLE if: No selection OR (Selection is Other AND text is empty)
              disabled={
                !delaySelect ||
                (delaySelect === "OTHER" && !customReason.trim())
              }
              className="flex-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-500/30 py-2 rounded text-xs font-bold disabled:opacity-30 flex items-center justify-center gap-2 transition-all"
            >
              <FontAwesomeIcon icon={faPause} /> Set Delay
            </button> */}

            <StatusButton
              status={delayStatus}
              icon={faPause}
              label="Set Delay"
              idleColor="bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-500/30"
              // Logic is now clean and inline:
              onClick={() => {
                // 1. Specific Validation
                const finalReason =
                  delaySelect === "OTHER" ? customReason : delaySelect;
                if (!finalReason) return; // Stop if invalid

                // 2. Call Universal Handler
                runAction(
                  setDelayStatus, // Pass the specific state setter
                  () =>
                    handleApi(setTruckDelay, {
                      truckTripId: tripId,
                      reason: finalReason,
                    }), // Pass the API Call
                  () => {
                    // Pass Cleanup (Optional)
                    setDelaySelect("");
                    setCustomReason("");
                  },
                );
              }}
              disabled={
                !delaySelect ||
                (delaySelect === "OTHER" && !customReason.trim())
              }
            />

            <StatusButton
              // 1. Link to its own state
              status={clearStatus}
              // 2. The Universal Handler
              onClick={() =>
                runAction(
                  setClearStatus, // Pass the Clear Button's state setter
                  () => handleApi(clearTruckDelay, { truckTripId: tripId }), // API Call
                  () => {
                    // Cleanup
                    setDelaySelect("");
                    setCustomReason("");
                  },
                )
              }
              // 3. Configuration
              icon={faPlay}
              label="Clear"
              loadingLabel="Clearing..."
              successLabel="Cleared!"
              // 4. Custom Styling (Green Theme)
              idleColor="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30"
            />
          </div>
        </div>
      </div>

      <SplitShipmentModal
        isOpen={splitModalOpen}
        shipment={selectedShipment}
        onClose={() => setSplitModalOpen(false)}
        onSuccess={() => {
          fetchShipments(); // Refresh the table automatically
          setSplitModalOpen(false);
        }}
      />
      <AssignDriverModal
        isOpen={isDriverModalOpen}
        trip={trip}
        onClose={() => setDriverModalOpen(false)}
        onSuccess={() => {
          if (onRefreshTrips) onRefreshTrips(); // Refresh the main list
          // You might need to refresh the local trip object too if it's not passed down
        }}
      />
      <DisableTripModal
        isOpen={isDisableModalOpen}
        trip={trip}
        onClose={() => setDisableModalOpen(false)}
        onSuccess={() => {
          if (onRefreshTrips) onRefreshTrips();
          setDisableModalOpen(false);
        }}
      />
      <UnassignShipmentModal
        isOpen={!!shipmentToUnassign}
        shipment={shipmentToUnassign}
        tripId={tripId}
        onClose={() => setShipmentToUnassign(null)}
        onSuccess={() => {
          fetchShipments(); // Refresh the table
          setShipmentToUnassign(null);
        }}
      />
      <OutcomeModal
        isOpen={outcome.isOpen}
        onClose={closeOutcome}
        type={outcome.type}
        title={outcome.title}
        message={outcome.message}
      />
    </div>
  );
}
