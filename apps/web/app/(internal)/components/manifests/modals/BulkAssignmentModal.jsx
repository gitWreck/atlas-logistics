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

export default function BulkAssignmentModal({
  isOpen,
  trip,
  onClose,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data State
  const [candidates, setCandidates] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination State
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  // 1. Initial Fetch on Open
  useEffect(() => {
    if (isOpen && trip) {
      setCandidates([]); // Reset list
      setNextCursor(null);
      fetchCandidates(null); // Fetch first page
      setSelectedIds([]);
    }
  }, [isOpen, trip]);

  const fetchCandidates = async (cursorToUse) => {
    setLoading(true);
    try {
      // Build URL with params
      const params = new URLSearchParams({
        origin: trip.originCode || "MNL",
      });
      if (cursorToUse) params.append("cursor", cursorToUse);

      const res = await fetch(`/api/shipments/candidates?${params.toString()}`);
      const json = await res.json();

      if (!json.success) throw new Error(json.error);

      // Append new data to existing list if loading more, otherwise replace
      setCandidates((prev) =>
        cursorToUse ? [...prev, ...json.data] : json.data,
      );

      // Update pagination state
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

  // 2. Filter Logic (Client Side)
  const filteredList = useMemo(() => {
    // If user types a search term, we filter the CURRENTLY LOADED list
    // (True server-side search would require a specialized search engine like Algolia)
    return candidates.filter((item) => {
      const search = searchTerm.toLowerCase();
      return (
        item.trackingNumber.toLowerCase().includes(search) ||
        item.destination?.toLowerCase().includes(search) ||
        item.recipient?.name.toLowerCase().includes(search)
      );
    });
  }, [candidates, searchTerm]);

  // 3. Selection Logic
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredList.length) setSelectedIds([]);
    else setSelectedIds(filteredList.map((x) => x.id));
  };

  // 4. Submit Logic
  const handleSubmit = async () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    try {
      const result = await bulkAssignShipments({
        tripId: trip.tripId,
        shipmentIds: selectedIds,
      });

      if (result.data.success) {
        onSuccess();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col h-[85vh]">
        {/* HEADER */}
        <div className="p-5 border-b border-slate-800 bg-slate-950 rounded-t-xl flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faTruck} className="text-blue-500" />
              Add Shipments to Trip
            </h2>
            <div className="text-sm text-slate-500 mt-1">
              Selecting for {trip.tripId} ({trip.route})
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* TOOLBAR */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex gap-4">
          <div className="relative flex-1">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search destination, name, or tracking..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:border-blue-500 outline-none"
            />
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3.5 top-3.5 text-slate-500"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="font-bold text-white">{selectedIds.length}</span>{" "}
            selected
          </div>
        </div>

        {/* TABLE HEADER */}
        <div className="grid grid-cols-[50px_1.5fr_1fr_1fr_100px] bg-slate-950/50 p-3 text-xs font-bold text-slate-500 uppercase border-b border-slate-800">
          <div className="flex justify-center">
            <input
              type="checkbox"
              onChange={selectAll}
              checked={
                filteredList.length > 0 &&
                selectedIds.length === filteredList.length
              }
              className="rounded bg-slate-800 border-slate-600"
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
            <div className="p-10 text-center text-slate-500 italic">
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
                    className={`grid grid-cols-[50px_1.5fr_1fr_1fr_100px] p-3 border-b border-slate-800 items-center text-sm cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-600/10" : "hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="rounded bg-slate-800 border-slate-600 accent-blue-500"
                      />
                    </div>
                    <div>
                      <div className="font-mono font-bold text-white">
                        {item.trackingNumber}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.sender?.name}
                      </div>
                    </div>
                    <div className="text-slate-300">
                      {item.destination}
                      <span className="ml-2 text-[10px] bg-slate-800 px-1 rounded border border-slate-700">
                        {item.destinationCode}
                      </span>
                    </div>
                    <div className="text-slate-400 text-xs">
                      {item.recipient?.name}
                    </div>
                    <div className="text-right font-mono text-slate-400">
                      {item.totals?.totalItems || 1} pkg
                    </div>
                  </div>
                );
              })}

              {/* PAGINATION / LOAD MORE BUTTON */}
              {loading ? (
                <div className="p-4 text-center text-xs text-slate-500 animate-pulse">
                  Loading more shipments...
                </div>
              ) : hasMore ? (
                <div className="p-4 text-center">
                  <button
                    onClick={handleLoadMore}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded border border-slate-700 hover:bg-slate-800 transition-all"
                  >
                    <FontAwesomeIcon icon={faArrowDown} /> Load More Shipments
                  </button>
                </div>
              ) : (
                candidates.length > 0 && (
                  <div className="p-6 text-center text-xs text-slate-600 border-t border-slate-800/50">
                    End of list
                  </div>
                )
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-slate-800 bg-slate-950 rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white font-bold text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedIds.length === 0}
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
