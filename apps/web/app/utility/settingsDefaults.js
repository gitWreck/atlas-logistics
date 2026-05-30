import { WAREHOUSES } from "./WarehouseData";
import { PH_LOCATIONS } from "./PhilippinesData";

export const DEFAULT_TRUCK_TYPES = [
  "12-Wheeler Wing Van",
  "12-Wheeler Closed Van",
  "10-Wheeler Wing Van",
  "10-Wheeler Dropside",
  "8-Wheeler Wing Van",
  "6-Wheeler Closed Van",
  "6-Wheeler Boom Truck",
  "6-Wheeler Wing Van",
  "4-Wheeler Reefer",
];

export const DEFAULT_OPERATIONAL_SETTINGS = {
  truckTypes: DEFAULT_TRUCK_TYPES,
  warehouses: WAREHOUSES,
  phLocations: PH_LOCATIONS,
};

export function normalizeOperationalSettings(data = {}) {
  return {
    truckTypes: Array.isArray(data.truckTypes) && data.truckTypes.length
      ? data.truckTypes
      : DEFAULT_OPERATIONAL_SETTINGS.truckTypes,
    warehouses: Array.isArray(data.warehouses) && data.warehouses.length
      ? data.warehouses
      : DEFAULT_OPERATIONAL_SETTINGS.warehouses,
    phLocations:
      data.phLocations &&
      typeof data.phLocations === "object" &&
      !Array.isArray(data.phLocations) &&
      Object.keys(data.phLocations).length
        ? data.phLocations
        : DEFAULT_OPERATIONAL_SETTINGS.phLocations,
  };
}
