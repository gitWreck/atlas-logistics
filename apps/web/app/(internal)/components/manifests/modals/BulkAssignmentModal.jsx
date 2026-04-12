"use client";

import React, { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faTruck,
  faTimes,
  faCheckCircle,
  faArrowDown,
} from "@fortawesome/free-solid-svg-icons";
import { bulkAssignShipments } from "@/app/utility/FirebaseFunctions";
import {
  getModalThemeClasses,
  getTableTheme,
} from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";

export default function BulkAssignmentModal({
  isOpen,
  trip,
  onClose,
  onSuccess,
  isDark = false,
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [candidates, setCandidates] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const modalTheme = getModalThemeClasses(isDark);
  const modalAction = getModalActionClasses();
  const tableTheme = getTableTheme(isDark);

  useEffect(() => {
    if (isOpen && trip) {
      setCandidates([]);
      setNextCursor(null);
      setSelectedIds([]);
      setSearchTerm("");
      fetchCandidates(null);
    }
  }, [isOpen, trip]);

  const fetchCandidates = async (cursorToUse) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        origin: trip.originCode || "MNL",
      });

      if (cursorToUse) params.append("cursor", cursorToUse);

      const res = await fetch(`/api/shipments/candidates?${params.toString()}`);
      const json = await res.json();

      if (!json.success) throw new Error(json.error);

      setCandidates((prev) =>
        cursorToUse ? [...prev, ...json.data] : json.data,
      );
      setNextCursor(json.nextCursor);
      setHasMore(json.hasMore);
    } catch (error) {
      console.error("Fetch error:", error);
      alert("Error fetching shipments: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (nextCursor) fetchCandidates(nextCursor);
  };

  const filteredList = useMemo(() => {
    return candidates.filter((item) => {
      const search = searchTerm.toLowerCase();
      return (
        item.shipmentId?.toLowerCase().includes(search) ||
        item.destination?.toLowerCase().includes(search) ||
        item.recipient?.name?.toLowerCase().includes(search)
      );
    });
  }, [candidates, searchTerm]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredList.map((item) => item.id));
    }
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;

    setSubmitting(true);
    try {
      const result = await bulkAssignShipments({
        tripId: trip.tripId,
        shipmentIds: selectedIds,
      });

      if (result.data.success) {
        onSuccess?.();
      } else {
        alert("Errors: " + JSON.stringify(result.data.errors));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 ${modalTheme.overlay}`}
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-4xl shadow-2xl flex flex-col h-[85vh] rounded-xl border ${modalTheme.modal}`}
      >
        {/* HEADER */}
        <div
          className={`p-5 border-b rounded-t-xl flex justify-between items-center ${modalTheme.header}`}
        >
          <div>
            <h2
              className={`text-xl font-bold flex items-center gap-2 ${modalTheme.title}`}
            >
              <FontAwesomeIcon icon={faTruck} className="text-blue-500" />
              Add Shipments to Trip
            </h2>
            <div className={`text-sm mt-1 ${modalTheme.bodyText}`}>
              Selecting for {trip.tripId} ({trip.route})
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`transition-colors p-1 rounded ${modalTheme.closeButton}`}
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* TOOLBAR */}
        <div className={`p-4 border-b flex gap-4 ${tableTheme.header}`}>
          <div className="relative flex-1">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search destination, name, or tracking..."
              className={`w-full border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-blue-500 outline-none ${modalTheme.input}`}
            />
            <FontAwesomeIcon
              icon={faSearch}
              className={`absolute left-3.5 top-3.5 ${tableTheme.inputIcon}`}
            />
          </div>

          <div
            className={`flex items-center gap-2 text-sm ${tableTheme.cellSecondary}`}
          >
            <span className={`font-bold ${tableTheme.cellPrimary}`}>
              {selectedIds.length}
            </span>
            selected
          </div>
        </div>

        {/* TABLE HEADER */}
        <div
          className={`grid grid-cols-[50px_1.5fr_1fr_1fr_100px] p-3 text-xs font-bold uppercase border-b ${tableTheme.thead}`}
        >
          <div className="flex justify-center">
            <input
              type="checkbox"
              onChange={selectAll}
              checked={
                filteredList.length > 0 &&
                selectedIds.length === filteredList.length
              }
              className="rounded accent-blue-500"
            />
          </div>
          <div>Tracking / Sender</div>
          <div>Destination</div>
          <div>Recipient</div>
          <div className="text-right">Items</div>
        </div>

        {/* SCROLLABLE LIST */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredList.length === 0 && !loading ? (
            <div className={`p-10 text-center italic ${tableTheme.emptyText}`}>
              No unassigned shipments found.
            </div>
          ) : (
            <>
              {filteredList.map((item) => {
                const isSelected = selectedIds.includes(item.id);

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className={`grid grid-cols-[50px_1.5fr_1fr_1fr_100px] p-3 border-b items-center text-sm cursor-pointer transition-colors ${
                      isSelected ? tableTheme.selectedRow : tableTheme.rowHover
                    } ${tableTheme.tbodyDivide.replace("divide-", "border-")}`}
                  >
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="rounded accent-blue-500"
                      />
                    </div>

                    <div>
                      <div
                        className={`font-mono font-bold ${tableTheme.cellPrimary}`}
                      >
                        {item.shipmentId}
                      </div>
                      <div className={`text-xs ${tableTheme.cellSecondary}`}>
                        {item.sender?.name}
                      </div>
                    </div>

                    <div className={tableTheme.cellPrimary}>
                      {item.destination}
                      <span
                        className={`ml-2 text-[10px] px-1 rounded border ${tableTheme.roleBadge}`}
                      >
                        {item.destinationCode}
                      </span>
                    </div>

                    <div className={`text-xs ${tableTheme.cellSecondary}`}>
                      {item.recipient?.name}
                    </div>

                    <div
                      className={`text-right font-mono ${tableTheme.cellSecondary}`}
                    >
                      {item.totals?.totalItems || 1} pkg
                    </div>
                  </div>
                );
              })}

              {/* LOAD MORE */}
              {loading ? (
                <div
                  className={`p-4 text-center text-xs animate-pulse ${tableTheme.emptyText}`}
                >
                  Loading more shipments...
                </div>
              ) : hasMore ? (
                <div className="p-4 text-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    className={`text-xs font-bold flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded border transition-all ${tableTheme.paginationButton}`}
                  >
                    <FontAwesomeIcon icon={faArrowDown} />
                    Load More Shipments
                  </button>
                </div>
              ) : (
                candidates.length > 0 && (
                  <div
                    className={`p-6 text-center text-xs border-t ${tableTheme.footer}`}
                  >
                    End of list
                  </div>
                )
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div
          className={`p-5 border-t rounded-b-xl flex justify-end gap-3 ${modalTheme.header}`}
        >
          <button
            type="button"
            onClick={onClose}
            className={modalTheme.secondaryButton}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selectedIds.length === 0}
            className={modalAction.primaryInline}
          >
            {submitting ? (
              "Assigning..."
            ) : (
              <>
                <FontAwesomeIcon icon={faCheckCircle} />
                Assign {selectedIds.length} Shipments
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
