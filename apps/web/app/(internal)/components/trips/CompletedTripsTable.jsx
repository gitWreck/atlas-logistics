"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArchive,
  faBan,
  faCheckCircle,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import TripRow from "./TripRow";
import {
  getBoardThemeClasses,
  getOverviewThemeClasses,
} from "@/app/utility/constant/theme";
import TablePaginationFooter from "../ui/TablePaginationFooter";
import { useAuth } from "@/app/context/AuthContext";
import { canManageTripLifecycle } from "@/app/utility/tripLifecycle";

const COMPLETED_SUB_TABS = {
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  ARCHIVED: "archived",
};

const SUB_TAB_CONFIG = {
  [COMPLETED_SUB_TABS.COMPLETED]: {
    label: "Completed",
    icon: faCheckCircle,
    iconClass: "text-emerald-500",
    searchPlaceholder: "Search completed trips...",
    emptyMessage: "No completed trips found.",
    emptySearchMessage: "No completed trips match your search.",
    loadingMessage: "Loading completed trips...",
  },
  [COMPLETED_SUB_TABS.CANCELLED]: {
    label: "Cancelled",
    icon: faBan,
    iconClass: "text-red-500",
    searchPlaceholder: "Search cancelled trips...",
    emptyMessage: "No cancelled trips found.",
    emptySearchMessage: "No cancelled trips match your search.",
    loadingMessage: "Loading cancelled trips...",
  },
  [COMPLETED_SUB_TABS.ARCHIVED]: {
    label: "Archive",
    icon: faArchive,
    iconClass: "text-slate-400",
    searchPlaceholder: "Search archived trips...",
    emptyMessage: "No archived trips found.",
    emptySearchMessage: "No archived trips match your search.",
    loadingMessage: "Loading archived trips...",
  },
};

