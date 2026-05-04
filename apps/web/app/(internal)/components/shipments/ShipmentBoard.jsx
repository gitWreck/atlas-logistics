"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faSync,
  faFilter,
  faChevronLeft,
  faChevronRight,
  faExclamationCircle,
} from "@fortawesome/free-solid-svg-icons";
import ShipmentRow from "./ShipmentRow";
import ShipmentDrawer from "./ShipmentDrawer";
import { calculateProgress } from "@/app/utility/utilities";
import { getBoardThemeClasses } from "@/app/utility/constant/theme";
import NewShipmentModal from "./modals/NewShipmentModal";
// import UnifiedShipmentModal from "./modals/UnifiedShipmentModal";

const ShipmentBoard = forwardRef(function ShipmentBoard(
  { user, profile, isDark = false },
  ref,
) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState(null);

  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("ALL");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [delayType, setDelayType] = useState("ALL");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const theme = getBoardThemeClasses(isDark);

  const fetchShipments = async () => {
    try {
      setLoading(true);

      if (!user) {
        console.error("User is not logged in yet.");
        return;
      }

      const token = await user.getIdToken();

      const res = await fetch("/api/shipments", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || errorData.error || "Server Error");
      }

      const data = await res.json();

      const formatted = (data.shipments || []).map((shipment) => ({
        ...shipment,
        progress: calculateProgress(shipment.status),
      }));

      setShipments(formatted);
    } catch (err) {
      console.error("FULL ERROR:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  const filteredShipments = useMemo(() => {
    return shipments.filter((shipment) => {
      const searchContent = [
        shipment.shipmentId,
        shipment.sender?.name,
        shipment.recipient?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchContent.includes(searchQuery.toLowerCase())) return false;

      if (startDate || endDate) {
        const shipmentDate = shipment.createdAt?._seconds
          ? new Date(shipment.createdAt._seconds * 1000)
          : new Date(shipment.createdAt);

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (shipmentDate < start) return false;
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (shipmentDate > end) return false;
        }
      }

      if (activeFilter !== "ALL") {
        if (activeFilter === "ACTIVE" && shipment.status === "DELIVERED") {
          return false;
        }

        if (activeFilter === "DELAYED") {
          if (shipment.status !== "DELAYED") return false;
          if (delayType !== "ALL" && shipment.delayReason !== delayType) {
            return false;
          }
        } else if (activeFilter !== "ACTIVE") {
          if (shipment.status !== activeFilter) return false;
        }
      }

      if (modeFilter !== "ALL") {
        const isPickup =
          shipment.status === "PENDING_PICKUP" ||
          shipment.status === "PICKED_UP" ||
          (shipment.statusHistory &&
            shipment.statusHistory.some((history) =>
              history.status.includes("PICKUP"),
            ));

        if (modeFilter === "PICKUP" && !isPickup) return false;
        if (modeFilter === "DROP_OFF" && isPickup) return false;
      }

      return true;
    });
  }, [
    shipments,
    searchQuery,
    startDate,
    endDate,
    activeFilter,
    modeFilter,
    delayType,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate, activeFilter, modeFilter, delayType]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredShipments.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  const totalPages = Math.ceil(filteredShipments.length / itemsPerPage);

  const uniqueDelayReasons = useMemo(() => {
    const reasons = new Set(
      shipments
        .filter(
          (shipment) => shipment.status === "DELAYED" && shipment.delayReason,
        )
        .map((shipment) => shipment.delayReason),
    );

    return Array.from(reasons);
  }, [shipments]);

  const selectedShipment = shipments.find(
    (shipment) => shipment.id === selectedShipmentId,
  );

  const handleMessageCustomer = (shipment) => {
    const phone = shipment.sender?.phone || shipment.recipient?.phone;
    alert(`Logic to SMS ${phone} for Order ${shipment.shipmentId}`);
  };

  useImperativeHandle(
    ref,
    () => ({
      openCreateModal: () => setIsNewOrderModalOpen(true),
    }),
    [],
  );

  return (
    <div className={`font-sans ${theme.page}`}>
      <main className="mx-auto p-4 sm:p-6">
        <div
          className={`border rounded-xl overflow-hidden shadow-xl backdrop-blur-sm ${theme.board}`}
        >
          {/* Header */}
          <div
            className={`px-4 sm:px-6 py-4 border-b flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 ${theme.header}`}
          >
            <h3
              className={`font-bold whitespace-nowrap hidden xl:flex items-center gap-2 ${theme.title}`}
            >
              Recent Orders
              <button
                type="button"
                onClick={fetchShipments}
                disabled={loading}
                className={`transition-colors p-1 rounded ${theme.refreshButton}`}
                title="Refresh"
              >
                <FontAwesomeIcon
                  icon={faSync}
                  spin={loading}
                  className="text-xs"
                />
              </button>
            </h3>

            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full xl:w-auto">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <FontAwesomeIcon
                  icon={faSearch}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.iconMuted}`}
                />
                <input
                  type="text"
                  placeholder="Search Tracking..."
                  className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none ${theme.input}`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                {/* Date filters */}
                <div
                  className={`flex items-center gap-2 border rounded-lg px-2 py-1 flex-1 sm:flex-none justify-center ${theme.filterWrap}`}
                >
                  <input
                    type="date"
                    className={`bg-transparent text-xs outline-none w-24 ${theme.dateInput}`}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className={theme.iconMuted}>-</span>
                  <input
                    type="date"
                    className={`bg-transparent text-xs outline-none w-24 ${theme.dateInput}`}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                {/* Main filter */}
                <div className="relative w-full sm:w-36">
                  <FontAwesomeIcon
                    icon={faFilter}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.iconMuted}`}
                  />
                  <select
                    className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none appearance-none cursor-pointer ${theme.input}`}
                    value={activeFilter}
                    onChange={(e) => {
                      setActiveFilter(e.target.value);
                      setDelayType("ALL");
                    }}
                  >
                    <option value="ALL">All View</option>
                    <option value="CREATED">Created</option>
                    <option value="PENDING_PICKUP">Pending Pickup</option>
                    <option value="PICKED_UP">Picked up</option>
                    <option value="RECEIVED">Received</option>
                    <option value="ASSIGNED">Assigned</option>
                    <option value="IN_TRANSIT">In Transit</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="DELAYED">Delayed</option>
                  </select>
                </div>
              </div>

              {/* Delayed reason filter */}
              {activeFilter === "DELAYED" && (
                <div className="relative w-full sm:w-40 animate-in fade-in slide-in-from-right-2 duration-300">
                  <FontAwesomeIcon
                    icon={faExclamationCircle}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.warningIcon}`}
                  />
                  <select
                    className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-amber-500 focus:outline-none appearance-none cursor-pointer ${theme.warningFilter}`}
                    value={delayType}
                    onChange={(e) => setDelayType(e.target.value)}
                  >
                    <option value="ALL">All Reasons</option>
                    {uniqueDelayReasons.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="md:overflow-x-auto">
            <div className="md:min-w-[900px]">
              <div
                className={`hidden md:grid grid-cols-13 gap-4 px-6 py-3 border-b text-xs font-semibold uppercase tracking-wider ${theme.tableHead}`}
              >
                <div className="col-span-4">Tracking / Customer</div>
                <div className="col-span-2">Route</div>
                <div className="col-span-2">Details</div>
                <div className="col-span-3">Progress</div>
                <div className="col-span-1">Update</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              <div className="min-h-[300px]">
                {loading ? (
                  <div
                    className={`p-10 text-center animate-pulse ${theme.emptyText}`}
                  >
                    Loading orders...
                  </div>
                ) : filteredShipments.length === 0 ? (
                  <div className={`p-10 text-center ${theme.emptyText}`}>
                    No orders found matching filters.
                  </div>
                ) : (
                  currentItems.map((shipment) => (
                    <ShipmentRow
                      shipmentBoard={true}
                      key={shipment.id}
                      s={shipment}
                      onClick={setSelectedShipmentId}
                      onMessage={() => handleMessageCustomer(shipment)}
                      isDark={isDark}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Pagination */}
          {filteredShipments.length > 0 && (
            <div
              className={`px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row justify-between items-center gap-3 text-xs ${theme.footer}`}
            >
              <span className={theme.footerText}>
                Showing{" "}
                <span className={`font-bold ${theme.footerStrong}`}>
                  {indexOfFirstItem + 1}
                </span>{" "}
                of {filteredShipments.length}
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <ShipmentDrawer
        isOpen={!!selectedShipmentId}
        onClose={() => setSelectedShipmentId(null)}
        data={selectedShipment}
        isDark={isDark}
        onRefresh={fetchShipments}
      />

      <NewShipmentModal
        profile={profile}
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        isDark={isDark}
        user={user}
        onSuccess={() => {
          fetchShipments();
        }}
        resetTrigger={isNewOrderModalOpen}
      />

      {/* <UnifiedShipmentModal
        profile={profile}
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        isDark={isDark}
        user={user}
        onSuccess={() => {
          fetchShipments();
        }}
        resetTrigger={isNewOrderModalOpen}
      /> */}
    </div>
  );
});

export default ShipmentBoard;
