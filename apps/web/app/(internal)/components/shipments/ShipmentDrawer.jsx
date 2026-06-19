"use client";

import React, { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruck,
  faBoxOpen,
  faWrench,
  faSync,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";
import StatusBadge from "../ui/StatusBadge";
import CustomerMessageWidget from "../messaging/CustomerMessageWidget";
import PackagesTable from "./Packages/PackagesTable";
import ShipmentOperations from "./ShipmentOperations";
import ShipmentProofs from "./ShipmentProofs";
import ShipmentTimelineTab from "./ShipmentTimelineTab";
import HubReconcileCard from "./HubReconcileCard";
import ReturnLoopCard from "./ReturnLoopCard";
import DrawerTabButton from "../ui/DrawerTabButton";
import { getDrawerThemeClasses } from "@/app/utility/constant/theme";
import {
  getCustodyLockMessage,
  isShipmentCustodyLocked,
} from "@/app/utility/custodyLock";

export default function ShipmentDrawer({
  isOpen,
  onClose,
  data,
  isDark = false,
  onRefresh,
  profile,
  onReconcile,
  onReceiveReturned,
  onReleaseToCheckers,
  canManageWarehouse = false,
}) {
  const [activeTab, setActiveTab] = useState("TIMELINE");
  const [shipmentData, setShipmentData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const theme = getDrawerThemeClasses(isDark);

  const fetchShipmentDetails = useCallback(async (shipmentId) => {
    if (!shipmentId) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to load shipment");

      const json = await res.json();
      setShipmentData(json.shipment || null);
    } catch (error) {
      console.error("Failed to load shipment details:", error);
    }
  }, []);

  useEffect(() => {
    if (isOpen && data?.id) {
      setActiveTab("TIMELINE");
      setShipmentData(data);
      fetchShipmentDetails(data.id);
    } else if (!isOpen) {
      setShipmentData(null);
    }
  }, [isOpen, data?.id, fetchShipmentDetails]);

  const displayData = shipmentData || data;

  if (!displayData) return null;

  const custodyLocked = isShipmentCustodyLocked(displayData);

  const handleRefresh = async () => {
    if (refreshing || !displayData?.id) return;

    setRefreshing(true);
    try {
      await fetchShipmentDetails(displayData.id);
      onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  };

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
              {displayData.shipmentId || "Shipment #" + displayData.id}
            </h2>

            <div className="flex gap-2 mt-2 items-center">
              <StatusBadge status={displayData.status} isDark={isDark} />
              <span
                className={`text-xs border-l pl-2 ml-1 ${theme.mutedText} ${theme.divider}`}
              >
                {displayData.route ||
                  displayData.originCode + " → " + displayData.destinationCode}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className={`p-2 rounded-lg transition-colors ${theme.closeButton}`}
              title="Refresh shipment"
              aria-label="Refresh shipment"
            >
              <FontAwesomeIcon
                icon={faSync}
                spin={refreshing}
                className="w-4 h-4"
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${theme.closeButton}`}
              aria-label="Close drawer"
            >
              <FontAwesomeIcon icon={faTimes} size="lg" />
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className={`flex border-b ${theme.tabsWrap}`}>
          <DrawerTabButton
            isActive={activeTab === "TIMELINE"}
            onClick={() => setActiveTab("TIMELINE")}
            icon={faTruck}
            label="Status"
            theme={theme}
          />

          <DrawerTabButton
            isActive={activeTab === "ITEMS"}
            onClick={() => setActiveTab("ITEMS")}
            icon={faBoxOpen}
            label={`Items (${displayData.packages?.length || 0})`}
            theme={theme}
          />

          <DrawerTabButton
            isActive={activeTab === "TOOLS"}
            onClick={() => setActiveTab("TOOLS")}
            icon={faWrench}
            label="Actions"
            theme={theme}
          />
        </div>

        {custodyLocked && (
          <div className="mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <span className="font-bold uppercase tracking-wide">Manifest locked</span>
            <p className="mt-1 leading-relaxed">{getCustodyLockMessage()}</p>
          </div>
        )}

        {/* CONTENT */}
        <div className={`flex-1 overflow-y-auto p-6 ${theme.content}`}>
          {activeTab === "TIMELINE" && (
            <div className="space-y-6">
              <ReturnLoopCard
                shipment={displayData}
                isDark={isDark}
                canManage={canManageWarehouse}
                onReceiveReturned={onReceiveReturned}
                onReleaseToCheckers={onReleaseToCheckers}
              />
              <HubReconcileCard
                shipment={displayData}
                isDark={isDark}
                canManage={canManageWarehouse}
                onReconcile={onReconcile}
              />
              <ShipmentTimelineTab data={displayData} isDark={isDark} />
            </div>
          )}

          {activeTab === "ITEMS" && (
            <PackagesTable
              onRefresh={handleRefresh}
              data={displayData}
              isDark={isDark}
            />
          )}

          {activeTab === "TOOLS" && (
            <div className="space-y-8 animate-in zoom-in-95 duration-200">
              <ShipmentOperations
                shipmentId={displayData.id}
                currentStatus={displayData.status}
                isDark={isDark}
                custodyLocked={custodyLocked}
                onRefresh={handleRefresh}
                profile={profile}
              />

              <CustomerMessageWidget shipment={displayData} isDark={isDark} />

              <ShipmentProofs shipment={displayData} isDark={isDark} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
