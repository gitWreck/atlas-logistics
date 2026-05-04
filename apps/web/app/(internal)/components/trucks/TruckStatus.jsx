import StatusCard from "../ui/StatusCard";
import {
  faTruck,
  faTools,
  faCheckCircle,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";

const SERVICE_INTERVAL_KM = 5000;
const CRITICAL_PMS_THRESHOLD_KM = 500;

function getPmsRemainingKm(truck) {
  const currentOdometer = Number(truck.currentOdometer) || 0;
  const lastPmsOdometer = Number(truck.lastPmsOdometer) || 0;

  const distanceSincePms =
    currentOdometer > 0 && lastPmsOdometer >= 0
      ? Math.max(currentOdometer - lastPmsOdometer, 0)
      : 0;

  return Math.max(SERVICE_INTERVAL_KM - distanceSincePms, 0);
}

export default function TruckStatus({ trucks = [], isDark = false }) {
  const total = trucks.length;
  const inTransit = trucks.filter((t) => t.status === "IN_TRANSIT").length;
  const repair = trucks.filter((t) => t.status === "MAINTENANCE").length;
  const critical = trucks.filter(
    (t) => getPmsRemainingKm(t) <= CRITICAL_PMS_THRESHOLD_KM,
  ).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatusCard
        title="Total Trucks"
        value={total}
        icon={faTruck}
        color="text-blue-500"
        bg="bg-blue-500/10"
        isDark={isDark}
      />
      <StatusCard
        title="In Transit"
        value={inTransit}
        icon={faCheckCircle}
        color="text-emerald-500"
        bg="bg-emerald-500/10"
        isDark={isDark}
      />
      <StatusCard
        title="Under Repair"
        value={repair}
        icon={faTools}
        color="text-amber-500"
        bg="bg-amber-500/10"
        isDark={isDark}
      />
      <StatusCard
        title="Critical PMS"
        value={critical}
        icon={faExclamationTriangle}
        color="text-red-500"
        bg="bg-red-500/10"
        isDark={isDark}
      />
    </div>
  );
}