export default function CompletedTripsTable({
  completedTrips = [],
  cancelledTrips = [],
  archivedTrips = [],
  loading = false,
  isDark = false,
  profile,
  completedTripLimit = "50",
  onCompletedTripLimitChange,
  onSelectTrip,
  onDeleted,
}) {
  const { user } = useAuth();
  const canViewLifecycleTabs = canManageTripLifecycle(profile, user);
  const [activeSubTab, setActiveSubTab] = useState(
    COMPLETED_SUB_TABS.COMPLETED,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const itemsPerPage = 10;
  const theme = getBoardThemeClasses(isDark);
  const overviewTheme = getOverviewThemeClasses(isDark);

  const tripsBySubTab = useMemo(
    () => ({
      [COMPLETED_SUB_TABS.COMPLETED]: completedTrips,
      [COMPLETED_SUB_TABS.CANCELLED]: cancelledTrips,
      [COMPLETED_SUB_TABS.ARCHIVED]: archivedTrips,
    }),
    [archivedTrips, cancelledTrips, completedTrips],
  );

  const activeTrips = tripsBySubTab[activeSubTab] || [];
  const subTabConfig = SUB_TAB_CONFIG[activeSubTab];

  const subTabs = useMemo(() => {
    const tabs = [
      {
        key: COMPLETED_SUB_TABS.COMPLETED,
        label: "Completed",
        count: completedTrips.length,
      },
    ];

    if (canViewLifecycleTabs) {
      tabs.push(
        {
          key: COMPLETED_SUB_TABS.CANCELLED,
          label: "Cancelled",
          count: cancelledTrips.length,
        },
        {
          key: COMPLETED_SUB_TABS.ARCHIVED,
          label: "Archive",
          count: archivedTrips.length,
        },
      );
    }

    return tabs;
  }, [
    archivedTrips.length,
    cancelledTrips.length,
    canViewLifecycleTabs,
    completedTrips.length,
  ]);

  const filteredTrips = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return activeTrips;

    return activeTrips.filter((trip) => {
      const searchContent = [
        trip.tripId,
        trip.driverName,
        trip.truckPlateNumber,
        trip.route,
        trip.tripType,
        trip.origin,
        trip.destination,
        trip.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchContent.includes(query);
    });
  }, [activeTrips, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTrips.length / itemsPerPage),
  );

  const currentItems = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return filteredTrips.slice(indexOfFirstItem, indexOfLastItem);
  }, [currentPage, filteredTrips]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSubTab, completedTripLimit, filteredTrips]);

  useEffect(() => {
    setSearchQuery("");
  }, [activeSubTab]);

  useEffect(() => {
    if (!canViewLifecycleTabs && activeSubTab !== COMPLETED_SUB_TABS.COMPLETED) {
      setActiveSubTab(COMPLETED_SUB_TABS.COMPLETED);
    }
  }, [activeSubTab, canViewLifecycleTabs]);

  return (
    <div
      className={`rounded-xl overflow-hidden shadow-xl backdrop-blur-sm border ${theme.board}`}
    >
      <div className={`px-4 sm:px-6 py-4 border-b ${theme.header}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h3
              className={`font-bold flex items-center gap-2 shrink-0 ${theme.title}`}
            >
              <FontAwesomeIcon
                icon={subTabConfig.icon}
                className={subTabConfig.iconClass}
              />
              {subTabConfig.label} Trips
            </h3>

            {canViewLifecycleTabs && (
              <div
                className={`flex w-full sm:w-auto p-1 rounded-lg border ${overviewTheme.segmentedControl}`}
              >
                {subTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveSubTab(tab.key)}
                    className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-bold uppercase rounded-md transition-all text-center whitespace-nowrap ${
                      activeSubTab === tab.key
                        ? overviewTheme.segmentedControlActive
                        : overviewTheme.segmentedControlIdle
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1 opacity-70">({tab.count})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
            <div className="relative w-full sm:w-72">
              <FontAwesomeIcon
                icon={faSearch}
                className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.iconMuted}`}
              />
              <input
                type="text"
                placeholder={subTabConfig.searchPlaceholder}
                className={`w-full rounded-lg pl-9 pr-4 py-2 text-sm focus:border-emerald-500 focus:outline-none border ${theme.input}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${theme.pageBadge}`}
            >
              {filteredTrips.length} of {activeTrips.length}
            </span>
          </div>
        </div>
      </div>

      <div className="md:overflow-x-auto">
        <div className="md:min-w-[900px]">
          <div
            className={`hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b text-xs font-semibold uppercase tracking-wider ${theme.tableHead}`}
          >
            <div className="col-span-3">Trip Info / Driver</div>
            <div className="col-span-2">Route</div>
            <div className="col-span-2">Stats</div>
            <div className="col-span-3">Progress</div>
            <div className="col-span-1">Update</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          <div className="min-h-[220px]">
            {loading ? (
              <div
                className={`p-10 text-center animate-pulse ${theme.emptyText}`}
              >
                {subTabConfig.loadingMessage}
              </div>
            ) : currentItems.length === 0 ? (
              <div className={`p-10 text-center ${theme.emptyText}`}>
                {searchQuery.trim()
                  ? subTabConfig.emptySearchMessage
                  : subTabConfig.emptyMessage}
              </div>
            ) : (
              currentItems.map((trip) => (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  onClick={onSelectTrip}
                  onDeleted={onDeleted}
                  profile={profile}
                  isDark={isDark}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {filteredTrips.length > 0 && (
        <TablePaginationFooter
          totalItems={filteredTrips.length}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalPages={totalPages}
          limitValue={completedTripLimit}
          limitTitle="Limit completed trips"
          onLimitChange={onCompletedTripLimitChange}
          onPrevious={() =>
            setCurrentPage((page) => Math.max(1, page - 1))
          }
          onNext={() =>
            setCurrentPage((page) => Math.min(totalPages, page + 1))
          }
          theme={theme}
        />
      )}
    </div>
  );
}
