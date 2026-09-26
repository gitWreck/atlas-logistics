"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
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
  faMapMarkedAlt,
} from "@fortawesome/free-solid-svg-icons";
import ShipmentRow from "./ShipmentRow";
import ShipmentDrawer from "./ShipmentDrawer";
import { calculateShipmentProgress } from "@/app/utility/shipmentProgress";
import { formatShipmentForBoard } from "@/app/utility/shipmentBoardFormatter";
import {
  shipmentMatchesDivisoriaHub,
  shipmentMatchesOdionganHub,
} from "@/app/utility/packageStatus";
import { getBoardThemeClasses } from "@/app/utility/constant/theme";
import { canAssignDeliveryRoutes } from "@/app/utility/deliveryRoutePermissions";
import UnifiedShipmentModal from "./modals/UnifiedShipmentModal";
import PickupRequestsTable from "./PickupRequestsTable";
import TablePaginationFooter from "../ui/TablePaginationFooter";
import ReconcileAtHubModal from "./modals/ReconcileAtHubModal";
import ReceiveReturnedModal from "./modals/ReceiveReturnedModal";
import ReleaseToCheckerModal from "./modals/ReleaseToCheckerModal";
import AssignCheckerMunicipalitiesModal from "./modals/AssignCheckerMunicipalitiesModal";
import BoardTabs from "../ui/BoardTabs";
import DeliveryCheckerTabs from "./DeliveryCheckerTabs";
import DeliveryCheckerSummaryCards from "./DeliveryCheckerSummaryCards";
import {
  ALL_CHECKERS_TAB,
  aggregateCheckerDeliveryStats,
  buildDeliveryCheckerTabs,
  findDeliveryCheckerTab,
  shipmentHasCheckerPieces,
  shipmentMatchesDeliveryCheckerPool,
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

const PICKUP_PHASE_STATUSES = new Set(["PENDING_PICKUP", "PICKED_UP"]);

function getShipmentStatus(shipment) {
  return String(shipment?.status || "").toUpperCase();
}

function isPickupShipment(shipment) {
  return PICKUP_PHASE_STATUSES.has(getShipmentStatus(shipment));
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

const SHIPMENT_TRACKING_PATTERN = /^AT-\d{8}-SHP-[A-Z0-9-]+(?:-\d{2})?$/i;

function mergeShipmentsById(primary = [], supplemental = []) {
  const merged = new Map();

  primary.forEach((shipment) => {
    merged.set(shipment.id, shipment);
  });

  supplemental.forEach((shipment) => {
    const existing = merged.get(shipment.id);
    merged.set(
      shipment.id,
      existing
        ? {
            ...existing,
            ...shipment,
            progress:
              shipment.progress ?? existing.progress ?? calculateShipmentProgress(shipment),
          }
        : shipment,
    );
  });

  return [...merged.values()].sort((a, b) => {
    const aMs = Date.parse(a.createdAtIso || a.updatedAtIso || "") || 0;
    const bMs = Date.parse(b.createdAtIso || b.updatedAtIso || "") || 0;
    return bMs - aMs;
  });
}

function sameShipment(left = {}, right = {}) {
  const leftIds = [left.id, left.shipmentId].filter(Boolean).map(String);
  const rightIds = [right.id, right.shipmentId].filter(Boolean).map(String);
  return leftIds.some((id) => rightIds.includes(id));
}

function hydrateBoardShipment(shipment = {}) {
  return formatShipmentForBoard(shipment);
}

function patchShipmentList(
  list = [],
  updatedShipment = null,
  { include = true } = {},
) {
  if (!updatedShipment?.id && !updatedShipment?.shipmentId) return list;

  let changed = false;
  const next = list.reduce((items, shipment) => {
    if (!sameShipment(shipment, updatedShipment)) {
      items.push(shipment);
      return items;
    }

    changed = true;
    if (!include) return items;

    items.push(hydrateBoardShipment({
      ...shipment,
      ...updatedShipment,
    }));
    return items;
  }, []);

  if (changed) return next;
  return include ? [hydrateBoardShipment(updatedShipment), ...list] : list;
}

const ShipmentBoard = forwardRef(function ShipmentBoard(
  { user, profile, isDark = false },
  ref,
) {
  const [coreShipments, setCoreShipments] = useState([]);
  const [deliveryShipments, setDeliveryShipments] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [lookupShipment, setLookupShipment] = useState(null);
  const coreFetchSequenceRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [loadingDelivery, setLoadingDelivery] = useState(false);
  const [deliveryOpsLoaded, setDeliveryOpsLoaded] = useState(false);

  const shipments = useMemo(
    () => mergeShipmentsById(coreShipments, deliveryShipments),
    [coreShipments, deliveryShipments],
  );

  const shipmentsWithPickups = useMemo(
    () =>
      mergeShipmentsById(
        mergeShipmentsById(shipments, pickups),
        lookupShipment ? [lookupShipment] : [],
      ),
    [lookupShipment, pickups, shipments],
  );

  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [isReceiveReturnedModalOpen, setIsReceiveReturnedModalOpen] =
    useState(false);
  const [isReleaseToCheckerModalOpen, setIsReleaseToCheckerModalOpen] =
    useState(false);
  const [isAssignCheckerMunicipalitiesOpen, setIsAssignCheckerMunicipalitiesOpen] =
    useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState(null);
  const [editingPickup, setEditingPickup] = useState(null);

  const [activeBoardTab, setActiveBoardTab] = useState(SHIPMENT_BOARD_TABS.ALL);
  const [activeDeliveryChecker, setActiveDeliveryChecker] =
    useState(ALL_CHECKERS_TAB);
  const [checkerDirectory, setCheckerDirectory] = useState({});
  const [assignMunicipalitiesCheckerId, setAssignMunicipalitiesCheckerId] =
    useState("");
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

  const checkerNameById = useMemo(() => {
    return Object.fromEntries(
      Object.entries(checkerDirectory).map(([id, checker]) => [
        id,
        checker.name || id,
      ]),
    );
  }, [checkerDirectory]);

  const fetchCheckerDirectory = useCallback(async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/checkers/active", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return;

      const data = await res.json();
      const directory = {};
      (data.checkers || []).forEach((checker) => {
        if (!checker?.id) return;
        directory[checker.id] = {
          id: checker.id,
          name: checker.name || checker.id,
          email: checker.email || "",
          warehouseName: checker.warehouseName || "",
          warehouseCode: checker.warehouseCode || "",
          assignedMunicipalities: Array.isArray(checker.assignedMunicipalities)
            ? checker.assignedMunicipalities
            : [],
        };
      });
      setCheckerDirectory(directory);
    } catch (err) {
      console.warn("Checker directory unavailable:", err);
    }
  }, [user]);

  const fetchCoreBoardData = useCallback(async () => {
    if (!user) {
      console.error("User is not logged in yet.");
      return;
    }

    const requestSequence = ++coreFetchSequenceRef.current;
    const token = await user.getIdToken();

    const requestOptions = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    };

    const shipmentParams = new URLSearchParams();
    if (shipmentLimit !== "50") shipmentParams.set("limit", shipmentLimit);
    if (startDate) shipmentParams.set("startDate", startDate);
    if (endDate) shipmentParams.set("endDate", endDate);
    const shipmentsUrl = shipmentParams.size
      ? `/api/shipments?${shipmentParams}`
      : "/api/shipments";
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

    const formattedCoreShipments = (shipmentsData.shipments || []).map(
      (shipment) => ({
        ...shipment,
        progress: calculateShipmentProgress(shipment),
      }),
    );

    const formattedPickups = (pickupsData.pickups || []).map(
      hydrateBoardShipment,
    );

    if (requestSequence !== coreFetchSequenceRef.current) return;
    setCoreShipments(formattedCoreShipments);
    setPickups(formattedPickups);
  }, [endDate, pickupLimit, shipmentLimit, startDate, user]);

  const fetchDeliveryOperationsData = useCallback(async () => {
    if (!user) return;

    const token = await user.getIdToken();
    const res = await fetch("/api/shipments/delivery-operations", {
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
    const formattedDeliveryShipments = (data.shipments || []).map(
      (shipment) => ({
        ...shipment,
        progress: calculateShipmentProgress(shipment),
      }),
    );

    setDeliveryShipments(formattedDeliveryShipments);
    setDeliveryOpsLoaded(true);
  }, [user]);

  const fetchShipments = useCallback(
    async ({ includeDelivery = deliveryOpsLoaded } = {}) => {
      try {
        setLoading(true);

        await fetchCoreBoardData();

        if (
          includeDelivery ||
          activeBoardTab === SHIPMENT_BOARD_TABS.DELIVERY
        ) {
          setLoadingDelivery(true);
          await fetchDeliveryOperationsData();
        }
      } catch (err) {
        console.error("FULL ERROR:", err);
        alert(`Error: ${err.message}`);
      } finally {
        setLoading(false);
        setLoadingDelivery(false);
      }
    },
    [
      activeBoardTab,
      deliveryOpsLoaded,
      fetchCoreBoardData,
      fetchDeliveryOperationsData,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        await fetchCoreBoardData();
      } catch (err) {
        if (!cancelled) {
          console.error("FULL ERROR:", err);
          alert(`Error: ${err.message}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchCoreBoardData]);

  const deliveryFetchInFlightRef = useRef(false);

  useEffect(() => {
    if (activeBoardTab !== SHIPMENT_BOARD_TABS.DELIVERY || !user) return;
    if (deliveryOpsLoaded || deliveryFetchInFlightRef.current) return;

    let cancelled = false;
    deliveryFetchInFlightRef.current = true;
    setLoadingDelivery(true);

    (async () => {
      try {
        await fetchDeliveryOperationsData();
      } catch (err) {
        if (!cancelled) {
          console.error("Delivery operations load failed:", err);
          alert(`Error: ${err.message}`);
        }
      } finally {
        deliveryFetchInFlightRef.current = false;
        if (!cancelled) setLoadingDelivery(false);
      }
    })();

    return () => {
      cancelled = true;
      deliveryFetchInFlightRef.current = false;
      setLoadingDelivery(false);
    };
  }, [activeBoardTab, deliveryOpsLoaded, fetchDeliveryOperationsData, user]);

  useEffect(() => {
    const trackingRef = searchQuery.trim().toUpperCase();
    if (!user || !SHIPMENT_TRACKING_PATTERN.test(trackingRef)) {
      setLookupShipment(null);
      return;
    }

    const alreadyLoaded = shipments.some(
      (shipment) =>
        shipment.id === trackingRef || shipment.shipmentId === trackingRef,
    );
    if (alreadyLoaded) {
      setLookupShipment(null);
      return;
    }
    if (lookupShipment?.id === trackingRef) return;

    setLookupShipment(null);

    let cancelled = false;

    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(
          `/api/shipments/${encodeURIComponent(trackingRef)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          },
        );
        if (!res.ok || cancelled) return;

        const data = await res.json();
        if (!data.shipment || cancelled) return;
        setLookupShipment(data.shipment);
      } catch (err) {
        console.warn("Shipment lookup unavailable:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lookupShipment, searchQuery, shipments, user]);

  useEffect(() => {
    if (SHIPMENT_TRACKING_PATTERN.test(searchQuery.trim())) {
      setActiveBoardTab(SHIPMENT_BOARD_TABS.ALL);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (activeBoardTab !== SHIPMENT_BOARD_TABS.DELIVERY || !user) return;
    fetchCheckerDirectory();
  }, [activeBoardTab, fetchCheckerDirectory, user]);

  const filteredShipments = useMemo(() => {
    return shipmentsWithPickups.filter((shipment) => {
      const searchContent = [
        shipment.id,
        shipment.shipmentId,
        shipment.sender?.name,
        shipment.recipient?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchContent.includes(searchQuery.trim().toLowerCase())) return false;

      if (
        SHIPMENT_TRACKING_PATTERN.test(searchQuery.trim()) &&
        [shipment.id, shipment.shipmentId].some(
          (id) =>
            String(id || "").toLowerCase() === searchQuery.trim().toLowerCase(),
        )
      ) {
        return true;
      }

      if (startDate || endDate) {
        const shipmentDate = new Date(shipment.createdAtIso || shipment.createdAt);

        if (Number.isNaN(shipmentDate.getTime())) return false;

        if (startDate) {
          const start = new Date(`${startDate}T00:00:00+08:00`);
          if (shipmentDate < start) return false;
        }

        if (endDate) {
          const end = new Date(
            Date.parse(`${endDate}T00:00:00+08:00`) + 24 * 60 * 60 * 1000,
          );
          if (shipmentDate >= end) return false;
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
    shipmentsWithPickups,
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

  const checkerDeliveryStats = useMemo(
    () =>
      aggregateCheckerDeliveryStats(
        deliveryTabShipments,
        activeDeliveryChecker,
        findDeliveryCheckerTab(deliveryCheckerTabs, activeDeliveryChecker),
        checkerNameById,
      ),
    [
      activeDeliveryChecker,
      checkerNameById,
      deliveryCheckerTabs,
      deliveryTabShipments,
    ],
  );

  const activeCheckerProfile = useMemo(() => {
    if (activeDeliveryChecker === ALL_CHECKERS_TAB) return null;

    const checkerTab = findDeliveryCheckerTab(
      deliveryCheckerTabs,
      activeDeliveryChecker,
    );

    if (checkerDirectory[activeDeliveryChecker]) {
      return checkerDirectory[activeDeliveryChecker];
    }

    const matchKeys = checkerTab?.matchKeys || [activeDeliveryChecker];
    for (const key of matchKeys) {
      if (checkerDirectory[key]) return checkerDirectory[key];
    }

    if (!checkerTab) return null;

    return {
      id: checkerTab.key,
      name: checkerTab.label,
      email: "",
      warehouseName: "",
      warehouseCode: "",
      assignedMunicipalities: [],
    };
  }, [activeDeliveryChecker, checkerDirectory, deliveryCheckerTabs]);

  const openAssignCheckerMunicipalities = useCallback((checkerId = "") => {
    setAssignMunicipalitiesCheckerId(checkerId);
    setIsAssignCheckerMunicipalitiesOpen(true);
  }, []);

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
          shipmentMatchesDeliveryCheckerPool(shipment),
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
  const canAssignMunicipalities = canAssignDeliveryRoutes(profile);
  const modalShipmentIds = useMemo(
    () => (selectedShipment?.id ? [selectedShipment.id] : []),
    [selectedShipment?.id],
  );
  const modalShipments = useMemo(
    () => (selectedShipment ? [selectedShipment] : []),
    [selectedShipment],
  );
  const handleMessageCustomer = (shipment) => {
    const phone = shipment.sender?.phone || shipment.recipient?.phone;
    alert(`Logic to SMS ${phone} for Order ${shipment.shipmentId}`);
  };

  const refreshBoard = useCallback(() => fetchShipments(), [fetchShipments]);

  const handleShipmentUpdated = useCallback((updatedShipment) => {
    if (!updatedShipment?.id && !updatedShipment?.shipmentId) return;

    const hydrated = hydrateBoardShipment(updatedShipment);
    const isPickup = isPickupShipment(hydrated);
    const isDelivery = shipmentMatchesDeliveryCheckerPool(hydrated);

    setCoreShipments((current) =>
      patchShipmentList(current, hydrated, { include: !isPickup }),
    );
    setDeliveryShipments((current) =>
      patchShipmentList(current, hydrated, { include: isDelivery }),
    );
    setPickups((current) =>
      patchShipmentList(current, hydrated, { include: isPickup }),
    );

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("atlas:shipment-updated", {
          detail: { shipment: hydrated },
        }),
      );
    }
  }, []);

  const tableLoading =
    (loading && coreShipments.length === 0 && pickups.length === 0) ||
    (activeBoardTab === SHIPMENT_BOARD_TABS.DELIVERY &&
      loadingDelivery &&
      !deliveryOpsLoaded);

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
              onDeleted={refreshBoard}
              onEditPickup={(pickup) => {
                setEditingPickup(pickup);
                setIsNewOrderModalOpen(true);
              }}
            />
          </div>
        ) : (
          <>
            {activeBoardTab === SHIPMENT_BOARD_TABS.DELIVERY && (
              <>
                <DeliveryCheckerTabs
                  tabs={deliveryCheckerTabs}
                  activeTab={activeDeliveryChecker}
                  onChange={setActiveDeliveryChecker}
                  isDark={isDark}
                  checkerProfile={activeCheckerProfile}
                  canEditCheckerAreas={canAssignMunicipalities}
                  onEditCheckerAreas={() =>
                    openAssignCheckerMunicipalities(
                      activeCheckerProfile?.id || activeDeliveryChecker,
                    )
                  }
                  headerAction={
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={refreshBoard}
                        disabled={tableLoading}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors disabled:opacity-60 sm:w-auto sm:justify-start sm:py-2 ${
                          isDark
                            ? "border-slate-600 text-slate-200 hover:border-blue-500 hover:text-blue-300 hover:bg-blue-500/10"
                            : "border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50"
                        }`}
                        title="Refresh delivery operations"
                        aria-label="Refresh delivery operations"
                      >
                        <FontAwesomeIcon
                          icon={faSync}
                          spin={tableLoading}
                          className="text-blue-500"
                        />
                        <span className="hidden sm:inline">Refresh</span>
                      </button>
                      {canAssignMunicipalities ? (
                        <button
                          type="button"
                          onClick={() => openAssignCheckerMunicipalities()}
                          className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors sm:w-auto sm:justify-start sm:py-2 ${
                            isDark
                              ? "border-slate-600 text-slate-200 hover:border-sky-500 hover:text-sky-300 hover:bg-sky-500/10"
                              : "border-slate-300 text-slate-700 hover:border-sky-500 hover:text-sky-700 hover:bg-sky-50"
                          }`}
                        >
                          <FontAwesomeIcon icon={faMapMarkedAlt} className="text-sky-500" />
                          <span className="hidden sm:inline">
                            Assign checker municipalities
                          </span>
                          <span className="sm:hidden">Assign areas</span>
                        </button>
                      ) : null}
                    </div>
                  }
                >
                  <DeliveryCheckerSummaryCards
                    stats={checkerDeliveryStats}
                    isDark={isDark}
                  />
                </DeliveryCheckerTabs>
              </>
            )}

            <div
              className={`mt-4 border rounded-xl overflow-hidden shadow-xl backdrop-blur-sm ${theme.board}`}
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
                  onClick={refreshBoard}
                  disabled={tableLoading}
                  className={`transition-colors p-1 rounded ${theme.refreshButton}`}
                  title="Refresh"
                >
                  <FontAwesomeIcon
                    icon={faSync}
                    spin={tableLoading}
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
                    className={`flex flex-col gap-1 border rounded-lg px-2 py-1 flex-1 sm:flex-none ${theme.filterWrap}`}
                  >
                    <span className={`text-[10px] font-semibold ${theme.iconMuted}`}>
                      Date created
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        aria-label="Date created from"
                        title="Date created from (Philippine time)"
                        className={`bg-transparent text-xs outline-none w-24 ${theme.dateInput}`}
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          if (e.target.value) {
                            setShipmentLimit("all");
                            setPickupLimit("all");
                          }
                        }}
                      />
                      <span className={theme.iconMuted}>-</span>
                      <input
                        type="date"
                        aria-label="Date created to"
                        title="Date created to (Philippine time)"
                        className={`bg-transparent text-xs outline-none w-24 ${theme.dateInput}`}
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          if (e.target.value) {
                            setShipmentLimit("all");
                            setPickupLimit("all");
                          }
                        }}
                      />
                    </div>
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

            <div className={`px-4 sm:px-6 py-2 text-xs ${theme.emptyText}`}>
              {tableLoading ? "Loading shipments…" : `${visibleShipments.length} matching shipments`}
              {" · Newest created first · Philippine time"}
              {SHIPMENT_TRACKING_PATTERN.test(searchQuery.trim()) && (
                <span> · Exact ID search across all dates and statuses</span>
              )}
            </div>

            {/* Table */}
            <div className="md:overflow-x-auto">
              <div className="md:min-w-[1050px]">
                <div
                  className={`hidden md:grid grid-cols-14 gap-4 px-6 py-3 border-b text-xs font-semibold uppercase tracking-wider ${theme.tableHead}`}
                >
                  <div className="col-span-4">Tracking / Customer</div>
                  <div className="col-span-2">Route</div>
                  <div className="col-span-2">Details</div>
                  <div className="col-span-3">Progress</div>
                  <div className="col-span-2">Dates</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>

                <div className="min-h-[300px]">
                  {tableLoading ? (
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
                        onDeleted={refreshBoard}
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
        onRefresh={refreshBoard}
        profile={profile}
        onReconcile={() => setIsReconcileModalOpen(true)}
        onReceiveReturned={() => setIsReceiveReturnedModalOpen(true)}
        onReleaseToCheckers={() => setIsReleaseToCheckerModalOpen(true)}
        onShipmentUpdated={handleShipmentUpdated}
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
          refreshBoard();
          setEditingPickup(null);
        }}
        resetTrigger={isNewOrderModalOpen}
        editData={editingPickup}
      />

      <ReconcileAtHubModal
        isOpen={isReconcileModalOpen}
        onClose={() => setIsReconcileModalOpen(false)}
        onSuccess={refreshBoard}
        isDark={isDark}
        shipment={selectedShipment}
      />

      <ReceiveReturnedModal
        isOpen={isReceiveReturnedModalOpen}
        onClose={() => setIsReceiveReturnedModalOpen(false)}
        onSuccess={refreshBoard}
        isDark={isDark}
        shipment={selectedShipment}
      />

      <ReleaseToCheckerModal
        isOpen={isReleaseToCheckerModalOpen}
        onClose={() => setIsReleaseToCheckerModalOpen(false)}
        onSuccess={refreshBoard}
        isDark={isDark}
        user={user}
        defaultShipmentIds={modalShipmentIds}
        defaultShipments={modalShipments}
      />

      <AssignCheckerMunicipalitiesModal
        isOpen={isAssignCheckerMunicipalitiesOpen}
        onClose={() => {
          setIsAssignCheckerMunicipalitiesOpen(false);
          setAssignMunicipalitiesCheckerId("");
        }}
        onSuccess={() => {
          fetchCheckerDirectory();
        }}
        initialCheckerId={assignMunicipalitiesCheckerId}
        isDark={isDark}
        user={user}
      />
    </div>
  );
});

export default ShipmentBoard;
