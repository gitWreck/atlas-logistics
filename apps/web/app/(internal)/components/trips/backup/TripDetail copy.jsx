"use client";
import React, { useState, useEffect } from "react";
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, app } from "@/apps/web/lib/firebase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLock,
  faFileContract,
  faUndo,
  faExclamationTriangle,
  faPlus,
  faMinus,
  faExternalLinkAlt,
} from "@fortawesome/free-solid-svg-icons";

export default function TripDetail({ tripId }) {
  const [trip, setTrip] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loadingAction, setLoadingAction] = useState(false);

  // Inputs
  const [assignId, setAssignId] = useState("");
  const [delayReason, setDelayReason] = useState("");

  // 1. Listen to Trip Data
  useEffect(() => {
    if (!tripId) return;
    const unsub = onSnapshot(doc(db, "truck_trips", tripId), (doc) => {
      setTrip(doc.data());
    });
    return () => unsub();
  }, [tripId]);

  // 2. Listen to Packages Subcollection
  useEffect(() => {
    if (!tripId) return;
    const q = query(
      collection(db, "truck_trips", tripId, "trip_packages"),
      orderBy("updatedAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setPackages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [tripId]);

  // --- ACTIONS ---
  const callFn = async (name, payload) => {
    setLoadingAction(true);
    try {
      const functions = getFunctions(app);
      const fn = httpsCallable(functions, name);
      const res = await fn(payload);
      return res.data;
    } catch (err) {
      alert("Error: " + err.message);
      return null;
    } finally {
      setLoadingAction(false);
    }
  };

  const handleAssign = async () => {
    if (!assignId) return;
    const res = await callFn("assignShipmentToTruckTrip", {
      trackingDocId: assignId,
      truckTripId: tripId,
    });
    if (res) setAssignId(""); // Clear input on success
  };

  const handleUnassign = async (pid) => {
    if (!confirm("Remove this shipment from the trip?")) return;
    await callFn("unassignShipmentFromTruckTrip", {
      trackingDocId: pid,
      truckTripId: tripId,
    });
  };

  const handleLock = async () =>
    callFn("generateTripManifest", { tripDocId: tripId });
  const handleCertify = async () =>
    callFn("generateTripCertificate", { tripDocId: tripId });
  const handleReopen = async () => {
    if (confirm("Reopening voids the certificate. Continue?"))
      callFn("reopenTrip", { tripDocId: tripId });
  };

  const handleSetDelay = async () => {
    if (!delayReason) return;
    await callFn("setTruckDelay", { tripDocId: tripId, reason: delayReason });
    setDelayReason("");
  };

  if (!trip)
    return <div className="p-6 text-slate-500">Loading trip details...</div>;

  const isLocked = trip.manifestLocked;
  const isCertified = !!trip.certificate;

  return (
    <div className="flex flex-col h-full">
      {/* HEADER Actions */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/30">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-mono font-bold text-white">
              {trip.tripId}
            </h2>
            <div className="flex gap-4 text-xs text-slate-400 mt-1">
              <span>Driver: {trip.driverName || "—"}</span>
              <span>Route: {trip.route || "—"}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {trip.manifest?.pdfUrl && (
              <a
                href={trip.manifest.pdfUrl}
                target="_blank"
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faFileContract} /> Manifest PDF
              </a>
            )}
            {trip.certificate?.pdfUrl && (
              <a
                href={trip.certificate.pdfUrl}
                target="_blank"
                className="text-xs bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 px-3 py-2 rounded border border-emerald-500/30 flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faFileContract} /> Certificate
              </a>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800">
          <ActionButton
            label="Lock Manifest"
            icon={faLock}
            onClick={handleLock}
            disabled={isLocked || loadingAction}
            active={isLocked}
            color="amber"
          />
          <ActionButton
            label="Generate Cert"
            icon={faFileContract}
            onClick={handleCertify}
            disabled={!isLocked || isCertified || loadingAction}
            active={isCertified}
            color="emerald"
          />
          <ActionButton
            label="Reopen"
            icon={faUndo}
            onClick={handleReopen}
            disabled={!isCertified || loadingAction}
            color="red"
          />
        </div>
      </div>

      {/* BODY SCROLL */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ASSIGNMENT TOOL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">
              Assign Shipment
            </h4>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                placeholder="Enter Tracking ID..."
                value={assignId}
                onChange={(e) => setAssignId(e.target.value)}
                disabled={isLocked}
              />
              <button
                onClick={handleAssign}
                disabled={isLocked || loadingAction || !assignId}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 rounded-lg"
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </div>
            {isLocked && (
              <p className="text-[10px] text-amber-500 mt-2">
                Unlock manifest to add shipments.
              </p>
            )}
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">
              Delay Status
            </h4>
            <div className="flex gap-2">
              <select
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
              >
                <option value="">Status: On Time</option>
                <option value="WEATHER">Weather Delay</option>
                <option value="MECHANICAL">Mechanical Issue</option>
                <option value="PORT_CONGESTION">Port Congestion</option>
              </select>
              <button
                onClick={handleSetDelay}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 rounded-lg"
                disabled={loadingAction}
              >
                Set
              </button>
            </div>
            {trip.delayReason && (
              <div className="mt-2 text-xs text-amber-400 flex items-center gap-2">
                <FontAwesomeIcon icon={faExclamationTriangle} /> Currently
                delayed: {trip.delayReason}
              </div>
            )}
          </div>
        </div>

        {/* PACKAGES TABLE */}
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <div className="bg-slate-900/80 p-3 border-b border-slate-800 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase">
              Trip Manifest ({packages.length})
            </span>
          </div>
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-950 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-2">Tracking</th>
                <th className="px-4 py-2">Route</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {packages.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-slate-200">
                    {p.trackingNumber || p.id}
                  </td>
                  <td className="px-4 py-3 text-xs">{p.route}</td>
                  <td className="px-4 py-3 text-xs">{p.status}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleUnassign(p.id)}
                      disabled={isLocked}
                      className="text-slate-600 hover:text-red-400 disabled:opacity-30 transition-colors"
                    >
                      <FontAwesomeIcon icon={faMinus} />
                    </button>
                  </td>
                </tr>
              ))}
              {packages.length === 0 && (
                <tr>
                  <td
                    colSpan="4"
                    className="p-8 text-center text-slate-600 text-xs"
                  >
                    No shipments assigned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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
      className={`
        flex-1 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-2
        ${
          disabled
            ? "opacity-30 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600"
            : colors[color]
        }
        ${!disabled && !active ? "bg-slate-900" : ""}
      `}
    >
      <FontAwesomeIcon icon={icon} /> {label}
    </button>
  );
}
