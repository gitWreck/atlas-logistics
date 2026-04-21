import React from "react";
import * as XLSX from "xlsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel } from "@fortawesome/free-solid-svg-icons";

function formatDate(value) {
  if (!value) return "—";

  try {
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleDateString();
    }

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  } catch {
    return "—";
  }
}

function getShipmentQuantity(shipment = {}) {
  return Number(
    shipment?.totals?.totalContentQty ??
      shipment?.totalItems ??
      shipment?.totalContentQty ??
      0,
  );
}

function getShipmentDescription(shipment = {}) {
  if (Array.isArray(shipment?.packages) && shipment.packages.length > 0) {
    return shipment.packages
      .map((pkg) => {
        const qty = Number(pkg.quantity) || 1;
        const desc = pkg.description || "Package";
        return qty > 1 ? `${desc} (${qty})` : desc;
      })
      .join(", ");
  }

  if (Array.isArray(shipment?.items) && shipment.items.length > 0) {
    return shipment.items
      .map((item) => {
        const qty = Number(item.quantity) || 1;
        const desc = item.description || "Item";
        return qty > 1 ? `${desc} (${qty})` : desc;
      })
      .join(", ");
  }

  return "—";
}

function getDestination(shipment = {}) {
  return shipment?.recipient?.address?.city || shipment?.destination || "—";
}

function getShipmentDisplayId(shipment = {}) {
  return shipment?.shipmentId || shipment?.id || "—";
}

export default function ExportTripButton({ trip, shipments = [] }) {
  const handleExport = () => {
    if (!trip || !Array.isArray(shipments) || shipments.length === 0) {
      alert("No data to export.");
      return;
    }

    const tripLabel = trip.tripId || trip.id || "Trip";

    const tripInfo = [
      ["TRIP MANIFEST"],
      [""],
      ["Trip ID:", tripLabel],
      ["Driver:", trip.driverName || trip.driver?.name || "Unassigned"],
      ["Plate #:", trip.truckPlate || trip.truckPlateNumber || "—"],
      [
        "Route:",
        trip.route ||
          `${trip.originCode || trip.origin || "—"} -> ${trip.destinationCode || trip.destination || "—"}`,
      ],
      [
        "Departure:",
        formatDate(trip.plannedDeparture || trip.departure || trip.createdAt),
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
      shipment?.sender?.name || "—",
      shipment?.recipient?.name || "—",
      getDestination(shipment),
      getShipmentQuantity(shipment),
      shipment?.status || "—",
      getShipmentDescription(shipment),
    ]);

    const totalsRow = [
      "TOTAL",
      "",
      "",
      "",
      rows.reduce((sum, row) => sum + (Number(row[4]) || 0), 0),
      rows.reduce((sum, row) => sum + (Number(row[5]) || 0), 0),
      rows.reduce((sum, row) => sum + (Number(row[6]) || 0), 0),
      "",
      "",
    ];

    const finalData = [...tripInfo, tableHeaders, ...rows, totalsRow];

    const worksheet = XLSX.utils.aoa_to_sheet(finalData);

    worksheet["!cols"] = [
      { wch: 22 }, // Shipment ID
      { wch: 22 }, // Sender
      { wch: 22 }, // Recipient
      { wch: 18 }, // Destination
      { wch: 14 }, // Package Rows
      { wch: 12 }, // Actual Qty
      { wch: 12 }, // Weight
      { wch: 18 }, // Status
      { wch: 45 }, // Description
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Manifest");

    XLSX.writeFile(workbook, `Manifest_${tripLabel}.xlsx`);
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
