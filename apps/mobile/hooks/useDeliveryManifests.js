import { useCheckerLastMile } from "../contexts/CheckerLastMileContext";

export {
  computeManifestStats,
  deriveManifestDisplayStatus,
} from "./useCheckerLastMileSync";

/** @deprecated Use fetchShipmentsByIds from components/utilities/fetchShipmentsByIds */
export { fetchShipmentsByIds } from "../components/utilities/fetchShipmentsByIds";

export function useDeliveryManifests() {
  const { manifests, summary, loading, error } = useCheckerLastMile();

  return {
    manifests,
    summary,
    loading,
    error,
  };
}
