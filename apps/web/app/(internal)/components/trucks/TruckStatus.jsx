import StatusCard from "../ui/StatusCard";
import {
  faTruck,
  faTools,
  faCheckCircle,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";

export default function TruckStatus({ trucks = [], isDark = false }) {
  // Logic to calculate counts from your truck array
  const total = trucks.length;
  const active = trucks.filter((t) => t.status === "ACTIVE").length;
  const repair = trucks.filter((t) => t.status === "MAINTENANCE").length;
  const critical = trucks.filter((t) => t.pmsRemaining <= 0).length;

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
        value={active}
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
