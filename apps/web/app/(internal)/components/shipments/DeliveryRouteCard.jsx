"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRoute } from "@fortawesome/free-solid-svg-icons";
import {
  getPackageRouteLabel,
  summarizeShipmentRouteAssignment,
} from "@/app/utility/deliveryRoutes";

export default function DeliveryRouteCard({
  shipment,
  isDark = false,
  canManage = false,
  onAssignRoute,
}) {
  if (!shipment) return null;

  const summary = summarizeShipmentRouteAssignment(shipment);
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const routeNames = [
    ...new Set(
      packages
        .map((pkg) => getPackageRouteLabel(pkg))
        .filter((label) => label !== "Unassigned Route"),
    ),
  ];

  const boxClass = isDark
    ? "border border-slate-800 bg-slate-900/60 rounded-xl p-4"
    : "border border-slate-200 bg-slate-50 rounded-xl p-4";

  const showCard =
    summary.totalPool > 0 ||
    routeNames.length > 0 ||
    shipment.assignedRouteName;

  if (!showCard) return null;

  return (
    <div className={boxClass}>
      <div className="flex items-start justify-between gap-3">
        <h3
          className={`text-sm font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}
        >
          <FontAwesomeIcon icon={faRoute} className="text-sky-500" />
          Delivery route
        </h3>
        {canManage && onAssignRoute && summary.totalPool > 0 && (
          <button
            type="button"
            onClick={onAssignRoute}
            className="text-xs font-semibold rounded-lg bg-sky-600 text-white px-3 py-1.5 hover:bg-sky-500"
          >
            Assign route
          </button>
        )}
      </div>

      <div className={`mt-3 space-y-1 text-xs ${isDark ? "text-slate-300" : "text-slate-700"}`}>
        {summary.totalPool > 0 ? (
          <p>
            {summary.assigned}/{summary.totalPool} pool pieces assigned
            {summary.unassigned > 0 ? (
              <span className="text-amber-500 font-semibold">
                {" "}
                — {summary.unassigned} unassigned
              </span>
            ) : null}
          </p>
        ) : null}

        {routeNames.length > 0 ? (
          <p>
            Routes:{" "}
            <span className="font-semibold">{routeNames.join(", ")}</span>
          </p>
        ) : summary.unassigned > 0 ? (
          <p className="text-amber-500 font-semibold">Unassigned Route</p>
        ) : null}

        {shipment.assignedRouteName ? (
          <p className={`${isDark ? "text-slate-400" : "text-slate-600"}`}>
            Shipment default: {shipment.assignedRouteName}
          </p>
        ) : null}
      </div>
    </div>
  );
}
