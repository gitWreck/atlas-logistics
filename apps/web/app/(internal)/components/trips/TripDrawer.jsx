"use client";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruck,
  faClipboardList,
  faWrench,
  faUnlock,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";

import TripTimelineTab from "./TripTimelineTab";
import TripManifestTab from "./TripManifestTab";
import TripToolsTab from "./TripToolsTab";
import TripDrawerFooter from "./TripDrawerFooter";
import StatusBadge from "../ui/StatusBadge";
import UnassignShipmentModal from "./modals/UnassignShipmentModal";
import BulkAssignmentModal from "./modals/BulkAssignmentModal";
import ViewPackagesModal from "../shipments/Packages/ViewPackagesModal";
import ShipmentScanActionModal from "../shipments/ShipmentScanner/ShipmentScanActionModal";
import InvoiceDetailsModal from "../invoice/InvoiceDetailsModal";
import InvoiceFormModal from "../invoice/InvoiceFormModal";
import useInvoiceWorkflow from "../invoice/useInvoiceWorkflow";
import { updateShipmentPackages } from "@/app/utility/FirebaseFunctions";
import { getDrawerThemeClasses } from "@/app/utility/constant/theme";
import { updatedBy } from "@/app/utility/utilities";

export default function TripDrawer({
  isOpen,
  onClose,
  data,
  onRefreshTrips,
  isDark = false,
  user,
  profile,
}) {
  const [activeTab, setActiveTab] = useState("TIMELINE");
  const [shipments, setShipments] = useState([]);
  const [loadingShips, setLoadingShips] = useState(false);
  const [shipmentToUnassign, setShipmentToUnassign] = useState(null);
  const [selectedShipmentForModal, setSelectedShipmentForModal] =
    useState(null);
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const [isScanModalOpen, setScanModalOpen] = useState(false);

  const theme = getDrawerThemeClasses(isDark);

  const fetchShipments = async () => {
    if (!data?.tripId) return;

    setLoadingShips(true);

    try {
      const token = await user?.getIdToken();

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

  const invoiceWorkflow = useInvoiceWorkflow({
    user,
    onRefresh: async () => {
      await fetchShipments();
      onRefreshTrips?.();
    },
    onError: (message, error) => {
      alert(`${message}: ${error.message}`);
    },
  });

  const {
    isFormOpen: isInvoiceFormOpen,
    isDetailsOpen: isInvoiceDetailsOpen,
    isSaving: isInvoiceSaving,
    formMode: invoiceMode,
    selectedShipment: selectedInvoiceShipment,
    selectedInvoice,
    openCreateInvoice,
    openEditInvoice,
    openInvoiceDetailsById,
    closeForm: closeInvoiceForm,
    closeDetails: closeInvoiceDetails,
    submitInvoice,
    changeInvoiceStatus,
  } = invoiceWorkflow;

  useEffect(() => {
    if (isOpen && data?.tripId) {
      setActiveTab("TIMELINE");
      fetchShipments();
    }
  }, [isOpen, data?.tripId]);

  if (!data) return null;

  async function fetchScannerApi(endpoint, payload) {
    const token = await user?.getIdToken();

    const res = await fetch(`/api/shipments/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Failed to ${endpoint} scan`);

    return data;
  }

  const resolveScannedLabel = (payload) => fetchScannerApi("resolve", payload);
  // const confirmScanAction = (payload) => fetchScannerApi("confirm", payload);

  const confirmScanAction = async (payload) => {
    // Convert the array of {packageId, quantity} into a map the backend can read easily
    const quantityMap = {};
    payload.itemsToProcess.forEach((item) => {
      quantityMap[item.packageId] = item.quantity;
    });

    // Call your existing function
    await updateShipmentPackages({
      shipmentId: payload.shipmentId,
      tripId: payload.tripId || data?.tripId || data?.id,
      packageIds: Object.keys(quantityMap), // Array of strings: ["PKG-1", "PKG-2"]
      newStatus:
        payload.newStatus ||
        (payload.action === "LOAD" ? "LOADED" : "RECEIVED"),
      manualQty: quantityMap, // We pass the object dictionary instead of a single number
      scanAction: payload.action,
      updatedBy: updatedBy(profile),
    });
  };

  const handleViewInvoice = async (shipment) => {
    await openInvoiceDetailsById(shipment?.invoiceId, shipment);
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
        style={{ width: "min(100%, 1000px)" }}
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

          <div className="flex items-center gap-2 shrink-0">
            {/* New Modal Button */}
            <button
              type="button"
              onClick={() => setScanModalOpen(true)}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
            >
              Scan
            </button>
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${theme.mutedText} hover:bg-gray-500/10`}
              aria-label="Close drawer"
            >
              <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
            </button>
          </div>
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
              user={user}
              profile={profile}
            />
          )}

          {activeTab === "MANIFEST" && (
            <TripManifestTab
              shipments={shipments}
              loading={loadingShips}
              isLocked={data.manifestLocked}
              onAddShipment={() => {
                console.log("testtt");
                setBulkModalOpen(true);
              }}
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
              onViewInvoice={handleViewInvoice}
              onCreateInvoice={openCreateInvoice}
              profile={profile}
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
              profile={profile}
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
          user={user}
          profile={profile}
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
        tripId={data?.id || data?.tripId}
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

      <ShipmentScanActionModal
        isOpen={isScanModalOpen}
        onClose={() => setScanModalOpen(false)}
        trip={data}
        isDark={isDark}
        onResolveScan={resolveScannedLabel} // Just pass the function reference
        onConfirmOperation={confirmScanAction} // No extra async wrapper needed here
        onRefresh={() => {
          fetchShipments();
          onRefreshTrips?.();
        }}
        user={user}
        profile={profile}
      />

      <InvoiceFormModal
        isOpen={isInvoiceFormOpen}
        loading={isInvoiceSaving}
        mode={invoiceMode}
        shipment={selectedInvoiceShipment}
        invoice={selectedInvoice}
        eligibleShipments={shipments}
        user={user}
        onClose={closeInvoiceForm}
        onSubmit={submitInvoice}
        isDark={isDark}
      />

      <InvoiceDetailsModal
        isOpen={isInvoiceDetailsOpen}
        invoice={selectedInvoice}
        shipment={selectedInvoiceShipment}
        onClose={closeInvoiceDetails}
        onEdit={() => openEditInvoice(selectedInvoice, selectedInvoiceShipment)}
        onIssue={() => changeInvoiceStatus(selectedInvoice, "ISSUED")}
        onMarkPaid={() => changeInvoiceStatus(selectedInvoice, "PAID")}
        onCancel={() => changeInvoiceStatus(selectedInvoice, "CANCELLED")}
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
