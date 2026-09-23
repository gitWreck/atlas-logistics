import React from "react";
import { useLocalSearchParams } from "expo-router";
import ShipmentDetailsScreen from "../../components/shipments/ShipmentDetailsScreen";
import { useCheckerLastMile } from "../../contexts/CheckerLastMileContext";
import { selectCachedShipment } from "../../components/utilities/scanPerformance";

export default function CheckerShipmentDetailsPage() {
  const { shipmentId } = useLocalSearchParams();
  const { shipmentsById } = useCheckerLastMile();
  const initialShipment = selectCachedShipment(shipmentsById, shipmentId);

  return <ShipmentDetailsScreen initialShipment={initialShipment} />;
}
