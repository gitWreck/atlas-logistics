import React from "react";
import ShipmentListScreen from "../../components/trips/TripShipments";
import { DRIVER_SHIPMENT_FILTER } from "../../components/constants/templates";

export default function DriverTripShipmentsPage() {
  return (
    <ShipmentListScreen
      // mode="driver"
      filterOptions={DRIVER_SHIPMENT_FILTER}
      enableBulkActions={false}
      enableScanActions={false}
      enableShipmentMenu={false}
    />
  );
}
