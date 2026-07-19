import ProfileViewer from "../profile/ProfileViewer";
import useDriverOperations from "../../hooks/useDriverOperations";
import { manilaDateKey } from "./driverData";

export default function DriverProfileScreen() {
  const operations = useDriverOperations(manilaDateKey());
  const trip = operations.activeTrip || operations.latestAssignedTrip;
  const vehicle = [
    trip?.truckName || trip?.truckType || trip?.vehicleType,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ProfileViewer
      compactTop
      minimalStaff
      driverAssignment={{
        municipality: trip?.municipality || trip?.destination || null,
        vehicle: vehicle || null,
        plateNumber: trip?.truckPlateNumber || trip?.plateNumber || null,
        route: [trip?.origin, trip?.destination].filter(Boolean).join(" to ") || trip?.route || null,
      }}
    />
  );
}
