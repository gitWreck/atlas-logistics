import React, { useState } from "react";
import * as XLSX from "xlsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel } from "@fortawesome/free-solid-svg-icons";
import {
  EMPTY_EXPORT_VALUE,
  formatExportDate,
  getDestination,
  getShipmentDescription,
  getShipmentDisplayId,
  getShipmentQuantity,
} from "./exportHelpers";

export default function ExportTripButton({ trip, user }) {
  const [exporting, setExporting] = useState(false);

  const fetchManifest = async (tripId) => {
    const token = await user?.getIdToken();
    const res = await fetch(`/api/trips/${tripId}/shipments`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson?.error || "Failed to fetch trip manifest.");
    }

    return res.json();
  };

  const handleExport = async () => {
    if (!trip?.tripId) {
      alert("Trip not found.");
      return;
    }

    setExporting(true);

    try {
      const targetTripId = trip.tripId;
      const { trip: fullTrip, shipments } = await fetchManifest(targetTripId);

      if (!fullTrip || !Array.isArray(shipments) || shipments.length === 0) {
        alert("No shipments found for this trip.");
        return;
      }

      const tripLabel = fullTrip.tripId || "Trip";

      const tripInfo = [
        ["TRIP MANIFEST"],
        [""],
        ["Trip ID:", tripLabel],
        [
          "Driver:",
          fullTrip.driverName || fullTrip.driver?.name || "Unassigned",
        ],
        [
          "Plate #:",
          fullTrip.truckPlate ||
            fullTrip.truckPlateNumber ||
            EMPTY_EXPORT_VALUE,
        ],
        [
          "Route:",
          fullTrip.route ||
            `${fullTrip.originCode || fullTrip.origin || EMPTY_EXPORT_VALUE} -> ${
              fullTrip.destinationCode ||
              fullTrip.destination ||
              EMPTY_EXPORT_VALUE
            }`,
        ],
        [
          "Departure:",
          formatExportDate(
            fullTrip.plannedDeparture ||
              fullTrip.departure ||
              fullTrip.createdAt,
          ),
        ],
        ["Exported At:", new Date().toLocaleString()],
        [""],
      ];

      const tableHeaders = [
        "Shipment ID",
        "Sender",
        "Recipient",
        "Destination",
        "Actual Qty",
        "Status",
        "Description",
      ];

      const rows = shipments.map((shipment) => [
        getShipmentDisplayId(shipment),
        shipment?.sender?.name || EMPTY_EXPORT_VALUE,
        shipment?.recipient?.name || EMPTY_EXPORT_VALUE,
        getDestination(shipment),
        getShipmentQuantity(shipment),
        shipment?.status || EMPTY_EXPORT_VALUE,
        getShipmentDescription(shipment),
      ]);

      const totalQty = rows.reduce(
        (sum, row) => sum + (Number(row[4]) || 0),
        0,
      );

      const totalsRow = ["TOTAL", "", "", "", totalQty, "", ""];

      const finalData = [...tripInfo, tableHeaders, ...rows, totalsRow];
      const worksheet = XLSX.utils.aoa_to_sheet(finalData);

      worksheet["!cols"] = [
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 18 },
        { wch: 12 },
        { wch: 18 },
        { wch: 45 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Manifest");

      XLSX.writeFile(workbook, `Manifest_${tripLabel}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
      alert(err.message || "Failed to export trip manifest.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="bg-green-600 hover:bg-green-500 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
      title="Download Excel"
    >
      <FontAwesomeIcon icon={faFileExcel} />
      <span>{exporting ? "Exporting..." : "Export Excel"}</span>
    </button>
  );
}
