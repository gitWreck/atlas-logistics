"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faExclamationCircle,
  faFilter,
  faSearch,
  faTruckPickup,
} from "@fortawesome/free-solid-svg-icons";
import ShipmentRow from "./ShipmentRow";
import { getBoardThemeClasses } from "@/app/utility/constant/theme";
import TablePaginationFooter from "../ui/TablePaginationFooter";

export default function PickupRequestsTable({
  pickups = [],
  loading = false,
  isDark = false,
  pickupLimit = "50",
  onPickupLimitChange,
  onSelectPickup,
  onEditPickup,
}) {
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [delayType, setDelayType] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const theme = getBoardThemeClasses(isDark);

  const uniqueDelayReasons = useMemo(() => {
    const reasons = new Set(
      pickups
        .filter((pickup) => pickup.status === "DELAYED" && pickup.delayReason)
        .map((pickup) => pickup.delayReason),
    );

    return Array.from(reasons);
  }, [pickups]);

  const filteredPickups = useMemo(() => {
    return pickups.filter((pickup) => {
      const searchContent = [
        pickup.shipmentId,
        pickup.trackingNumber,
        pickup.sender?.name,
        pickup.recipient?.name,
        pickup.origin,
        pickup.destination,
        pickup.status,
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
  }, [activeFilter, delayType, endDate, pickups, searchQuery, startDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, delayType, endDate, pickupLimit, searchQuery, startDate]);

  const totalPages = Math.max(1, Math.ceil(filteredPickups.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredPickups.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div
      className={`border rounded-xl overflow-hidden shadow-xl backdrop-blur-sm ${theme.board}`}
    >
      <div
        className={`px-4 sm:px-6 py-4 border-b flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 ${theme.header}`}
      >
        <h3 className={`font-bold whitespace-nowrap flex items-center gap-2 ${theme.title}`}>
          <FontAwesomeIcon icon={faTruckPickup} className="text-emerald-500" />
          Pickup Requests
        </h3>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full xl:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <FontAwesomeIcon
              icon={faSearch}
              className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.iconMuted}`}
            />
            <input
              type="text"
              placeholder="Search pickup requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none ${theme.input}`}
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
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
              <div className={`p-10 text-center animate-pulse ${theme.emptyText}`}>
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
                  onClick={onSelectPickup}
                  onEdit={onEditPickup}
                  isDark={isDark}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {filteredPickups.length > 0 && (
        <TablePaginationFooter
          totalItems={filteredPickups.length}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalPages={totalPages}
          limitValue={pickupLimit}
          limitTitle="Limit pickup requests"
          onLimitChange={onPickupLimitChange}
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
  );
}
