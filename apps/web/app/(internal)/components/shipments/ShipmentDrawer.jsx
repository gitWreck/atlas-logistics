"use client";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruck,
  faBoxOpen,
  faWrench,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../ui/StatusBadge";
import CustomerMessageWidget from "../messaging/CustomerMessageWidget";
import PackagesTable from "./Packages/PackagesTable";
import ShipmentOperations from "./ShipmentOperations";
import ShipmentProofs from "./ShipmentProofs";
import ShipmentTimelineTab from "./ShipmentTimelineTab";
import { getDrawerThemeClasses } from "@/app/utility/constant/theme";
import { TabButton } from "./utils";

export default function ShipmentDrawer({
  isOpen,
  onClose,
  data,
  isDark = false,
  onRefresh,
  profile,
}) {
  const [activeTab, setActiveTab] = useState("TIMELINE");
  const theme = getDrawerThemeClasses(isDark);

  useEffect(() => {
    if (isOpen) {
      setActiveTab("TIMELINE");
    }
  }, [isOpen, data]);

  if (!data) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${theme.overlay} ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <aside
        style={{ width: "min(100%, 780px)" }}
        className={`fixed top-0 right-0 h-full z-50 shadow-2xl transform transition-transform duration-300 flex flex-col ${theme.drawer} ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* HEADER */}
        <div
          className={`p-6 border-b flex justify-between items-start ${theme.header}`}
        >
          <div>
            <div
              className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${theme.eyebrow}`}
            >
              Shipment Order
            </div>

            <h2
              className={`text-xl font-mono font-bold tracking-tight ${theme.title}`}
            >
              {data.shipmentId || "Shipment #" + data.id}
            </h2>

            <div className="flex gap-2 mt-2 items-center">
              <StatusBadge status={data.status} isDark={isDark} />
              <span
                className={`text-xs border-l pl-2 ml-1 ${theme.mutedText} ${theme.divider}`}
              >
                {data.route || data.originCode + " → " + data.destinationCode}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${theme.closeButton}`}
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* TABS */}
        <div className={`flex border-b ${theme.tabsWrap}`}>
          <TabButton
            isActive={activeTab === "TIMELINE"}
            onClick={() => setActiveTab("TIMELINE")}
            icon={faTruck}
            label="Status"
            theme={theme}
          />

          <TabButton
            isActive={activeTab === "ITEMS"}
            onClick={() => setActiveTab("ITEMS")}
            icon={faBoxOpen}
            label={`Items (${data.packages?.length || 0})`}
            theme={theme}
          />

          <TabButton
            isActive={activeTab === "TOOLS"}
            onClick={() => setActiveTab("TOOLS")}
            icon={faWrench}
            label="Actions"
            theme={theme}
          />
        </div>

        {/* CONTENT */}
        <div className={`flex-1 overflow-y-auto p-6 ${theme.content}`}>
          {activeTab === "TIMELINE" && (
            <ShipmentTimelineTab data={data} isDark={isDark} />
          )}

          {activeTab === "ITEMS" && (
            <PackagesTable onRefresh={onRefresh} data={data} isDark={isDark} />
          )}

          {activeTab === "TOOLS" && (
            <div className="space-y-8 animate-in zoom-in-95 duration-200">
              <ShipmentOperations
                shipmentId={data.id}
                currentStatus={data.status}
                isDark={isDark}
                onRefresh={() => {
                  onRefresh?.();
                }}
                profile={profile}
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
