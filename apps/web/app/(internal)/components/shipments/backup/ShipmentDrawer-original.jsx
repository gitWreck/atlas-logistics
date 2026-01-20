import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruck,
  faCheckCircle,
  faBoxOpen,
  faBarcode,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../../ui/StatusBadge";
import { db } from "@/firebase"; // Ensure you import your firestore instance
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

function calculateCurrentStep(status) {
  // You can reuse your logic here to determine which step is "Active"
  return status;
}

// Simple Helper Component
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

export default function ShipmentDrawer({ isOpen, onClose, data }) {
  const [activeTab, setActiveTab] = useState("TIMELINE"); // 'TIMELINE' or 'ITEMS'
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  // Reset tab when opening different shipment
  useEffect(() => {
    if (isOpen) {
      setActiveTab("TIMELINE");
      fetchPackages();
    }
  }, [isOpen, data]);

  const fetchPackages = async () => {
    if (!data?.trackingNumber) return;

    setLoadingPackages(true);
    try {
      // Call your new Next.js API
      const res = await fetch(
        `/api/shipments/packages?shipmentId=${data.trackingNumber}`
      );

      if (!res.ok) throw new Error("Failed to fetch");

      const result = await res.json();
      setPackages(result.packages);
    } catch (err) {
      console.error("Failed to load packages", err);
    } finally {
      setLoadingPackages(false);
    }
  };

  if (!data) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`
          fixed top-0 right-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 shadow-2xl transform transition-transform duration-300 flex flex-col
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-950">
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1">
              Shipment Order
            </div>
            <h2 className="text-xl font-mono text-white font-bold tracking-tight">
              {data.trackingNumber}
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
            className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-slate-800 bg-slate-900">
          <button
            onClick={() => setActiveTab("TIMELINE")}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === "TIMELINE"
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <FontAwesomeIcon icon={faTruck} /> Status Flow
          </button>
          <button
            onClick={() => setActiveTab("ITEMS")}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === "ITEMS"
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <FontAwesomeIcon icon={faBoxOpen} /> Items ({packages.length})
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900 relative">
          {/* --- TAB 1: TIMELINE --- */}
          {activeTab === "TIMELINE" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Customer" value={data.recipient["name"]} />
                <InfoCard label="Driver" value={data.driver} />
                <InfoCard label="Origin" value={data.origin} />
                <InfoCard label="Destination" value={data.destination} />
              </div>

              {/* Timeline Visual */}
              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 pl-1">
                  Progress
                </h3>
                <div className="space-y-0 relative pl-4 border-l-2 border-slate-800 ml-2">
                  {[
                    "CREATED",
                    "RECEIVED",
                    "LOADED",
                    "IN_TRANSIT",
                    "OUT_FOR_DELIVERY",
                    "DELIVERED",
                  ].map((step, idx) => {
                    const isDone = idx * 16 <= (data.progress || 0);
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
                                ? "bg-blue-600 border-blue-600"
                                : "bg-slate-900 border-slate-700"
                            }
                            ${isCurrent ? "ring-4 ring-blue-500/20" : ""}
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
                          className={`-mt-1.5 ml-2 ${
                            isDone ? "opacity-100" : "opacity-40"
                          }`}
                        >
                          <p
                            className={`text-sm font-bold ${
                              isDone ? "text-white" : "text-slate-400"
                            }`}
                          >
                            {step.replace(/_/g, " ")}
                          </p>
                          {isCurrent && (
                            <p className="text-[10px] text-blue-400 mt-0.5">
                              Last updated: {data.lastUpdate}
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

          {/* --- TAB 2: ITEMS (PACKAGES) --- */}
          {activeTab === "ITEMS" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              {loadingPackages ? (
                <div className="text-center py-10 text-slate-500">
                  Loading package details...
                </div>
              ) : packages.length === 0 ? (
                <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                  No items linked to this shipment.
                </div>
              ) : (
                packages.map((pkg, idx) => (
                  <div
                    key={pkg.id}
                    className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl flex gap-4 items-center group hover:bg-slate-800/80 transition-colors"
                  >
                    {/* Seq Number */}
                    <div className="h-10 w-10 rounded-lg bg-slate-900 flex items-center justify-center font-mono text-slate-500 font-bold border border-slate-700">
                      {pkg.sequence || idx + 1}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="text-slate-200 font-medium truncate pr-2">
                          {pkg.description || "Package"}
                        </h4>
                        <StatusBadge status={pkg.status} size="xs" />
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex gap-3">
                        <span>{pkg.weight} kg</span>
                        <span className="text-slate-600">•</span>
                        <span className="font-mono text-slate-600">
                          {pkg.trackingNumber}
                        </span>
                      </div>
                    </div>

                    {/* Quick Action */}
                    <button className="text-slate-600 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <FontAwesomeIcon icon={faBarcode} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex gap-3">
          <button className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-sm transition-colors">
            Download Manifest
          </button>
          <button className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-colors shadow-lg shadow-blue-500/20">
            Generate Report
          </button>
        </div>
      </aside>
    </>
  );
}
