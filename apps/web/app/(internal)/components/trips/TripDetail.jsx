"use client";
import React, { useState, useEffect } from "react";
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  getDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "@/lib/firebase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLock,
  faFileContract,
  faUndo,
  faPlus,
  faMinus,
  faCube,
  faTruckLoading,
  faExclamationTriangle,
  faSync,
  faCheckCircle,
  faClipboardList,
} from "@fortawesome/free-solid-svg-icons";

export default function TripDetail({ tripId }) {
  const [trip, setTrip] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Inputs
  const [assignInput, setAssignInput] = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [splitModalData, setSplitModalData] = useState(null); // Controls the Split Popup

  // 1. LISTEN TO DATA
  useEffect(() => {
    if (!tripId) return;
    setLoading(true);

    const unsubTrip = onSnapshot(doc(db, "truck_trips", tripId), (docSnap) => {
      if (docSnap.exists()) setTrip(docSnap.data());
      setLoading(false);
    });

    const q = query(
      collection(db, "truck_trips", tripId, "trip_packages"),
      orderBy("updatedAt", "desc"),
    );
    const unsubPkgs = onSnapshot(q, (snap) => {
      setPackages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubTrip();
      unsubPkgs();
    };
  }, [tripId]);

  // --- ACTIONS ---

  const callFn = async (name, payload) => {
    setActionLoading(true);
    // try {
    //   const fn = httpsCallable(functions, name);
    //   const res = await fn(payload);
    //   return { success: true, data: res.data };
    // } catch (err) {
    //   alert(`Error: ${err.message}`);
    //   return { success: false };
    // } finally {
    //   setActionLoading(false);
    // }
  };

  // STEP 1: VERIFY SHIPMENT (Reads "Truth" Record)
  const handleVerify = async () => {
    if (!assignInput) return;
    setActionLoading(true);
    try {
      // Check the global "Shipment Truth" to see pending counts
      const docRef = doc(db, "tracking_records", assignInput.trim());
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        alert("Tracking Number not found.");
        return;
      }

      const data = snap.data();
      const pending = data.itemsPending ?? data.itemsTotal ?? 0;

      if (pending <= 0) {
        alert("This shipment is fully loaded on other trips.");
        return;
      }

      // Open Modal to ask "How many boxes?"
      setSplitModalData({
        id: snap.id,
        itemsTotal: data.itemsTotal,
        itemsPending: pending,
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // STEP 2: ASSIGN TO LEDGER
  const handleConfirmAssign = async (countToLoad) => {
    if (!splitModalData) return;

    const res = await callFn("assignShipmentToTruckTrip", {
      truckTripId: tripId,
      trackingDocId: splitModalData.id,
      packageCount: parseInt(countToLoad), // Supporting Partial Delivery
    });

    if (res.success) {
      setSplitModalData(null);
      setAssignInput("");
    }
  };

  const handleUnassign = async (pkgId) => {
    if (!confirm("Unload this cargo? Items will return to 'Pending' status."))
      return;
    await callFn("unassignShipmentFromTruckTrip", {
      truckTripId: tripId,
      trackingDocId: pkgId,
    });
  };

  const handleLock = async () => {
    // Rule Check: Logic handles the "SUM(itemsPending)" validation server-side
    if (!confirm("Lock Manifest? This freezes the ledger.")) return;
    await callFn("generateTripManifest", { tripDocId: tripId });
  };

  // ... (handleCertify, handleReopen, handleSetDelay remain the same) ...
  const handleCertify = async () => {
    if (confirm("Generate Certificate?"))
      await callFn("generateTripCertificate", { tripDocId: tripId });
  };
  const handleReopen = async () => {
    if (confirm("Reopen Trip?"))
      await callFn("reopenTrip", { tripDocId: tripId });
  };
  const handleSetDelay = async () => {
    if (delayReason) {
      await callFn("setTruckDelay", { tripDocId: tripId, reason: delayReason });
      setDelayReason("");
    }
  };

  if (loading || !trip)
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <FontAwesomeIcon icon={faSync} spin /> Loading...
      </div>
    );

  const isLocked = trip.manifestLocked;
  const isCertified = !!trip.certificate;

  return (
    <div className="flex flex-col h-full relative">
      {/* HEADER DASHBOARD */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/30">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-mono font-bold text-white">
              {trip.tripId}
            </h2>
            <div className="flex gap-4 text-xs text-slate-400 mt-1 font-mono">
              <span>
                {trip.originCode} <span className="text-slate-600">→</span>{" "}
                {trip.destCode}
              </span>
              <span className="border-l border-slate-700 pl-4">
                {trip.driverName || "No Driver"}
              </span>
            </div>
          </div>

          {/* TRIP TOTALS (Computed by Backend) */}
          <div className="flex gap-4 text-right">
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">
                Total Loaded
              </div>
              <div className="text-xl font-bold text-emerald-400">
                {trip.totalLoaded || 0}{" "}
                <span className="text-sm text-slate-600">items</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">
                Shipments
              </div>
              <div className="text-xl font-bold text-white">
                {packages.length}
              </div>
            </div>
          </div>
        </div>

        {/* ACTION BAR */}
        <div className="flex gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800">
          <ActionButton
            label="Lock Manifest"
            icon={faLock}
            onClick={handleLock}
            disabled={isLocked || actionLoading}
            active={isLocked}
            color="amber"
          />
          <ActionButton
            label="Certify"
            icon={faFileContract}
            onClick={handleCertify}
            disabled={!isLocked || isCertified || actionLoading}
            active={isCertified}
            color="emerald"
          />
          <ActionButton
            label="Reopen"
            icon={faUndo}
            onClick={handleReopen}
            disabled={!isCertified || actionLoading}
            color="red"
          />
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ASSIGNMENT TOOL */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">
            Add to Manifest
          </h4>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
              placeholder="Scan Tracking ID..."
              value={assignInput}
              onChange={(e) => setAssignInput(e.target.value)}
              disabled={isLocked}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            />
            <button
              onClick={handleVerify}
              disabled={isLocked || actionLoading || !assignInput}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 rounded-lg font-bold"
            >
              Verify
            </button>
          </div>
          {isLocked && (
            <p className="text-[10px] text-amber-500 mt-2 flex items-center gap-1">
              <FontAwesomeIcon icon={faLock} /> Manifest Locked. Ledger is
              frozen.
            </p>
          )}
        </div>

        {/* 2. DELAY TOOL (Updated with Custom Note) */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">
            Delay Status
          </h4>

          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                disabled={actionLoading}
              >
                <option value="">Select Reason...</option>
                <option value="WEATHER">Weather</option>
                <option value="MECHANICAL">Mechanical</option>
                <option value="PORT_CONGESTION">Port Congestion</option>
                <option value="OTHER">Other / Custom</option>
              </select>

              {/* NEW: Show 'Set' button only if 'OTHER' is NOT selected to avoid premature click */}
              {delayReason !== "OTHER" && (
                <button
                  onClick={handleSetDelay}
                  disabled={actionLoading || !delayReason}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 rounded-lg transition-colors"
                >
                  Set
                </button>
              )}
            </div>

            {/* NEW: Custom Note Input shows when 'OTHER' is selected */}
            {delayReason === "OTHER" && (
              <div className="flex gap-2 animate-in slide-in-from-top-2">
                <input
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  placeholder="Type custom delay reason..."
                  id="customDelayInput"
                />
                <button
                  onClick={() => {
                    const customVal =
                      document.getElementById("customDelayInput").value;
                    if (customVal) {
                      callFn("setTruckDelay", {
                        tripDocId: tripId,
                        reason: customVal,
                      });
                      setDelayReason("");
                    }
                  }}
                  disabled={actionLoading}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-4 rounded-lg transition-colors"
                >
                  Set
                </button>
              </div>
            )}
          </div>

          {trip.delayReason && (
            <div className="mt-3 text-xs text-amber-400 flex items-center gap-2 bg-amber-500/10 p-2 rounded border border-amber-500/20">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              <span>
                Current: <strong>{trip.delayReason}</strong>
              </span>
              <button
                onClick={() =>
                  callFn("setTruckDelay", { tripDocId: tripId, reason: null })
                }
                className="ml-auto text-[10px] underline hover:text-white"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* MANIFEST LEDGER */}
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-950 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-2">Tracking</th>
                <th className="px-4 py-2 text-center">Load Count</th>
                <th className="px-4 py-2 text-center">Type</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {packages.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-slate-200">
                    {p.trackingNumber || p.id}
                  </td>

                  {/* ADVANCED: Loaded Count */}
                  <td className="px-4 py-3 text-center">
                    <span className="bg-slate-800 px-2 py-1 rounded text-xs text-blue-400 font-bold border border-blue-500/30">
                      {p.loadedCount} Items
                    </span>
                  </td>

                  {/* ADVANCED: Partial Indicator */}
                  <td className="px-4 py-3 text-center">
                    {p.loadedCount < (p.assignedCount || 999) ? (
                      <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20">
                        PARTIAL
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        FULL
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleUnassign(p.id)}
                      disabled={isLocked || actionLoading}
                      className="text-slate-600 hover:text-red-400 disabled:opacity-30"
                    >
                      <FontAwesomeIcon icon={faMinus} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- SPLIT MODAL (Essential for Rule #3) --- */}
      {splitModalData && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-xl p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-white font-bold text-lg mb-1">Load Cargo</h3>
            <p className="text-slate-500 text-sm mb-4 font-mono">
              {splitModalData.id}
            </p>

            <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 mb-6 flex justify-between items-center">
              <div className="text-center">
                <div className="text-[10px] text-slate-500 uppercase font-bold">
                  Total
                </div>
                <div className="text-xl font-bold text-slate-300">
                  {splitModalData.itemsTotal}
                </div>
              </div>
              <div className="text-slate-700">
                <FontAwesomeIcon icon={faTruckLoading} />
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500 uppercase font-bold text-emerald-500">
                  Available
                </div>
                <div className="text-xl font-bold text-emerald-400">
                  {splitModalData.itemsPending}
                </div>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmAssign(e.target.count.value);
              }}
            >
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Load onto THIS Truck
              </label>
              <input
                name="count"
                type="number"
                min="1"
                max={splitModalData.itemsPending}
                defaultValue={splitModalData.itemsPending}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white text-center font-bold text-lg focus:border-blue-500 focus:outline-none mb-4"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSplitModalData(null)}
                  className="flex-1 py-3 rounded-lg border border-slate-700 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Styled Helper (Same as before)
function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  active,
  color = "blue",
}) {
  const colors = {
    amber: active
      ? "bg-amber-600 text-white border-amber-500"
      : "hover:bg-amber-500/10 text-amber-500 border-amber-500/30",
    emerald: active
      ? "bg-emerald-600 text-white border-emerald-500"
      : "hover:bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    red: "hover:bg-red-500/10 text-red-400 border-red-500/30",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-2 
      ${
        disabled
          ? "opacity-30 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600"
          : colors[color]
      } ${
        !disabled && !active
          ? "bg-slate-900 border-slate-700 text-slate-400"
          : ""
      }`}
    >
      <FontAwesomeIcon icon={icon} /> {label}{" "}
      {active && <FontAwesomeIcon icon={faCheckCircle} />}
    </button>
  );
}
