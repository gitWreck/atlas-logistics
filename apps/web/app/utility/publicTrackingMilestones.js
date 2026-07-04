import {
  faBoxOpen,
  faTruckFast,
  faWarehouse,
  faTruckRampBox,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";
import { WAREHOUSES } from "@/app/utility/WarehouseData";

function warehouseByCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return null;
  return WAREHOUSES.find((hub) => hub.code === normalized) || null;
}

function resolveOriginHubName(data = {}) {
  const fromCode = warehouseByCode(data.originCode);
  if (fromCode) return fromCode.name;

  const origin = String(data.origin || data.originName || "").trim();
  if (/divisoria/i.test(origin)) return "Divisoria";
  if (origin) return origin.replace(/\s+warehouse$/i, "").trim();
  return "Origin";
}

export function resolveDestinationHubName(data = {}) {
  const hubFromCode = warehouseByCode(data.destinationCode);
  if (hubFromCode) return hubFromCode.name;

  const originCode = String(data.originCode || "").trim().toUpperCase();
  if (originCode === "DIV") return "Odiongan";

  const destination = String(data.destination || data.destinationName || "").trim();
  if (/odiongan/i.test(destination)) {
    return destination.replace(/\s+warehouse$/i, "").trim();
  }

  // Tablas lane: customer town is not the hub — cargo is received at Odiongan.
  return "Odiongan";
}

function formatReceivedAtHub(hubName) {
  const trimmed = String(hubName || "").trim() || "warehouse";
  if (/warehouse/i.test(trimmed)) return `Received at ${trimmed}`;
  return `Received at ${trimmed} Warehouse`;
}

export function buildPublicTrackingMilestones(data = {}) {
  const originHub = resolveOriginHubName(data);
  const destinationHub = resolveDestinationHubName(data);

  return [
    {
      val: 0,
      label: formatReceivedAtHub(originHub),
      shortLabel: "Divisoria",
      icon: faBoxOpen,
      color: "text-cyan-400",
      border: "border-cyan-500",
      bg: "bg-cyan-500",
    },
    {
      val: 25,
      label: `In Transit to ${destinationHub}`,
      shortLabel: "In Transit",
      icon: faTruckFast,
      color: "text-blue-400",
      border: "border-blue-500",
      bg: "bg-blue-500",
    },
    {
      val: 50,
      label: formatReceivedAtHub(destinationHub),
      shortLabel: destinationHub,
      icon: faWarehouse,
      color: "text-sky-400",
      border: "border-sky-500",
      bg: "bg-sky-500",
    },
    {
      val: 75,
      label: "Out for Delivery",
      shortLabel: "Out for Delivery",
      icon: faTruckRampBox,
      color: "text-purple-400",
      border: "border-purple-500",
      bg: "bg-purple-500",
    },
    {
      val: 100,
      label: "Delivered",
      shortLabel: "Delivered",
      icon: faCheckCircle,
      color: "text-emerald-400",
      border: "border-emerald-500",
      bg: "bg-emerald-500",
    },
  ];
}

export function getMilestoneStepState(progress, index, milestones = []) {
  const val = milestones[index]?.val ?? 0;
  const nextVal = milestones[index + 1]?.val ?? 101;
  return {
    isActive: progress >= val && progress < nextVal,
    isPast: progress >= nextVal,
  };
}
