import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel } from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";

export default function ExportTripButton({ trip, shipments }) {
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    if (shipments?.length) {
      fetchFullShipmentDetails(shipments[0].id);
    } else {
      setPackages([]);
    }
  }, [shipments]);

  const fetchFullShipmentDetails = async (id) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/shipments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setPackages(json.shipment?.packages || []);
    } catch (err) {
      console.error("Error fetching packages:", err);
    }
  };

  // console.log("ExportTripButton received trip:", trip);
  // console.log("ExportTripButton received shipments:", shipments);

  const handleExport = () => {
    if (!trip || !shipments || shipments.length === 0) {
      alert("No data to export.");
      return;
    }

    // 1. Prepare Header Info (Trip Details)
    // We add these as the first few rows
    const tripInfo = [
      ["TRIP MANIFEST"],
      ["Trip ID:", trip.id],
      ["Driver:", trip.driverName || "Unassigned"],
      ["Plate #:", trip.truckPlate || trip.plateNumber || "—"],
      ["Date:", new Date().toLocaleDateString()],
      [""], // Empty row for spacing
    ];

    // 2. Prepare Table Headers
    const tableHeaders = [
      "Tracking Number",
      "Sender",
      "Recipient",
      "Destination",
      "Package Count",
      "Weight (KG)",
      "Status",
      "Description",
    ];

    // 3. Flatten Data (Map shipments to rows)
    const rows = shipments.map((s) => [
      s.trackingNumber,
      s.sender?.name || "—",
      s.recipient?.name || "—",
      s.recipient?.address?.city || "—",
      packages?.length || 1, // Count
      s.totalWeight ||
        packages?.reduce((sum, p) => sum + (Number(p.weight) || 0), 0),
      s.status,
      packages?.map((p) => p.description).join(", "), // Combine descriptions
    ]);

    // 4. Combine All Data
    const finalData = [...tripInfo, tableHeaders, ...rows];

    // 5. Create Worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(finalData);

    // OPTIONAL: Basic Column Widths (Visually nicer)
    worksheet["!cols"] = [
      { wch: 20 }, // Tracking
      { wch: 20 }, // Sender
      { wch: 20 }, // Recipient
      { wch: 15 }, // Dest
      { wch: 10 }, // Count
      { wch: 10 }, // Weight
      { wch: 15 }, // Status
      { wch: 30 }, // Desc
    ];

    // 6. Create Workbook & Append Sheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Manifest");

    // 7. Generate File Download
    XLSX.writeFile(workbook, `Manifest_${trip.tripId || "Trip"}.xlsx`);
  };

  return (
    <button
      onClick={handleExport}
      className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
      title="Download Excel"
    >
      <FontAwesomeIcon icon={faFileExcel} />
      <span>Export Excel</span>
    </button>
  );
}
