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
import ShipmentProofs from "./ShipmentProofs";
import { InfoCard } from "../ui/InfoCard";
import ShipmentTimelineTab from "./ShipmentTimelineTab";

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

  console.log("Rendering ShipmentDrawer with data:", data);

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
            <ShipmentTimelineTab data={data} isDark={isDark} />
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
              <ShipmentProofs shipment={data} isDark={isDark} />
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
