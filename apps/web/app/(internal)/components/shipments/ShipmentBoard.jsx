"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faSync,
  faFilter,
  faExclamationCircle,
  faList,
  faTruck,
  faTruckPickup,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";
import ShipmentRow from "./ShipmentRow";
import ShipmentDrawer from "./ShipmentDrawer";
import { calculateProgress } from "@/app/utility/utilities";
import { calculateShipmentProgress } from "@/app/utility/shipmentProgress";
import {
  shipmentMatchesDivisoriaHub,
  shipmentMatchesOdionganHub,
  resolveShipmentPackageBreakdown,
} from "@/app/utility/packageStatus";
import { getBoardThemeClasses } from "@/app/utility/constant/theme";
import UnifiedShipmentModal from "./modals/UnifiedShipmentModal";
import PickupRequestsTable from "./PickupRequestsTable";
import TablePaginationFooter from "../ui/TablePaginationFooter";
import ReconcileAtHubModal from "./modals/ReconcileAtHubModal";
import ReceiveReturnedModal from "./modals/ReceiveReturnedModal";
import ReleaseToCheckerModal from "./modals/ReleaseToCheckerModal";
import BoardTabs from "../ui/BoardTabs";
import DeliveryCheckerTabs from "./DeliveryCheckerTabs";
import {
  ALL_CHECKERS_TAB,
  buildDeliveryCheckerTabs,
  findDeliveryCheckerTab,
  shipmentHasCheckerPieces,
} from "@/app/utility/deliveryOperationsCheckers";

const SHIPMENT_BOARD_TABS = {
  ALL: "all",
  DELIVERY: "delivery",
  DIVISORIA: "divisoria",
  ODIONGAN: "odiongan",
  PICKUPS: "pickups",
};

const DELIVERY_OPERATION_STATUSES = new Set([
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
]);

const DELIVERY_OPERATION_EXTENDED_STATUSES = new Set([
  ...DELIVERY_OPERATION_STATUSES,
  "PARTIALLY_OUT_FOR_DELIVERY",
  "PARTIALLY_DELIVERED",
  "FAILED_DELIVERY",
]);

function getShipmentStatus(shipment) {
  return String(shipment?.status || "").toUpperCase();
}

function isPickupShipment(shipment) {
  const status = getShipmentStatus(shipment);

  return (
    shipment?.isPickupRequested === true ||
    status === "PENDING_PICKUP" ||
    status === "PICKED_UP" ||
    shipment?.statusHistory?.some((history) =>
      String(history?.status || "")
        .toUpperCase()
        .includes("PICKUP"),
    )
  );
}

function matchesWarehouseTab(shipment, warehouseKey) {
  if (warehouseKey === SHIPMENT_BOARD_TABS.DIVISORIA) {
    return shipmentMatchesDivisoriaHub(shipment);
  }

  if (warehouseKey === SHIPMENT_BOARD_TABS.ODIONGAN) {
    return shipmentMatchesOdionganHub(shipment);
  }

  return true;
}

function matchesShipmentBoardTab(shipment, activeBoardTab) {
  const status = getShipmentStatus(shipment);

  if (activeBoardTab === SHIPMENT_BOARD_TABS.DELIVERY) {
    return DELIVERY_OPERATION_STATUSES.has(status);
  }

  if (
    activeBoardTab === SHIPMENT_BOARD_TABS.DIVISORIA ||
    activeBoardTab === SHIPMENT_BOARD_TABS.ODIONGAN
  ) {
    return matchesWarehouseTab(shipment, activeBoardTab);
  }

  return true;
}

function shipmentMatchesDeliveryCheckerPool(shipment) {
  const status = getShipmentStatus(shipment);

  if (DELIVERY_OPERATION_EXTENDED_STATUSES.has(status)) {
    return true;
  }

  if (
    Array.isArray(shipment.activeCheckerIds) &&
    shipment.activeCheckerIds.length > 0
  ) {
    return true;
  }

  const breakdown = resolveShipmentPackageBreakdown(shipment);
  if (
    Number(breakdown.outForDelivery || 0) +
      Number(breakdown.onCheckerVan || 0) >
    0
  ) {
    return true;
  }

  return shipmentHasCheckerPieces(shipment);
}

