import React from "react";
import ShipmentListScreen from "../../components/trips/TripShipments";
import { CHECKER_SHIPMENT_FILTER } from "../../components/constants/templates";

export default function CheckerTripShipmentsPage() {
  return (
    <ShipmentListScreen
      filterOptions={CHECKER_SHIPMENT_FILTER}
      enableBulkActions={true}
      enableScanActions={true}
      enableShipmentMenu={true}
    />
  );
}
