import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruck,
  faClipboardList,
  faWrench,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";

// Sub-components
import TripTimelineTab from "./TripTimelineTab";
import TripManifestTab from "./TripManifestTab";
import TripToolsTab from "./TripToolsTab";
import TripDrawerFooter from "./TripDrawerFooter";
import StatusBadge from "../ui/StatusBadge";
import UnassignShipmentModal from "../manifests/modals/UnassignShipmentModal";
import BulkAssignmentModal from "../manifests/modals/BulkAssignmentModal";
import ViewPackagesModal from "../manifests/ViewPackagesModal/ViewPackagesModal";
import { unlockTripManifest } from "@/app/utility/FirebaseFunctions";

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

  // --- 1. DATA FETCHING ---
  const fetchShipments = async () => {
    if (!data?.tripId) return;
    setLoadingShips(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/manifests/trips/${data.tripId}/shipments`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = await res.json();
      setShipments(json.shipments || []);
    } catch (e) {
      console.error("Failed to load manifest:", e);
    } finally {
      setLoadingShips(false);
    }
  };

  // Fetch when drawer opens with a valid trip ID
  useEffect(() => {
    if (isOpen && data?.tripId) {
      setActiveTab("TIMELINE"); // Default tab
      fetchShipments();
    }
  }, [isOpen, data?.tripId]);

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
        style={{ width: "min(100%, 780px)" }}
        className={`
          fixed top-0 right-0 h-full
          z-50 shadow-2xl transform transition-transform duration-300 flex flex-col
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
                isDark ? "text-emerald-500" : "text-emerald-600"
              }`}
            >
              Active Trip Details
            </div>
            <h2
              className={`text-xl font-mono font-bold tracking-tight ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {data.tripId}
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
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
          {/* // Inside TripDrawer or ManifestTab */}
          {data?.isLocked && (
            <button
              onClick={async () => {
                const reason = prompt(
                  "Why are you unlocking this manifest? (Required for audit)",
                );
                if (!reason) return;

                await unlockTripManifest({ tripDocId: trip.id, reason });
                // Refresh logic...
              }}
              className="bg-amber-500 text-white px-4 py-2 rounded shadow hover:bg-amber-600"
            >
              <FontAwesomeIcon icon={faUnlock} /> Unlock Manifest
            </button>
          )}
        </div>

        {/* TABS */}
        <div
          className={`flex border-b ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-slate-50"}`}
        >
          <TabButton
            isDark={isDark}
            isActive={activeTab === "TIMELINE"}
            onClick={() => setActiveTab("TIMELINE")}
            icon={faTruck}
            label="Status"
          />
          <TabButton
            isDark={isDark}
            isActive={activeTab === "MANIFEST"}
            onClick={() => setActiveTab("MANIFEST")}
            icon={faClipboardList}
            label={`Manifest (${shipments.length})`}
          />
          <TabButton
            isDark={isDark}
            isActive={activeTab === "TOOLS"}
            onClick={() => setActiveTab("TOOLS")}
            icon={faWrench}
            label="Actions"
          />
        </div>

        {/* CONTENT AREA */}
        <div
          className={`flex-1 overflow-y-auto p-6 ${isDark ? "bg-slate-900" : "bg-white"}`}
        >
          {activeTab === "TIMELINE" && (
            <TripTimelineTab
              data={data}
              onRefresh={() => onRefreshTrips()}
              isDark={isDark}
            />
          )}

          {activeTab === "MANIFEST" && (
            <TripManifestTab
              shipments={shipments}
              loading={loadingShips}
              isLocked={data.manifestLocked}
              // onAddShipment={onAddShipment}
              onAddShipment={() => setBulkModalOpen(true)}
              onViewPackages={(shipment) =>
                setSelectedShipmentForModal(shipment)
              }
              onUnassign={(shipment) => setShipmentToUnassign(shipment)}
              tripId={data?.tripId}
              onRefresh={() => {
                fetchShipments();
                onRefreshTrips();
              }}
              isDark={isDark}
            />
          )}

          {activeTab === "TOOLS" && (
            <TripToolsTab
              data={data}
              onRefresh={() => {
                fetchShipments();
                onRefreshTrips();
              }}
              isDark={isDark}
            />
          )}
        </div>

        {/* FOOTER */}
        <TripDrawerFooter
          data={data}
          onClose={onClose}
          shipments={shipments}
          isDark={isDark}
          onSuccess={() => {
            // fetchShipments();
            onRefreshTrips();
          }}
        />
      </aside>

      {/* --- RENDER THE NEW MODAL OUTSIDE THE ASIDE --- */}
      <ViewPackagesModal
        isOpen={!!selectedShipmentForModal}
        shipment={selectedShipmentForModal}
        onClose={() => setSelectedShipmentForModal(null)}
        isLocked={data.manifestLocked}
        onRefresh={() => {
          fetchShipments();
          onRefreshTrips();
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
          onRefreshTrips();
        }}
      />
      <BulkAssignmentModal
        isOpen={isBulkModalOpen}
        trip={data}
        onClose={() => setBulkModalOpen(false)}
        onSuccess={() => {
          setBulkModalOpen(false);
          fetchShipments();
          onRefreshTrips();
        }}
        isDark={isDark}
      />
    </>
  );
}

// Simple internal helper for tabs
function TabButton({ isActive, onClick, icon, label, isDark = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-2 uppercase tracking-wide ${
        isActive
          ? isDark
            ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
            : "border-emerald-500 text-emerald-600 bg-emerald-50"
          : isDark
            ? "border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
            : "border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-100"
      }`}
    >
      <FontAwesomeIcon icon={icon} /> {label}
    </button>
  );
}