const ShipmentBoard = forwardRef(function ShipmentBoard(
  { user, profile, isDark = false },
  ref,
) {
  const [shipments, setShipments] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [isReceiveReturnedModalOpen, setIsReceiveReturnedModalOpen] =
    useState(false);
  const [isReleaseToCheckerModalOpen, setIsReleaseToCheckerModalOpen] =
    useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState(null);
  const [editingPickup, setEditingPickup] = useState(null);

  const [activeBoardTab, setActiveBoardTab] = useState(SHIPMENT_BOARD_TABS.ALL);
  const [activeDeliveryChecker, setActiveDeliveryChecker] =
    useState(ALL_CHECKERS_TAB);
  const [checkerNameById, setCheckerNameById] = useState({});
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [shipmentLimit, setShipmentLimit] = useState("50");
  const [pickupLimit, setPickupLimit] = useState("50");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [delayType, setDelayType] = useState("ALL");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const theme = getBoardThemeClasses(isDark);

  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);

      if (!user) {
        console.error("User is not logged in yet.");
        return;
      }

      const token = await user.getIdToken();

      const requestOptions = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      };

      const shipmentsUrl =
        shipmentLimit === "50"
          ? "/api/shipments"
          : `/api/shipments?limit=${shipmentLimit}`;
      const pickupsUrl =
        pickupLimit === "50"
          ? "/api/shipments/pickups"
          : `/api/shipments/pickups?limit=${pickupLimit}`;

      const [shipmentsRes, pickupsRes] = await Promise.all([
        fetch(shipmentsUrl, requestOptions),
        fetch(pickupsUrl, requestOptions),
      ]);

      if (!shipmentsRes.ok) {
        const errorData = await shipmentsRes.json();
        throw new Error(errorData.details || errorData.error || "Server Error");
      }

      if (!pickupsRes.ok) {
        const errorData = await pickupsRes.json();
        throw new Error(errorData.details || errorData.error || "Server Error");
      }

      const [shipmentsData, pickupsData] = await Promise.all([
        shipmentsRes.json(),
        pickupsRes.json(),
      ]);

      const formattedShipments = (shipmentsData.shipments || []).map(
        (shipment) => ({
          ...shipment,
          progress: calculateShipmentProgress(shipment),
        }),
      );

      const formattedPickups = (pickupsData.pickups || []).map((pickup) => ({
        ...pickup,
        progress: calculateProgress(pickup.status),
      }));

      setShipments(formattedShipments);
      setPickups(formattedPickups);
    } catch (err) {
      console.error("FULL ERROR:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [pickupLimit, shipmentLimit, user]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  useEffect(() => {
    if (activeBoardTab !== SHIPMENT_BOARD_TABS.DELIVERY || !user) return;

    let cancelled = false;

    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/checkers/active", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;

        const data = await res.json();
        const map = {};
        (data.checkers || []).forEach((checker) => {
          if (checker?.id) {
            map[checker.id] = checker.name || checker.id;
          }
        });
        setCheckerNameById(map);
      } catch (err) {
        console.warn("Checker directory unavailable:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeBoardTab, user]);

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
        const isPickup = isPickupShipment(shipment);

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

  const deliveryTabShipments = useMemo(
    () =>
      filteredShipments.filter((shipment) =>
        shipmentMatchesDeliveryCheckerPool(shipment),
      ),
    [filteredShipments],
  );

  const deliveryCheckerTabs = useMemo(
    () => buildDeliveryCheckerTabs(deliveryTabShipments, checkerNameById),
    [checkerNameById, deliveryTabShipments],
  );

  const visibleShipments = useMemo(() => {
    if (activeBoardTab === SHIPMENT_BOARD_TABS.DELIVERY) {
      let result = filteredShipments.filter((shipment) =>
        shipmentMatchesDeliveryCheckerPool(shipment),
      );

      if (activeDeliveryChecker !== ALL_CHECKERS_TAB) {
        const checkerTab = findDeliveryCheckerTab(
          deliveryCheckerTabs,
          activeDeliveryChecker,
        );
        result = result.filter((shipment) =>
          shipmentHasCheckerPieces(
            shipment,
            activeDeliveryChecker,
            checkerTab,
            checkerNameById,
          ),
        );
      }

      return result;
    }

    return filteredShipments.filter((shipment) =>
      matchesShipmentBoardTab(shipment, activeBoardTab),
    );
  }, [
    activeBoardTab,
    activeDeliveryChecker,
    checkerNameById,
    deliveryCheckerTabs,
    filteredShipments,
  ]);

  const boardTabs = useMemo(
    () => [
      {
        key: SHIPMENT_BOARD_TABS.ALL,
        label: "All Shipments",
        icon: faList,
        count: filteredShipments.length,
      },
      {
        key: SHIPMENT_BOARD_TABS.DIVISORIA,
        label: "Divisoria",
        icon: faWarehouse,
        count: filteredShipments.filter((shipment) =>
          matchesWarehouseTab(shipment, SHIPMENT_BOARD_TABS.DIVISORIA),
        ).length,
      },
      {
        key: SHIPMENT_BOARD_TABS.ODIONGAN,
        label: "Odiongan",
        icon: faWarehouse,
        count: filteredShipments.filter((shipment) =>
          matchesWarehouseTab(shipment, SHIPMENT_BOARD_TABS.ODIONGAN),
        ).length,
      },
      {
        key: SHIPMENT_BOARD_TABS.DELIVERY,
        label: "Delivery Operations",
        icon: faTruck,
        count: filteredShipments.filter((shipment) =>
          DELIVERY_OPERATION_STATUSES.has(getShipmentStatus(shipment)),
        ).length,
      },
      {
        key: SHIPMENT_BOARD_TABS.PICKUPS,
        label: "Pickups",
        icon: faTruckPickup,
        count: pickups.length,
      },
    ],
    [filteredShipments, pickups.length],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeBoardTab,
    activeDeliveryChecker,
    searchQuery,
    startDate,
    endDate,
    activeFilter,
    modeFilter,
    delayType,
    shipmentLimit,
  ]);

  useEffect(() => {
    if (activeBoardTab !== SHIPMENT_BOARD_TABS.DELIVERY) {
      setActiveDeliveryChecker(ALL_CHECKERS_TAB);
      return;
    }

    const hasActiveTab = deliveryCheckerTabs.some(
      (tab) => tab.key === activeDeliveryChecker,
    );
    if (!hasActiveTab) {
      setActiveDeliveryChecker(ALL_CHECKERS_TAB);
    }
  }, [activeBoardTab, activeDeliveryChecker, deliveryCheckerTabs]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = visibleShipments.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  const totalPages = Math.max(
    1,
    Math.ceil(visibleShipments.length / itemsPerPage),
  );

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

  const selectedShipment = [...shipments, ...pickups].find(
    (shipment) => shipment.id === selectedShipmentId,
  );
  const canManageWarehouse = ["manager", "admin"].includes(
    String(profile?.role || "").toLowerCase(),
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
        <BoardTabs
          tabs={boardTabs}
          activeTab={activeBoardTab}
          onChange={setActiveBoardTab}
          isDark={isDark}
          className="sticky top-0 z-30"
        />

        {activeBoardTab === SHIPMENT_BOARD_TABS.PICKUPS ? (
          <div className="mt-6">
            <PickupRequestsTable
              pickups={pickups}
              loading={loading}
              isDark={isDark}
              profile={profile}
              pickupLimit={pickupLimit}
              onPickupLimitChange={setPickupLimit}
              onSelectPickup={setSelectedShipmentId}
              onDeleted={fetchShipments}
              onEditPickup={(pickup) => {
                setEditingPickup(pickup);
                setIsNewOrderModalOpen(true);
              }}
            />
          </div>
        ) : (
          <>
            {activeBoardTab === SHIPMENT_BOARD_TABS.DELIVERY && (
              <DeliveryCheckerTabs
                tabs={deliveryCheckerTabs}
                activeTab={activeDeliveryChecker}
                onChange={setActiveDeliveryChecker}
                isDark={isDark}
              />
            )}

            <div
              className={`mt-6 border rounded-xl overflow-hidden shadow-xl backdrop-blur-sm ${theme.board}`}
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
                      <option value="READY_FOR_DELIVERY">
                        Ready for Delivery
                      </option>
                      <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
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
                  ) : visibleShipments.length === 0 ? (
                    <div className={`p-10 text-center ${theme.emptyText}`}>
                      No orders found matching filters.
                    </div>
                  ) : (
                    currentItems.map((shipment) => (
                      <ShipmentRow
                        shipmentBoard={true}
                        warehouseTab={
                          activeBoardTab === SHIPMENT_BOARD_TABS.ODIONGAN
                            ? "odiongan"
                            : null
                        }
                        key={shipment.id}
                        s={shipment}
                        onClick={setSelectedShipmentId}
                        onDeleted={fetchShipments}
                        profile={profile}
                        onMessage={() => handleMessageCustomer(shipment)}
                        isDark={isDark}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Pagination */}
            {visibleShipments.length > 0 && (
              <TablePaginationFooter
                totalItems={visibleShipments.length}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalPages={totalPages}
                limitValue={shipmentLimit}
                limitTitle="Limit orders"
                onLimitChange={setShipmentLimit}
                onPrevious={() =>
                  setCurrentPage((prev) => Math.max(prev - 1, 1))
                }
                onNext={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                theme={theme}
              />
            )}
          </div>
          </>
        )}
      </main>

      <ShipmentDrawer
        isOpen={!!selectedShipmentId}
        onClose={() => setSelectedShipmentId(null)}
        data={selectedShipment}
        isDark={isDark}
        onRefresh={fetchShipments}
        profile={profile}
        onReconcile={() => setIsReconcileModalOpen(true)}
        onReceiveReturned={() => setIsReceiveReturnedModalOpen(true)}
        onReleaseToCheckers={() => setIsReleaseToCheckerModalOpen(true)}
        canManageWarehouse={canManageWarehouse}
      />

      {/* <NewShipmentModal
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

      <UnifiedShipmentModal
        profile={profile}
        isOpen={isNewOrderModalOpen}
        onClose={() => {
          setIsNewOrderModalOpen(false);
          setEditingPickup(null);
        }}
        isDark={isDark}
        user={user}
        onSuccess={() => {
          fetchShipments();
          setEditingPickup(null);
        }}
        resetTrigger={isNewOrderModalOpen}
        editData={editingPickup}
      />

      <ReconcileAtHubModal
        isOpen={isReconcileModalOpen}
        onClose={() => setIsReconcileModalOpen(false)}
        onSuccess={fetchShipments}
        isDark={isDark}
        shipment={selectedShipment}
      />

      <ReceiveReturnedModal
        isOpen={isReceiveReturnedModalOpen}
        onClose={() => setIsReceiveReturnedModalOpen(false)}
        onSuccess={fetchShipments}
        isDark={isDark}
        shipment={selectedShipment}
      />

      <ReleaseToCheckerModal
        isOpen={isReleaseToCheckerModalOpen}
        onClose={() => setIsReleaseToCheckerModalOpen(false)}
        onSuccess={fetchShipments}
        isDark={isDark}
        user={user}
        defaultShipmentIds={
          selectedShipment?.id ? [selectedShipment.id] : []
        }
        defaultShipments={selectedShipment ? [selectedShipment] : []}
      />
    </div>
  );
});

export default ShipmentBoard;
