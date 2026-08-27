"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruck,
  faClipboardList,
  faWrench,
  faUnlock,
  faTimes,
  faSync,
  faQrcode,
} from "@fortawesome/free-solid-svg-icons";

import TripTimelineTab from "./TripTimelineTab";
import TripManifestTab from "./TripManifestTab";
import TripToolsTab from "./TripToolsTab";
import TripDrawerFooter from "./TripDrawerFooter";
import StatusBadge from "../ui/StatusBadge";
import ManifestStatusBadge from "../ui/ManifestStatusBadge";
import DrawerTabButton from "../ui/DrawerTabButton";
import UnassignShipmentModal from "./modals/UnassignShipmentModal";
import BulkAssignmentModal from "./modals/BulkAssignmentModal";
import ViewPackagesModal from "../shipments/Packages/ViewPackagesModal";
import ScanFoundPackageModal from "./modals/ScanFoundPackageModal";
import ShipmentScanActionModal from "../shipments/ShipmentScanner/ShipmentScanActionModal";
import InvoiceDetailsModal from "../invoice/InvoiceDetailsModal";
import InvoiceFormModal from "../invoice/InvoiceFormModal";
import useInvoiceWorkflow from "../invoice/useInvoiceWorkflow";
import { updateShipmentPackages } from "@/app/utility/FirebaseFunctions";
import { getDrawerThemeClasses } from "@/app/utility/constant/theme";
import { isManifestEditable } from "@/app/utility/manifestStatus";
import { updatedBy } from "@/app/utility/utilities";
import { isCompletedTrip } from "./tripHelpers";

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
  const [removedManifestEntries, setRemovedManifestEntries] = useState([]);
  const [loadingShips, setLoadingShips] = useState(false);
  const [manifestTripId, setManifestTripId] = useState(null);
  const fetchInFlightRef = useRef(null);
  const [shipmentToUnassign, setShipmentToUnassign] = useState(null);
  const [selectedShipmentForModal, setSelectedShipmentForModal] =
    useState(null);
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const [isScanModalOpen, setScanModalOpen] = useState(false);
  const [isFoundScanOpen, setFoundScanOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const theme = getDrawerThemeClasses(isDark);

  const fetchShipments = useCallback(
    async ({ force = false } = {}) => {
      if (!data?.tripId || !user) return [];

      if (!force && manifestTripId === data.tripId) {
        return [];
      }

      if (fetchInFlightRef.current) {
        return fetchInFlightRef.current;
      }

      setLoadingShips(true);

      const request = (async () => {
        try {
          const token = await user.getIdToken();

          const res = await fetch(
            `/api/manifests/trip-shipments?tripId=${encodeURIComponent(data.tripId)}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              cache: "no-store",
            },
          );

          if (!res.ok) {
            const message = await res
              .json()
              .then((json) => json.error || `Request failed (${res.status})`)
              .catch(() => `Request failed (${res.status})`);
            throw new Error(message);
          }

          const json = await res.json();
          const list = json.shipments || [];
          setShipments(list);
          setRemovedManifestEntries(
            Array.isArray(json.removedManifestEntries)
              ? json.removedManifestEntries
              : [],
          );
          setManifestTripId(data.tripId);
          return list;
        } catch (error) {
          console.error("Failed to load manifest:", error);
          return [];
        } finally {
          setLoadingShips(false);
          fetchInFlightRef.current = null;
        }
      })();

      fetchInFlightRef.current = request;
      return request;
    },
    [data?.tripId, manifestTripId, user],
  );

  const invoiceWorkflow = useInvoiceWorkflow({
    user,
    onRefresh: async () => {
      await fetchShipments({ force: true });
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
    submitError: invoiceSubmitError,
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
      setShipments([]);
      setRemovedManifestEntries([]);
      setManifestTripId(null);
      fetchInFlightRef.current = null;
    }
  }, [isOpen, data?.tripId]);

  useEffect(() => {
    if (!isOpen || !data?.tripId || activeTab !== "MANIFEST") return;
    if (manifestTripId === data.tripId) return;
    fetchShipments();
  }, [activeTab, data?.tripId, fetchShipments, isOpen, manifestTripId]);

  if (!data) return null;

  const completedTrip = isCompletedTrip(data);
  const manifestTabLabel = completedTrip
    ? `Manifests (${data.deliveryManifestId && data.manifestId ? 2 : data.manifestLocked || data.deliveryManifestId ? 1 : 0})`
    : manifestTripId === data.tripId
      ? `Manifest (${shipments.length})`
      : "Manifest";

  const handleOpenScan = async () => {
    await fetchShipments();
    setScanModalOpen(true);
  };

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

  const handleRefresh = async () => {
    if (!data?.tripId || refreshing) return;

    setRefreshing(true);
    try {
      const tasks = [onRefreshTrips?.()];
      if (manifestTripId === data.tripId || activeTab === "MANIFEST") {
        tasks.unshift(fetchShipments({ force: true }));
      }
      await Promise.all(tasks);
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
              <StatusBadge
                status={data.status === "UNLOADING" ? "ARRIVED" : data.status}
                isDark={isDark}
              />
              <ManifestStatusBadge trip={data} isDark={isDark} />
              <span
                className={`text-xs border-l pl-2 ml-1 ${theme.mutedText} ${theme.divider}`}
              >
                {data.route}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenScan}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
            >
              Scan
            </button>
            <button
              type="button"
              onClick={() => setFoundScanOpen(true)}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
              title="Recover a missing package found after reconciliation"
            >
              <FontAwesomeIcon icon={faQrcode} className="mr-1.5" />
              Found
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loadingShips}
              className={`p-2 rounded-lg transition-colors ${theme.closeButton}`}
              title="Refresh trip"
              aria-label="Refresh trip"
            >
              <FontAwesomeIcon
                icon={faSync}
                spin={refreshing || loadingShips}
                className="w-4 h-4"
              />
            </button>
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
          <DrawerTabButton
            isDark={isDark}
            theme={theme}
            isActive={activeTab === "TIMELINE"}
            onClick={() => setActiveTab("TIMELINE")}
            icon={faTruck}
            label="Status"
          />

          <DrawerTabButton
            isDark={isDark}
            theme={theme}
            isActive={activeTab === "MANIFEST"}
            onClick={() => setActiveTab("MANIFEST")}
            icon={faClipboardList}
            label={manifestTabLabel}
          />

          <DrawerTabButton
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
              shipments={shipments}
              onRefresh={() => onRefreshTrips?.()}
              isDark={isDark}
              user={user}
              profile={profile}
            />
          )}

          {activeTab === "MANIFEST" && (
            <TripManifestTab
              shipments={shipments}
              removedManifestEntries={removedManifestEntries}
              loading={loadingShips}
              isLocked={data.manifestLocked}
              manifestEditable={isManifestEditable(data)}
              onAddShipment={() => {
                setBulkModalOpen(true);
              }}
              onViewPackages={(shipment) =>
                setSelectedShipmentForModal(shipment)
              }
              onUnassign={(shipment) => setShipmentToUnassign(shipment)}
              tripId={data?.tripId}
              tripStatus={data?.status}
              tripReconciledAt={data?.reconciledAt}
              tripManifestStatus={data?.manifestStatus}
              tripType={data?.tripType}
              trip={data}
              onRefresh={() => {
                fetchShipments({ force: true });
                onRefreshTrips?.();
              }}
              isDark={isDark}
              onViewInvoice={handleViewInvoice}
              onCreateInvoice={openCreateInvoice}
              profile={profile}
              user={user}
            />
          )}

          {activeTab === "TOOLS" && (
            <TripToolsTab
              data={data}
              onRefresh={() => {
                fetchShipments({ force: true });
                onRefreshTrips?.();
              }}
              isDark={isDark}
              profile={profile}
              user={user}
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
        tripId={data?.id || data?.tripId || null}
        removedManifestEntries={removedManifestEntries}
        onClose={() => setSelectedShipmentForModal(null)}
        isLocked={data.manifestLocked}
        onRefresh={() => {
          fetchShipments({ force: true });
          onRefreshTrips?.();
        }}
        isDark={isDark}
        profile={profile}
        allowShipmentStatusOverride={false}
      />

      <UnassignShipmentModal
        isOpen={!!shipmentToUnassign}
        shipment={shipmentToUnassign}
        tripId={data?.id || data?.tripId}
        onClose={() => setShipmentToUnassign(null)}
        onSuccess={() => {
          fetchShipments({ force: true });
          setShipmentToUnassign(null);
          onRefreshTrips?.();
        }}
        isDark={isDark}
      />

      <BulkAssignmentModal
        isOpen={isBulkModalOpen}
        trip={data}
        onClose={() => setBulkModalOpen(false)}
        onSuccess={() => {
          setBulkModalOpen(false);
          fetchShipments({ force: true });
          onRefreshTrips?.();
        }}
        isDark={isDark}
      />

      <ScanFoundPackageModal
        isOpen={isFoundScanOpen}
        onClose={() => setFoundScanOpen(false)}
        tripId={data?.id || data?.tripId}
        tripPublicId={data?.tripId}
        isDark={isDark}
        onRefresh={() => {
          fetchShipments({ force: true });
          onRefreshTrips?.();
        }}
      />

      <ShipmentScanActionModal
        isOpen={isScanModalOpen}
        onClose={() => setScanModalOpen(false)}
        trip={data}
        manifestShipments={shipments}
        isDark={isDark}
        onResolveScan={resolveScannedLabel} // Just pass the function reference
        onConfirmOperation={confirmScanAction} // No extra async wrapper needed here
        onRefresh={() => {
          fetchShipments({ force: true });
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
        trips={data ? [data] : []}
        eligibleShipments={shipments}
        user={user}
        submissionError={invoiceSubmitError}
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
