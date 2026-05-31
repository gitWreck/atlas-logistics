import DeliveryLoadScreen from "../../components/checker/DeliveryLoadScreen";
import { CheckerLastMileProvider } from "../../contexts/CheckerLastMileContext";

export default function DeliveryManifestPage() {
  return (
    <CheckerLastMileProvider>
      <DeliveryLoadScreen showBackButton />
    </CheckerLastMileProvider>
  );
}
