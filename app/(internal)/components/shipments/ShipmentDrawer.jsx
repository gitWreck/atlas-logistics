import React, { useState, useEffect } from "react";
import QRCode from "react-qr-code"; // Import QR Library
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruck,
  faBoxOpen,
  faWrench, // Icon for Tools/Actions
  faPaperPlane,
  faPrint,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../ui/StatusBadge";

function calculateCurrentStep(status) {
  // You can reuse your logic here to determine which step is "Active"
  return status;
}

export default function ShipmentDrawer({ isOpen, onClose, data }) {
  const [activeTab, setActiveTab] = useState("TIMELINE");
  const [packages, setPackages] = useState([]);
  const [messageBody, setMessageBody] = useState(""); // State for the message input
  const [loadingPackages, setLoadingPackages] = useState(false);

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab("TIMELINE");
      setMessageBody(
        `Hello ${data?.recipient?.name || "Customer"}, regarding order ${
          data?.trackingNumber
        }...`
      );
      fetchPackages();
    }
  }, [isOpen, data]);

  const fetchPackages = async () => {
    if (!data?.trackingNumber) return;
    setLoadingPackages(true);
    try {
      const res = await fetch(
        `/api/shipments/packages?shipmentId=${data.trackingNumber}`
      );
      const result = await res.json();
      setPackages(result.packages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleSendMessage = () => {
    // Integration logic here
    alert(`Sending SMS to ${data.recipient?.phone}:\n\n"${messageBody}"`);
  };

  if (!data) return null;

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
            isActive={activeTab === "ITEMS"}
            onClick={() => setActiveTab("ITEMS")}
            icon={faBoxOpen}
            label={`Items (${packages.length})`}
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
              {/* Reusing your existing Timeline Logic */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                <InfoCard label="Customer" value={data.recipient?.name} />
                <InfoCard label="Phone" value={data.recipient?.phone} />
                <InfoCard label="Origin" value={data.origin} />
                <InfoCard label="Destination" value={data.destination} />
              </div>
              {/* (Insert your timeline map loop here...) */}
              <div className="text-slate-500">
                {/* Timeline Visual */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 pl-1">
                    Progress
                  </h3>
                  <div className="space-y-0 relative pl-4 border-l-2 border-slate-800 ml-2">
                    {[
                      "CREATED",
                      "RECEIVED",
                      "ASSIGNED",
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
                                            ${
                                              isCurrent
                                                ? "ring-4 ring-blue-500/20"
                                                : ""
                                            }
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
                                Last updated: {data.updatedAt}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB 2: ITEMS --- */}
          {activeTab === "ITEMS" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
              {packages.map((pkg, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/40 border border-slate-700 p-3 rounded-lg flex justify-between items-center"
                >
                  <div className="flex gap-3 items-center">
                    <div className="h-8 w-8 bg-slate-900 rounded flex items-center justify-center text-xs font-mono font-bold text-slate-500 border border-slate-700">
                      {pkg.sequence || idx + 1}
                    </div>
                    <div>
                      {/* <div className="text-slate-200 text-sm font-medium">
                        {pkg.description}
                      </div> */}
                      <div className="text-slate-200 text-sm font-medium">
                        {pkg.description}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {pkg.trackingNumber}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={pkg.status} size="xs" />
                </div>
              ))}
            </div>
          )}

          {/* --- TAB 3: TOOLS (EMBEDDED QR & MESSAGE) --- */}
          {activeTab === "TOOLS" && (
            <div className="space-y-8 animate-in zoom-in-95 duration-200">
              {/* SECTION A: MASTER QR CODE */}
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 text-center">
                <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center justify-center gap-2">
                  <FontAwesomeIcon icon={faPrint} className="text-blue-500" />
                  Master Label (Shipment)
                </h3>

                {/* The Embedded QR */}
                <div className="bg-white p-4 rounded-lg inline-block shadow-lg mx-auto">
                  <QRCode
                    value={data.trackingNumber}
                    size={150}
                    fgColor="#0f172a"
                  />
                </div>

                <div className="mt-4 flex justify-center">
                  <button className="text-xs font-bold text-blue-400 hover:text-blue-300 border border-blue-500/30 bg-blue-500/10 px-4 py-2 rounded-full transition-colors">
                    Print this Label
                  </button>
                </div>
              </div>

              {/* SECTION B: MESSAGING */}
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                  <FontAwesomeIcon
                    icon={faPaperPlane}
                    className="text-emerald-500"
                  />
                  Message Customer
                </h3>

                <div className="text-xs text-slate-500 mb-2">
                  To:{" "}
                  <span className="text-slate-300">{data.recipient?.name}</span>{" "}
                  ({data.recipient?.phone})
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

// --- HELPER COMPONENTS ---

function TabButton({ isActive, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-2 uppercase tracking-wide ${
        isActive
          ? "border-blue-500 text-blue-400 bg-blue-500/5"
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
