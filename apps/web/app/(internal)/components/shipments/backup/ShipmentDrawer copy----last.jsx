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
  faQrcode,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../../ui/StatusBadge";
import ShipmentLabel from "../ShipmentLabel";
import CustomerMessageWidget from "../../messaging/CustomerMessageWidget";
import PackagesTable from "../Packages/PackagesTable";
// import ShipmentBoard from "./ShipmentBoard";

function calculateCurrentStep(status) {
  // You can reuse your logic here to determine which step is "Active"
  return status;
}

export default function ShipmentDrawer({ isOpen, onClose, data }) {
  const [activeTab, setActiveTab] = useState("TIMELINE");
  const [messageBody, setMessageBody] = useState(""); // State for the message input
  // const [packages, setPackages] = useState([]);
  // const [loadingPackages, setLoadingPackages] = useState(false);

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab("TIMELINE");
      setMessageBody(
        `Hello ${data?.recipient?.name || "Customer"}, regarding order ${
          data?.trackingNumber
        }...`,
      );
    }
    console.log("shipment data: ", data);
  }, [isOpen, data]);

  const handleSendMessage = () => {
    // Integration logic here
    alert(`Sending SMS to ${data.recipient?.phone}:\n\n"${messageBody}"`);
  };

  if (!data) return null;

  function PackageRow({ pkg, idx }) {
    const [showQR, setShowQR] = useState(false);

    return (
      <div className="bg-slate-800/40 border border-slate-700 p-3 rounded-lg flex flex-col gap-3">
        {/* TOP ROW: INFO */}
        <div className="flex justify-between items-center">
          <div className="flex gap-3 items-center">
            {/* SEQUENCE BADGE */}
            <div className="h-8 w-8 bg-slate-900 rounded flex items-center justify-center text-xs font-mono font-bold text-slate-500 border border-slate-700">
              {pkg.sequence || idx + 1}
            </div>

            {/* TEXT DETAILS */}
            <div>
              <div className="text-slate-200 text-sm font-medium">
                {pkg.description}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                {pkg.trackingNumber}
              </div>
            </div>
          </div>

          {/* ACTIONS & STATUS */}
          <div className="flex items-center gap-3">
            {/* QR TOGGLE BUTTON */}
            <button
              onClick={() => setShowQR(!showQR)}
              className={`h-8 w-8 rounded flex items-center justify-center transition-all ${
                showQR
                  ? "bg-white text-black"
                  : "bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white"
              }`}
              title="Show QR Code"
            >
              <FontAwesomeIcon icon={faQrcode} />
            </button>

            <StatusBadge status={pkg.status} size="xs" />
          </div>
        </div>

        {/* QR CODE REVEAL (CONDITIONAL) */}
        {showQR && <ShipmentLabel shipment={data} packages={pkg} index={idx} />}
      </div>
    );
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <aside
        style={{ width: "min(100%, 600px)" }}
        className={`
          fixed top-0 right-0 h-full 
          bg-slate-900 border-l border-slate-800 z-50 shadow-2xl transform transition-transform duration-300 flex flex-col
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
            label={`Items (${data.packages.length})`}
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
                    Status Flow
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
            <PackagesTable data={data} />
            // <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
            //   <button
            //     onClick={() =>
            //       // window.open(`../print/labels?id=${data.id}`, "_blank")
            //       window.open(
            //         `/components/print/labels?id=${encodeURIComponent(data.id)}`,
            //         "_blank",
            //       )
            //     }
            //     className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-bold"
            //   >
            //     <FontAwesomeIcon icon={faPrint} />
            //     <span>Print {data.packages?.length} Labels</span>
            //   </button>
            //   {data.packages.map((pkg, idx) => (
            //     <PackageRow key={idx} pkg={pkg} idx={idx} />
            //   ))}
            // </div>
          )}

          {/* --- TAB 3: TOOLS (EMBEDDED QR & MESSAGE) --- */}
          {activeTab === "TOOLS" && (
            <div className="space-y-8 animate-in zoom-in-95 duration-200">
              {/* SECTION B: MESSAGING */}
              <CustomerMessageWidget shipment={data} />
            </div>
          )}
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
