import React, { useState, useEffect } from "react";
import QRCode from "react-qr-code"; // Import QR Library
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruck,
  faBoxOpen,
  faWrench,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../ui/StatusBadge";
import CustomerMessageWidget from "../messaging/CustomerMessageWidget";
import PackagesTable from "./Packages/PackagesTable";
import ShipmentOperations from "./ShipmentOperations";

export default function ShipmentDrawer({
  isOpen,
  onClose,
  data,
  isDark = false,
  onRefresh, // New prop to trigger data refresh after operations
}) {
  const [activeTab, setActiveTab] = useState("TIMELINE");
  const [messageBody, setMessageBody] = useState("");

  console.log("ShipmentDrawer Rendered with data:", data);

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

  if (!data) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          isDark ? "bg-black/60" : "bg-black/40"
        } ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      <aside
        style={{ width: "min(100%, 780px)" }}
        className={`
          fixed top-0 right-0 h-full z-50 shadow-2xl transform transition-transform duration-300 flex flex-col
          ${isDark ? "bg-slate-900 border-l border-slate-800" : "bg-white border-l border-slate-200"}
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* HEADER */}
        <div
          className={`p-6 border-b flex justify-between items-start ${
            isDark
              ? "border-slate-800 bg-slate-950"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <div>
            <div
              className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${
                isDark ? "text-slate-500" : "text-slate-600"
              }`}
            >
              Shipment Order
            </div>
            <h2
              className={`text-xl font-mono font-bold tracking-tight ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {data.trackingNumber}
            </h2>
            <div className="flex gap-2 mt-2 items-center">
              <StatusBadge status={data.status} isDark={isDark} />
              <span
                className={`text-xs border-l pl-2 ml-1 ${
                  isDark
                    ? "text-slate-400 border-slate-700"
                    : "text-slate-600 border-slate-300"
                }`}
              >
                {data.route}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? "text-slate-500 hover:text-white hover:bg-slate-800"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
            }`}
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* TABS */}
        <div
          className={`flex border-b ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-slate-50"}`}
        >
          <TabButton
            isActive={activeTab === "TIMELINE"}
            onClick={() => setActiveTab("TIMELINE")}
            icon={faTruck}
            label="Status"
            isDark={isDark}
          />
          <TabButton
            isActive={activeTab === "ITEMS"}
            onClick={() => setActiveTab("ITEMS")}
            icon={faBoxOpen}
            label={`Items (${data.packages.length})`}
            isDark={isDark}
          />
          <TabButton
            isActive={activeTab === "TOOLS"}
            onClick={() => setActiveTab("TOOLS")}
            icon={faWrench}
            label="Actions"
            isDark={isDark}
          />
        </div>

        {/* CONTENT */}
        <div
          className={`flex-1 overflow-y-auto p-6 ${isDark ? "bg-slate-900" : "bg-white"}`}
        >
          {/* --- TAB 1: TIMELINE --- */}
          {activeTab === "TIMELINE" && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="grid grid-cols-2 gap-3 mb-8">
                <InfoCard
                  label="Sender"
                  value={data.sender?.name}
                  isDark={isDark}
                />
                <InfoCard
                  label="Sender Phone"
                  value={data.sender?.phone}
                  isDark={isDark}
                />
                <InfoCard
                  label="Recipient"
                  value={data.recipient?.name}
                  isDark={isDark}
                />
                <InfoCard
                  label="Recipient Phone"
                  value={data.recipient?.phone}
                  isDark={isDark}
                />
                <InfoCard label="Origin" value={data.origin} isDark={isDark} />
                <InfoCard
                  label="Destination"
                  value={data.destination}
                  isDark={isDark}
                />
              </div>
              <div className={isDark ? "text-slate-500" : "text-slate-600"}>
                <div>
                  <h3
                    className={`text-xs font-bold uppercase mb-4 pl-1 ${
                      isDark ? "text-slate-500" : "text-slate-600"
                    }`}
                  >
                    Status Flow
                  </h3>
                  <div
                    className={`space-y-0 relative pl-4 border-l-2 ml-2 ${
                      isDark ? "border-slate-800" : "border-slate-200"
                    }`}
                  >
                    {(() => {
                      // 1. Determine if this started as a Home Pickup
                      const isPickupOrder =
                        data.status === "PENDING_PICKUP" ||
                        data.status === "PICKED_UP" ||
                        (data.statusHistory || []).some((h) =>
                          h.status.includes("PICKUP"),
                        );

                      // 2. Build the continuous timeline dynamically
                      const STEPS = isPickupOrder
                        ? [
                            "PENDING_PICKUP",
                            "PICKED_UP",
                            "RECEIVED", // Merges into standard flow here (at Origin Hub)
                            "ASSIGNED",
                            "LOADED",
                            "IN_TRANSIT",
                            "OUT_FOR_DELIVERY",
                            "DELIVERED",
                          ]
                        : [
                            "CREATED", // Standard Drop-off
                            "RECEIVED",
                            "ASSIGNED",
                            "LOADED",
                            "IN_TRANSIT",
                            "OUT_FOR_DELIVERY",
                            "DELIVERED",
                          ];

                      const currentStepIndex = STEPS.indexOf(data.status);

                      return STEPS.map((step, idx) => {
                        // 3. Check progress based on array index, not strict percentage
                        const isDone = currentStepIndex >= idx;
                        const isCurrent = data.status === step;

                        return (
                          <div key={step} className="relative pb-8 last:pb-0">
                            {/* Dot */}
                            <div
                              className={`
                                absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-300
                                ${
                                  isDone
                                    ? "bg-blue-600 border-blue-600"
                                    : isDark
                                      ? "bg-slate-900 border-slate-700"
                                      : "bg-slate-100 border-slate-300"
                                }
                                ${
                                  isCurrent
                                    ? "ring-4 ring-blue-500/20 scale-110"
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
                              className={`-mt-1.5 ml-2 transition-opacity duration-300 ${
                                isDone || isCurrent
                                  ? "opacity-100"
                                  : "opacity-40"
                              }`}
                            >
                              <p
                                className={`text-sm font-bold ${
                                  isDone || isCurrent
                                    ? isDark
                                      ? "text-white"
                                      : "text-slate-900"
                                    : isDark
                                      ? "text-slate-400"
                                      : "text-slate-500"
                                }`}
                              >
                                {step.replace(/_/g, " ")}
                              </p>
                              {isCurrent && (
                                <p
                                  className={`text-[10px] mt-0.5 ${
                                    isDark ? "text-blue-400" : "text-blue-600"
                                  }`}
                                >
                                  Current Stage • {data.updatedAt}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
              {/* --- STATUS HISTORY LOG (Add after the Status Flow block) --- */}
              <div className="mt-12 border-t pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3
                  className={`text-xs font-bold uppercase mb-4 tracking-widest pl-1 ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Detailed Activity Log
                </h3>

                <div className="space-y-4">
                  {data.statusHistory && data.statusHistory.length > 0 ? (
                    // Sort history to show newest first
                    [...data.statusHistory].reverse().map((log, idx) => (
                      <div key={idx} className="flex gap-4 group">
                        {/* Timestamp column */}
                        {/* --- Timestamp Column --- */}
                        <div className="w-24 shrink-0 pt-1">
                          <p
                            className={`text-[12px] font-mono font-bold leading-none ${isDark ? "text-slate-400" : "text-slate-700"}`}
                          >
                            {log.at?._seconds
                              ? // Convert the _seconds property to a JS Date object
                                new Date(
                                  log.at._seconds * 1000,
                                ).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </p>
                          <p
                            className={`text-[11px] font-medium mt-1 opacity-60 ${isDark ? "text-slate-500" : "text-slate-500"}`}
                          >
                            {log.at?._seconds
                              ? new Date(
                                  log.at._seconds * 1000,
                                ).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
                          </p>
                        </div>

                        {/* Activity Info */}
                        <div
                          className={`flex-1 p-3 rounded-xl border transition-colors ${
                            isDark
                              ? "bg-slate-800/20 border-slate-800 group-hover:border-slate-700"
                              : "bg-slate-50 border-slate-200 group-hover:border-slate-300"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                                isDark
                                  ? "bg-slate-800 text-slate-400"
                                  : "bg-white text-slate-600 border"
                              }`}
                            >
                              {log.status.replace(/_/g, " ")}
                            </span>
                            {/* <span
                              className={`text-[9px] italic ${isDark ? "text-slate-600" : "text-slate-400"}`}
                            >
                              by Admin
                            </span> */}
                          </div>
                          {log.note && (
                            <p
                              className={`text-xs mt-2 italic leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}
                            >
                              "{log.note}"
                            </p>
                          )}
                          {log.location && (
                            <div
                              className={`mt-2 flex items-center gap-1.5 text-[9px] font-bold ${isDark ? "text-blue-400/60" : "text-blue-600/60"}`}
                            >
                              <FontAwesomeIcon
                                icon={faTruck}
                                className="text-[7px]"
                              />
                              {log.location}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      className={`text-xs italic text-center p-8 border border-dashed rounded-xl ${isDark ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"}`}
                    >
                      No detailed logs available for this shipment yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* --- TAB 2: ITEMS --- */}
          {activeTab === "ITEMS" && (
            <PackagesTable data={data} isDark={isDark} />
          )}

          {/* --- TAB 3: TOOLS (EMBEDDED QR & MESSAGE) --- */}
          {activeTab === "TOOLS" && (
            <div className="space-y-8 animate-in zoom-in-95 duration-200">
              <ShipmentOperations
                shipmentId={data.id}
                currentStatus={data.status}
                isDark={isDark}
                onRefresh={() => {
                  // Optionally refresh shipment data here after an operation
                  onRefresh();
                }}
              />
              <CustomerMessageWidget shipment={data} isDark={isDark} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// --- HELPER COMPONENTS ---

function TabButton({ isActive, onClick, icon, label, isDark = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-2 uppercase tracking-wide ${
        isActive
          ? "border-blue-500 bg-blue-500/5 " +
            (isDark ? "text-blue-400" : "text-blue-600")
          : isDark
            ? "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
            : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100"
      }`}
    >
      <FontAwesomeIcon icon={icon} /> {label}
    </button>
  );
}

function InfoCard({ label, value, isDark = false }) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        isDark
          ? "bg-slate-800/30 border-slate-800"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      <div
        className={`text-[10px] uppercase font-bold mb-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
      >
        {label}
      </div>
      <div
        className={`text-sm font-medium truncate ${isDark ? "text-slate-300" : "text-slate-700"}`}
      >
        {value || "—"}
      </div>
    </div>
  );
}
