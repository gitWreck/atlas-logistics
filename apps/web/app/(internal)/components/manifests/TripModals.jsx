import React from "react";
import DisableTripModal from "./modals/DisableTripModal";
import SplitShipmentModal from "./modals/SplitShipmentModal";
import AssignDriverModal from "./modals/AssignDriverModal";
import UnassignShipmentModal from "./modals/UnassignShipmentModal";
import OutcomeModal from "./modals/OutcomeModal";
import BulkAssignmentModal from "./modals/BulkAssignmentModal";

export default function TripModals({
  state, // Pass the whole state object or destructure
  actions, // Pass callbacks
  trip,
}) {
  return (
    <>
      <SplitShipmentModal
        isOpen={state.splitModalOpen}
        shipment={state.selectedShipment}
        onClose={() => actions.setSplitModalOpen(false)}
        onSuccess={() => {
          actions.fetchShipments();
          actions.setSplitModalOpen(false);
        }}
      />
      <AssignDriverModal
        isOpen={state.isDriverModalOpen}
        trip={trip}
        onClose={() => actions.setDriverModalOpen(false)}
        onSuccess={actions.onRefreshTrips}
      />
      <DisableTripModal
        isOpen={state.isDisableModalOpen}
        trip={trip}
        onClose={() => actions.setDisableModalOpen(false)}
        onSuccess={() => {
          actions.onRefreshTrips();
          actions.setDisableModalOpen(false);
        }}
      />
      <UnassignShipmentModal
        isOpen={!!state.shipmentToUnassign}
        shipment={state.shipmentToUnassign}
        tripId={trip?.tripId} // Ensure tripId is passed if needed
        onClose={() => actions.setShipmentToUnassign(null)}
        onSuccess={() => {
          actions.fetchShipments();
          actions.setShipmentToUnassign(null);
        }}
      />
      <OutcomeModal
        isOpen={state.outcome?.isOpen}
        onClose={actions?.closeOutcome}
        type={state.outcome?.type}
        title={state.outcome?.title}
        message={state.outcome?.message}
      />
      <BulkAssignmentModal
        isOpen={state.isBulkModalOpen}
        trip={trip}
        onClose={() => actions.setBulkModalOpen(false)}
        onSuccess={() => {
          actions.setBulkModalOpen(false);
          actions.handleRefresh(); // This refreshes the table & sidebar
        }}
      />
    </>
  );
}
