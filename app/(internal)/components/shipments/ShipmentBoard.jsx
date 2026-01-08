"use client";
import React, { useState, useMemo, useEffect } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import formatFirestoreDate from "../utility/FormatFirestoreDate";

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

  const handleSaveShipment = (newShipmentData) => {
    console.log("Saving data to DB:", newShipmentData);
  };

  // --- 1. REAL-TIME LISTENER ---
  useEffect(() => {
    setLoading(true);

    // 1. Prepare references
    // Replace "shipment_details" with the actual name of your second collection
    const detailsRef = collection(db, "tracking_public");
    const trackingRef = collection(db, "tracking_records");

    // We need to store the data from both collections temporarily
    let detailsMap = {};
    let trackingDocs = [];

    // Helper function to merge and update state
    const mergeAndSetShipments = () => {
      if (trackingDocs.length === 0) return;

      const combinedData = trackingDocs.map((doc) => {
        const t = doc.data(); // Data from tracking_records

        // Find matching data in the second collection using Tracking Number
        // (Adjust 'trackingNumber' if the field name is different in your DB)
        const detail = detailsMap[t.trackingNumber] || {};

        // PRIORITY: detail (new data) overwrites t (tracking_record) if fields exist
        const merged = { ...t, ...detail };

        return {
          id: doc.id,
          // --- CORE IDENTIFIERS ---
          tracking: merged.trackingNumber || doc.id,
          tripId: merged.tripId || "Unassigned",

          // --- ROUTE INFO ---
          origin: merged.origin || "Unknown",
          destination: merged.destination || "Unknown",
          route: `${merged.origin || "?"} → ${merged.destination || "?"}`,

          // --- STATUS & DELAYS ---
          status: merged.status || "UNKNOWN",
          delayReason: merged.delayReason || null,
          delayCleared: merged.delayCleared || false,

          // --- PEOPLE ---
          driver: merged.driverName || "Unassigned",
          customer: merged.customerName || "Unknown",

          lastUpdate:
            formatFirestoreDate(merged.updatedAt) ||
            formatFirestoreDate(merged.delayStartedAt) ||
            "No Data",

          startedAt: formatFirestoreDate(merged.startedAt),

          totals: merged.totals || { loaded: 0, pending: 0, received: 0 },
          progress: calculateProgress(merged.status), // Ensure this function exists

          ...merged,
        };
      });

      setShipments(combinedData);
      setLoading(false);
    };

    // 2. LISTEN TO COLLECTION B (The Detailed Data)
    const unsubscribeDetails = onSnapshot(detailsRef, (snapshot) => {
      detailsMap = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.trackingNumber) {
          detailsMap[data.trackingNumber] = data;
        }
      });
      mergeAndSetShipments();
    });

    // 3. LISTEN TO COLLECTION A (The Main Tracking Records)
    const unsubscribeTracking = onSnapshot(trackingRef, (snapshot) => {
      trackingDocs = snapshot.docs;
      mergeAndSetShipments();
    });

    return () => {
      unsubscribeDetails();
      unsubscribeTracking();
    };
  }, []);

  // useEffect(() => {
  //   setLoading(true);

  //   const q = collection(db, "tracking_records");

  //   const unsubscribe = onSnapshot(q, (snapshot) => {
  //     const liveData = snapshot.docs.map((doc) => {
  //       const d = doc.data();

  //       // MAPPING: Matching exact Firestore fields
  //       return {
  //         id: doc.id,
  //         tracking: d.trackingNumber || doc.id,

  //         route: d.route || `${d.origin} → ${d.destination}`,
  //         routeCode: `${d.origin}-${d.destination}`,

  //         status: d.status || "UNKNOWN",

  //         delayReason: d.delayReason || null,
  //         delayCleared: d.delayCleared || false,

  //         trip: d.driverName || "Unassigned",
  //         owner: d.customerName || "Unknown",

  //         lastUpdate: d.delayStartedAt?.seconds
  //           ? new Date(d.delayStartedAt.seconds * 1000).toLocaleDateString()
  //           : "No Date",

  //         progress: calculateProgress(d.status),
  //         ...d,
  //       };
  //     });

  //     setShipments(liveData);
  //     setLoading(false);
  //   });

  //   return () => unsubscribe();
  // }, []);

  // --- 2. FILTER LOGIC ---
  const filteredShipments = useMemo(() => {
    console.log("Filtering shipments with:", shipments);
    return shipments.filter((s) => {
      const searchContent = (s.tracking + s.route + s.owner).toLowerCase();
      if (!searchContent.includes(searchQuery.toLowerCase())) return false;

      if (activeFilter === "ALL") return true;
      if (activeFilter === "ACTIVE") return s.status !== "DELIVERED";
      if (activeFilter === "DELAYED") return s.delayReason && !s.delayCleared;
      if (activeFilter === "DELIVERED") return s.status === "DELIVERED";

      return true;
    });
  }, [searchQuery, activeFilter, shipments]);

  const selectedShipment = shipments.find((s) => s.id === selectedId);

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

            {/* THE MODAL COMPONENT */}
            <ShipmentNewModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onSave={handleSaveShipment}
            />
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
            <div className="col-span-2">Delay Info</div>
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
