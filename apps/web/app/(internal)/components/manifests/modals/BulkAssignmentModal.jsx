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
  isDark = false,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-4xl shadow-2xl flex flex-col h-[85vh] rounded-xl ${
        isDark ? "bg-slate-900 border border-slate-700" : "bg-white border border-slate-200"
      }`}>
        {/* HEADER */}
        <div className={`p-5 border-b rounded-t-xl flex justify-between items-center ${
          isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"
        }`}>
          <div>
            <h2 className={`text-xl font-bold flex items-center gap-2 ${
              isDark ? "text-white" : "text-slate-900"
            }`}>
              <FontAwesomeIcon icon={faTruck} className="text-blue-500" />
              Add Shipments to Trip
            </h2>
            <div className={`text-sm mt-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}>
              Selecting for {trip.tripId} ({trip.route})
            </div>
          </div>
          <button
            onClick={onClose}
            className={`transition-colors p-1 rounded ${
              isDark ? "text-slate-500 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* TOOLBAR */}
        <div className={`p-4 border-b flex gap-4 ${
          isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
        }`}>
          <div className="relative flex-1">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search destination, name, or tracking..."
              className={`w-full border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-blue-500 outline-none ${
                isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
              }`}
            />
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3.5 top-3.5 text-slate-500"
            />
          </div>
          <div className={`flex items-center gap-2 text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            <span className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{selectedIds.length}</span>{" "}
            selected
          </div>
        </div>

        {/* TABLE HEADER */}
        <div className={`grid grid-cols-[50px_1.5fr_1fr_1fr_100px] p-3 text-xs font-bold uppercase border-b ${
          isDark ? "bg-slate-950/50 text-slate-500 border-slate-800" : "bg-slate-100 text-slate-600 border-slate-200"
        }`}>
          <div className="flex justify-center">
            <input
              type="checkbox"
              onChange={selectAll}
              checked={
                filteredList.length > 0 &&
                selectedIds.length === filteredList.length
              }
              className={`rounded ${isDark ? "bg-slate-800 border-slate-600" : "border-slate-400"}`}
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
            <div className={`p-10 text-center italic ${isDark ? "text-slate-500" : "text-slate-600"}`}>
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
                      isSelected
                        ? isDark ? "bg-blue-600/10" : "bg-blue-50"
                        : isDark ? "hover:bg-slate-800/50 border-slate-800" : "hover:bg-slate-100 border-slate-200"
                    }`}
                  >
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className={`rounded accent-blue-500 ${isDark ? "bg-slate-800 border-slate-600" : "border-slate-400"}`}
                      />
                    </div>
                    <div>
                      <div className={`font-mono font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {item.trackingNumber}
                      </div>
                      <div className={`text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}>
                        {item.sender?.name}
                      </div>
                    </div>
                    <div className={isDark ? "text-slate-300" : "text-slate-700"}>
                      {item.destination}
                      <span className={`ml-2 text-[10px] px-1 rounded ${
                        isDark ? "bg-slate-800 border border-slate-700" : "bg-slate-100 border border-slate-200"
                      }`}>
                        {item.destinationCode}
                      </span>
                    </div>
                    <div className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                      {item.recipient?.name}
                    </div>
                    <div className={`text-right font-mono ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                      {item.totals?.totalItems || 1} pkg
                    </div>
                  </div>
                );
              })}

              {/* PAGINATION / LOAD MORE BUTTON */}
              {loading ? (
                <div className={`p-4 text-center text-xs animate-pulse ${isDark ? "text-slate-500" : "text-slate-600"}`}>
                  Loading more shipments...
                </div>
              ) : hasMore ? (
                <div className="p-4 text-center">
                  <button
                    onClick={handleLoadMore}
                    className={`text-xs font-bold flex items-center justify-center gap-2 mx-auto px-4 py-2 rounded border transition-all ${
                    isDark ? "text-blue-400 hover:text-blue-300 border-slate-700 hover:bg-slate-800" : "text-blue-600 hover:text-blue-700 border-slate-300 hover:bg-slate-100"
                  }`}
                  >
                    <FontAwesomeIcon icon={faArrowDown} /> Load More Shipments
                  </button>
                </div>
              ) : (
                candidates.length > 0 && (
                  <div className={`p-6 text-center text-xs border-t ${
                  isDark ? "text-slate-600 border-slate-800/50" : "text-slate-500 border-slate-200"
                }`}>
                    End of list
                  </div>
                )
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className={`p-5 border-t rounded-b-xl flex justify-end gap-3 ${
          isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"
        }`}>
          <button
            onClick={onClose}
            className={`px-6 py-2.5 rounded-lg border font-bold text-sm transition-colors ${
              isDark ? "border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800" : "border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
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
