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
import UnifiedShipmentModal from "./modals/UnifiedShipmentModal";
import { calculateProgress } from "@/app/utility/utilities";
import { getBoardThemeClasses } from "@/app/utility/constant/theme";

const PickupBoard = forwardRef(function PickupBoard(
  { user, profile, isDark = false },
  ref,
) {
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isNewPickupModalOpen, setIsNewPickupModalOpen] = useState(false);
  const [selectedPickupId, setSelectedPickupId] = useState(null);
  const [editingPickup, setEditingPickup] = useState(null);

  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [delayType, setDelayType] = useState("ALL");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const theme = getBoardThemeClasses(isDark);

  const fetchPickups = async () => {
    try {
      setLoading(true);

      if (!user) {
        console.error("User is not logged in yet.");
        return;
      }

      const token = await user.getIdToken();

      const res = await fetch("/api/shipments/pickups", {
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

      const formatted = (data.pickups || []).map((pickup) => ({
        ...pickup,
        progress: calculateProgress(pickup.status),
      }));

      setPickups(formatted);
    } catch (err) {
      console.error("Failed to fetch pickups:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPickups();
  }, [user]);

  const filteredPickups = useMemo(() => {
    return pickups.filter((pickup) => {
      const searchContent = [
        pickup.trackingNumber,
        pickup.sender?.name,
        pickup.recipient?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchContent.includes(searchQuery.toLowerCase())) return false;

      if (startDate || endDate) {
        const pickupDate = pickup.createdAt?._seconds
          ? new Date(pickup.createdAt._seconds * 1000)
          : new Date(pickup.createdAt);

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (pickupDate < start) return false;
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (pickupDate > end) return false;
        }
      }

      if (activeFilter !== "ALL") {
        if (activeFilter === "ACTIVE" && pickup.status === "DELIVERED") {
          return false;
        }

        if (activeFilter === "DELAYED") {
          if (pickup.status !== "DELAYED") return false;
          if (delayType !== "ALL" && pickup.delayReason !== delayType) {
            return false;
          }
        } else if (activeFilter !== "ACTIVE") {
          if (pickup.status !== activeFilter) return false;
        }
      }

      return true;
    });
  }, [pickups, searchQuery, startDate, endDate, activeFilter, delayType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate, activeFilter, delayType]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredPickups.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredPickups.length / itemsPerPage) || 1;

  const uniqueDelayReasons = useMemo(() => {
    const reasons = new Set(
      pickups
        .filter((pickup) => pickup.status === "DELAYED" && pickup.delayReason)
        .map((pickup) => pickup.delayReason),
    );

    return Array.from(reasons);
  }, [pickups]);

  const selectedPickup = pickups.find(
    (pickup) => pickup.id === selectedPickupId,
  );

  useImperativeHandle(
    ref,
    () => ({
      openCreateModal: () => {
        setEditingPickup(null);
        setIsNewPickupModalOpen(true);
      },
    }),
    [],
  );

  return (
    <div className={`min-h-screen font-sans ${theme.page}`}>
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
              Pickup Requests
              <button
                type="button"
                onClick={fetchPickups}
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
                  placeholder="Search Tracking or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none ${theme.input}`}
                />
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                {/* Date filter */}
                <div
                  className={`flex items-center gap-2 border rounded-lg px-2 py-1 flex-1 sm:flex-none justify-center ${theme.filterWrap}`}
                >
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`bg-transparent text-xs outline-none w-24 ${theme.dateInput}`}
                  />
                  <span className={theme.iconMuted}>-</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`bg-transparent text-xs outline-none w-24 ${theme.dateInput}`}
                  />
                </div>

                {/* Status filter */}
                <div className="relative w-full sm:w-40">
                  <FontAwesomeIcon
                    icon={faFilter}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.iconMuted}`}
                  />
                  <select
                    value={activeFilter}
                    onChange={(e) => {
                      setActiveFilter(e.target.value);
                      setDelayType("ALL");
                    }}
                    className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none appearance-none cursor-pointer ${theme.input}`}
                  >
                    <option value="ALL">All Pickups</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="PENDING_PICKUP">Pending</option>
                    <option value="PICKED_UP">Picked Up</option>
                    <option value="RECEIVED">At Hub</option>
                    <option value="IN_TRANSIT">In Transit</option>
                    <option value="DELIVERED">Completed</option>
                    <option value="DELAYED">Delayed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Delay reason filter */}
              {activeFilter === "DELAYED" && (
                <div className="relative w-full sm:w-40 animate-in fade-in slide-in-from-right-2 duration-300">
                  <FontAwesomeIcon
                    icon={faExclamationCircle}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.warningIcon}`}
                  />
                  <select
                    value={delayType}
                    onChange={(e) => setDelayType(e.target.value)}
                    className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-amber-500 focus:outline-none appearance-none cursor-pointer ${theme.warningFilter}`}
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
                <div className="col-span-2">Pickup Route</div>
                <div className="col-span-2">Details</div>
                <div className="col-span-3">Status</div>
                <div className="col-span-1">Update</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              <div className="min-h-[300px]">
                {loading ? (
                  <div
                    className={`p-10 text-center animate-pulse ${theme.emptyText}`}
                  >
                    Loading pickup requests...
                  </div>
                ) : filteredPickups.length === 0 ? (
                  <div className={`p-10 text-center ${theme.emptyText}`}>
                    No pickup requests found.
                  </div>
                ) : (
                  currentItems.map((pickup) => (
                    <ShipmentRow
                      key={pickup.id}
                      s={pickup}
                      onClick={setSelectedPickupId}
                      isDark={isDark}
                      onEdit={() => {
                        setEditingPickup(pickup);
                        setIsNewPickupModalOpen(true);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Pagination */}
          {filteredPickups.length > 0 && (
            <div
              className={`px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row justify-between items-center gap-3 text-xs ${theme.footer}`}
            >
              <span className={theme.footerText}>
                Showing{" "}
                <span className={`font-bold ${theme.footerStrong}`}>
                  {indexOfFirstItem + 1}
                </span>{" "}
                to{" "}
                <span className={`font-bold ${theme.footerStrong}`}>
                  {Math.min(indexOfLastItem, filteredPickups.length)}
                </span>{" "}
                of {filteredPickups.length}
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
        isOpen={!!selectedPickupId}
        onClose={() => setSelectedPickupId(null)}
        data={selectedPickup}
        isDark={isDark}
        onRefresh={fetchPickups}
      />

      <UnifiedShipmentModal
        profile={profile}
        isOpen={isNewPickupModalOpen}
        onClose={() => {
          setIsNewPickupModalOpen(false);
          setEditingPickup(null);
        }}
        isDark={isDark}
        user={user}
        onSuccess={() => {
          fetchPickups();
          setEditingPickup(null);
        }}
        resetTrigger={isNewPickupModalOpen}
        editData={editingPickup}
      />
    </div>
  );
});

export default PickupBoard;
