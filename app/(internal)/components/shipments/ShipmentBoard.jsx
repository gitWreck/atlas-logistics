"use client";
import React, { useState, useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faPlus,
  faFileCsv,
  faCommentSms,
  faSync,
} from "@fortawesome/free-solid-svg-icons";
import ShipmentRow from "./ShipmentRow";
import ShipmentDrawer from "./ShipmentDrawer";
import ShipmentNewModal from "./ShipmentNewModal";
import {
  createShipmentWithSequence,
  getListShipments,
} from "@/app/utility/FirebaseFunctionsLocal";
import formatFirestoreDate from "@/app/utility/FormatFirestoreDate";

const FILTERS = [
  { key: "ALL", label: "All View" },
  { key: "ACTIVE", label: "Active" },
  { key: "DELAYED", label: "Delayed" },
  { key: "DELIVERED", label: "Delivered" },
];

export default function ShipmentBoard({ userRole = "ADMIN" }) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const handleSaveShipment = async (newShipmentData) => {
    console.log("Saving data to DB:", newShipmentData);
    try {
      const results = await createShipmentWithSequence(newShipmentData);
      console.log("Function results:", results);
    } catch (error) {
      console.error("Error creating shipment:", error);
    }
  };

  const fetchShipments = async () => {
    try {
      setLoading(true);

      const res = await getListShipments();
      const data = res.data.records;

      const formatted = data.map((s) => ({
        ...s,
        route: s.route || `${s.origin} → ${s.destination}`,
        startedAt: formatFirestoreDate(s.startedAt),
        lastUpdate:
          formatFirestoreDate(s.updatedAt) ||
          formatFirestoreDate(s.delayStartedAt) ||
          "No Data",
        progress: calculateProgress(s.status),
      }));

      setShipments(formatted);
    } catch (err) {
      console.error("Failed to fetch shipments:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- 1. REAL-TIME LISTENER ---
  useEffect(() => {
    fetchShipments();
  }, []);

  // --- 2. FILTER LOGIC ---
  const filteredShipments = useMemo(() => {
    console.log("Filtering shipments with:", shipments);
    return shipments?.filter((s) => {
      const searchContent = [s.tracking, s.route, s.owner]
        .filter(Boolean) // remove null / undefined
        .join(" ") // safe string
        .toLowerCase();
      if (!searchContent.includes(searchQuery.toLowerCase())) return false;

      if (activeFilter === "ALL") return true;
      if (activeFilter === "ACTIVE") return s.status !== "DELIVERED";
      if (activeFilter === "DELAYED") return s.delayReason && !s.delayCleared;
      if (activeFilter === "DELIVERED") return s.status === "DELIVERED";

      return true;
    });
  }, [searchQuery, activeFilter, shipments]);

  const selectedShipment = shipments.find((s) => s.id === selectedId);

  const GRID_COLS = "grid-cols-[320px_160px_260px_200px_160px_80px]";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <h1 className="font-bold text-white tracking-wide text-lg">
              Shipments
            </h1>
            {loading && (
              <FontAwesomeIcon
                icon={faSync}
                spin
                className="text-slate-500 text-xs"
              />
            )}
          </div>

          <div className="flex flex-1 w-full md:w-auto gap-3 justify-end">
            <div className="relative flex-1 md:max-w-md">
              <span className="absolute left-3 top-2.5 text-slate-500">
                <FontAwesomeIcon icon={faSearch} />
              </span>
              <input
                type="text"
                placeholder="Search..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {userRole === "ADMIN" && (
              <>
                <button className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white">
                  <FontAwesomeIcon icon={faFileCsv} />
                </button>
                <button className="h-9 px-3 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white">
                  <FontAwesomeIcon icon={faCommentSms} />
                </button>
              </>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="max-w-7xl mx-auto mt-6 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
                activeFilter === f.key
                  ? "bg-blue-500/10 border-blue-500/50 text-blue-400"
                  : "bg-slate-900 border-slate-800 text-slate-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}

      <main className="max-w-7xl mx-auto p-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800 bg-slate-900/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-4">Tracking / Signal</div>
            <div className="col-span-2">Route</div>
            <div className="col-span-3">Status Flow</div>
            <div className="col-span-2">Last Updated</div>
            <div className="col-span-1 text-right">Action</div>
          </div>
          <div>
            {loading ? (
              <div className="p-10 text-center text-slate-500">
                Loading shipments...
              </div>
            ) : filteredShipments.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                No shipments found.
              </div>
            ) : (
              filteredShipments.map((s) => (
                <ShipmentRow key={s.id} s={s} onClick={setSelectedId} />
              ))
            )}
          </div>
        </div>
      </main>

      <ShipmentDrawer
        isOpen={!!selectedId}
        onClose={() => setSelectedId(null)}
        data={selectedShipment}
      />
      {/* THE MODAL COMPONENT */}
      <ShipmentNewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveShipment}
      />
    </div>
  );
}

function calculateProgress(status) {
  switch (status) {
    case "CREATED":
      return 10;
    case "RECEIVED":
      return 25;
    case "LOADED":
      return 40;
    case "IN_TRANSIT":
      return 60;
    case "ARRIVED_PORT":
      return 75;
    case "OUT_FOR_DELIVERY":
      return 90;
    case "DELIVERED":
      return 100;
    default:
      return 0;
  }
}
