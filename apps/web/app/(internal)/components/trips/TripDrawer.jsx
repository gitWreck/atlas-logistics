"use client";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruck,
  faClipboardList,
  faWrench,
  faUnlock,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";

import TripTimelineTab from "./TripTimelineTab";
import TripManifestTab from "./TripManifestTab";
import TripToolsTab from "./TripToolsTab";
import TripDrawerFooter from "./TripDrawerFooter";
import StatusBadge from "../ui/StatusBadge";
import UnassignShipmentModal from "../manifests/modals/UnassignShipmentModal";
import BulkAssignmentModal from "../manifests/modals/BulkAssignmentModal";
import ViewPackagesModal from "../manifests/ViewPackagesModal/ViewPackagesModal";
import { unlockTripManifest } from "@/app/utility/FirebaseFunctions";
import { getDrawerThemeClasses } from "@/app/utility/constant/theme";

export default function TripDrawer({
  isOpen,
  onClose,
  data,
  onRefreshTrips,
  isDark = false,
}) {
  const [activeTab, setActiveTab] = useState("TIMELINE");
  const [shipments, setShipments] = useState([]);
  const [loadingShips, setLoadingShips] = useState(false);
  const [shipmentToUnassign, setShipmentToUnassign] = useState(null);
  const [selectedShipmentForModal, setSelectedShipmentForModal] =
    useState(null);
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);

  const theme = getDrawerThemeClasses(isDark);

  const fetchShipments = async () => {
    if (!data?.tripId) return;

    setLoadingShips(true);

    try {
      const token = await auth.currentUser?.getIdToken();

      const res = await fetch(`/api/manifests/trips/${data.tripId}/shipments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const json = await res.json();
      setShipments(json.shipments || []);
    } catch (error) {
      console.error("Failed to load manifest:", error);
    } finally {
      setLoadingShips(false);
    }
  };

  useEffect(() => {
    if (isOpen && data?.tripId) {
      setActiveTab("TIMELINE");
      fetchShipments();
    }
  }, [isOpen, data?.tripId]);

  if (!data) return null;

  const handleUnlockManifest = async () => {
    const reason = prompt(
      "Why are you unlocking this manifest? (Required for audit)",
    );

    if (!reason) return;

    try {
      await unlockTripManifest({
        tripDocId: data?.id || data?.tripId,
        reason,
      });

      fetchShipments();
      onRefreshTrips?.();
    } catch (error) {
      console.error("Failed to unlock manifest:", error);
      alert(error.message || "Failed to unlock manifest.");
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
        {/* Header */}
        <div
          className={`p-6 border-b flex justify-between items-start gap-4 ${theme.header}`}
        >
          <div className="min-w-0">
            <div
              className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${theme.eyebrow}`}
            >
              Active Trip Details
            </div>

            <h2
              className={`text-xl font-mono font-bold tracking-tight break-all ${theme.title}`}
            >
              {data.tripId}
            </h2>

            <div className="flex gap-2 mt-2 items-center flex-wrap">
              <StatusBadge status={data.status} isDark={isDark} />
              <span
                className={`text-xs border-l pl-2 ml-1 ${theme.mutedText} ${theme.divider}`}
              >
                {data.route}
              </span>
            </div>
          </div>

          {/* <div className="flex items-center gap-2 shrink-0">
            {data?.isLocked && (
              <button
                type="button"
                onClick={handleUnlockManifest}
                className={theme.unlockButton}
              >
                <FontAwesomeIcon icon={faUnlock} className="mr-2" />
                Unlock Manifest
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${theme.closeButton}`}
            >
              <FontAwesomeIcon icon={faTimes} size="lg" />
            </button>
          </div> */}
        </div>

        {/* Tabs */}
        <div className={`flex border-b ${theme.tabsWrap}`}>
          <TabButton
            isDark={isDark}
            theme={theme}
            isActive={activeTab === "TIMELINE"}
            onClick={() => setActiveTab("TIMELINE")}
            icon={faTruck}
            label="Status"
          />

          <TabButton
            isDark={isDark}
            theme={theme}
            isActive={activeTab === "MANIFEST"}
            onClick={() => setActiveTab("MANIFEST")}
            icon={faClipboardList}
            label={`Manifest (${shipments.length})`}
          />

          <TabButton
            isDark={isDark}
            theme={theme}
            isActive={activeTab === "TOOLS"}
            onClick={() => setActiveTab("TOOLS")}
            icon={faWrench}
            label="Actions"
          />
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto p-6 ${theme.content}`}>
          {activeTab === "TIMELINE" && (
            <TripTimelineTab
              data={data}
              onRefresh={() => onRefreshTrips?.()}
              isDark={isDark}
            />
          )}

          {activeTab === "MANIFEST" && (
            <TripManifestTab
              shipments={shipments}
              loading={loadingShips}
              isLocked={data.manifestLocked}
              onAddShipment={() => setBulkModalOpen(true)}
              onViewPackages={(shipment) =>
                setSelectedShipmentForModal(shipment)
              }
              onUnassign={(shipment) => setShipmentToUnassign(shipment)}
              tripId={data?.tripId}
              onRefresh={() => {
                fetchShipments();
                onRefreshTrips?.();
              }}
              isDark={isDark}
            />
          )}

          {activeTab === "TOOLS" && (
            <TripToolsTab
              data={data}
              onRefresh={() => {
                fetchShipments();
                onRefreshTrips?.();
              }}
              isDark={isDark}
            />
          )}
        </div>

        {/* Footer */}
        <TripDrawerFooter
          data={data}
          onClose={onClose}
          shipments={shipments}
          isDark={isDark}
          onSuccess={() => {
            onRefreshTrips?.();
          }}
        />
      </aside>

      <ViewPackagesModal
        isOpen={!!selectedShipmentForModal}
        shipment={selectedShipmentForModal}
        onClose={() => setSelectedShipmentForModal(null)}
        isLocked={data.manifestLocked}
        onRefresh={() => {
          fetchShipments();
          onRefreshTrips?.();
        }}
        isDark={isDark}
      />

      <UnassignShipmentModal
        isOpen={!!shipmentToUnassign}
        shipment={shipmentToUnassign}
        tripId={data?.tripId}
        onClose={() => setShipmentToUnassign(null)}
        onSuccess={() => {
          fetchShipments();
          setShipmentToUnassign(null);
          onRefreshTrips?.();
        }}
      />

      <BulkAssignmentModal
        isOpen={isBulkModalOpen}
        trip={data}
        onClose={() => setBulkModalOpen(false)}
        onSuccess={() => {
          setBulkModalOpen(false);
          fetchShipments();
          onRefreshTrips?.();
        }}
        isDark={isDark}
      />
    </>
  );
}

function TabButton({ isActive, onClick, icon, label, theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-2 uppercase tracking-wide ${
        isActive ? theme.tabActive : theme.tabIdle
      }`}
    >
      <FontAwesomeIcon icon={icon} />
      {label}
    </button>
  );
}
