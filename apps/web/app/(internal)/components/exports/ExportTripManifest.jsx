import React, { useState } from "react";
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
      shipment?.totalContentQty ??
      shipment?.totalItems ??
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
        ["Plate #:", fullTrip.truckPlate || fullTrip.truckPlateNumber || "—"],
        [
          "Route:",
          fullTrip.route ||
            `${fullTrip.originCode || fullTrip.origin || "—"} -> ${fullTrip.destinationCode || fullTrip.destination || "—"}`,
        ],
        [
          "Departure:",
          formatDate(
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
        shipment?.sender?.name || "—",
        shipment?.recipient?.name || "—",
        getDestination(shipment),
        getShipmentQuantity(shipment),
        shipment?.status || "—",
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
        { wch: 22 }, // Shipment ID
        { wch: 22 }, // Sender
        { wch: 22 }, // Recipient
        { wch: 18 }, // Destination
        { wch: 12 }, // Actual Qty
        { wch: 18 }, // Status
        { wch: 45 }, // Description
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
