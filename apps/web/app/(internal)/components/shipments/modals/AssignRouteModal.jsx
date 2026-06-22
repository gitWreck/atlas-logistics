"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  assignRoute,
  listDeliveryRoutes,
} from "@/app/utility/FirebaseFunctions";
import { getRecipientMunicipality } from "@/app/utility/deliveryRoutes";

function parseIds(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[\n,]/g)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

export default function AssignRouteModal({
  isOpen,
  onClose,
  onSuccess,
  isDark = false,
  defaultShipmentIds = [],
  defaultShipments = [],
}) {
  const [routes, setRoutes] = useState([]);
  const [routeId, setRouteId] = useState("");
  const [mode, setMode] = useState("shipment");
  const [shipmentIdsInput, setShipmentIdsInput] = useState("");
  const [packageIdsInput, setPackageIdsInput] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    setShipmentIdsInput((defaultShipmentIds || []).join("\n"));
    setPackageIdsInput("");
    setMunicipality("");
    setRouteId("");
    setError("");
    setSuggestion(null);

    const inferredMunicipality = (defaultShipments || [])
      .map((shipment) => getRecipientMunicipality(shipment))
      .find(Boolean);
    if (inferredMunicipality) {
      setMunicipality(inferredMunicipality);
    }

    setLoadingRoutes(true);
    listDeliveryRoutes({ warehouseId: "ODIONGAN_WAREHOUSE" })
      .then((response) => {
        const nextRoutes = response?.data?.routes || [];
        setRoutes(nextRoutes);
      })
      .catch((fetchError) => {
        setError(fetchError.message || "Could not load delivery routes.");
      })
      .finally(() => setLoadingRoutes(false));
  }, [defaultShipmentIds, defaultShipments, isOpen]);

  const parsedShipmentIds = useMemo(
    () => parseIds(shipmentIdsInput),
    [shipmentIdsInput],
  );
  const parsedPackageIds = useMemo(
    () => parseIds(packageIdsInput),
    [packageIdsInput],
  );

  const canSubmit =
    !submitting &&
    !loadingRoutes &&
    (mode === "municipality"
      ? Boolean(String(municipality || "").trim())
      : mode === "package"
        ? parsedPackageIds.length > 0
        : parsedShipmentIds.length > 0);

  if (!isOpen) return null;

  const overlayClass = isDark
    ? "fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4"
    : "fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[120] flex items-center justify-center p-4";
  const modalClass = isDark
    ? "w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-2xl"
    : "w-full max-w-2xl rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl";
  const inputClass = isDark
    ? "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
    : "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500";
  const labelClass = isDark
    ? "text-xs text-slate-400 mb-1"
    : "text-xs text-slate-600 mb-1";

  const handleSuggest = async () => {
    setSubmitting(true);
    setError("");
    setSuggestion(null);

    try {
      const payload = {
        suggestOnly: true,
        warehouseId: "ODIONGAN_WAREHOUSE",
      };

      if (mode === "municipality") {
        payload.municipality = municipality.trim();
      } else if (mode === "package") {
        payload.packageIds = parsedPackageIds;
      } else {
        payload.shipmentIds = parsedShipmentIds;
      }

      if (routeId) payload.routeId = routeId;

      const response = await assignRoute(payload);
      const suggestions = response?.data?.suggestions || [];
      setSuggestion(suggestions);

      const firstSuggestedRouteId =
        suggestions[0]?.suggestedRouteId ||
        suggestions[0]?.suggestedRoutes?.[0]?.routeId;
      if (!routeId && firstSuggestedRouteId) {
        setRouteId(firstSuggestedRouteId);
      }
    } catch (submitError) {
      setError(submitError.message || "Could not suggest a route.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        confirm: true,
        warehouseId: "ODIONGAN_WAREHOUSE",
      };

      if (routeId) payload.routeId = routeId;

      if (mode === "municipality") {
        payload.municipality = municipality.trim();
      } else if (mode === "package") {
        payload.packageIds = parsedPackageIds;
      } else {
        payload.shipmentIds = parsedShipmentIds;
      }

      const response = await assignRoute(payload);
      if (!response?.data?.success) {
        throw new Error("Route assignment did not complete.");
      }

      onSuccess?.(response.data);
      onClose?.();
    } catch (submitError) {
      setError(submitError.message || "Route assignment failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={overlayClass}>
      <div className={modalClass}>
        <div
          className={`px-5 py-4 border-b ${isDark ? "border-slate-800" : "border-slate-200"}`}
        >
          <h3 className="text-lg font-bold">Assign delivery route</h3>
          <p
            className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}
          >
            All pieces in a shipment inherit the same route unless you assign by
            package ID. Checkers cannot load until every piece has a route.
          </p>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className={labelClass}>Assignment mode</label>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              className={inputClass}
            >
              <option value="shipment">Per shipment</option>
              <option value="package">Per package ID</option>
              <option value="municipality">Bulk by municipality</option>
            </select>
          </div>

          {mode === "shipment" && (
            <div>
              <label className={labelClass}>Shipment IDs</label>
              <textarea
                value={shipmentIdsInput}
                onChange={(event) => setShipmentIdsInput(event.target.value)}
                rows={4}
                placeholder="One shipment ID per line"
                className={inputClass}
              />
            </div>
          )}

          {mode === "package" && (
            <div>
              <label className={labelClass}>Package IDs</label>
              <textarea
                value={packageIdsInput}
                onChange={(event) => setPackageIdsInput(event.target.value)}
                rows={4}
                placeholder="AT-20260612-SHP-677769-09"
                className={inputClass}
              />
            </div>
          )}

          {mode === "municipality" && (
            <div>
              <label className={labelClass}>Municipality</label>
              <input
                value={municipality}
                onChange={(event) => setMunicipality(event.target.value)}
                placeholder="San Andres"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Route</label>
            <select
              value={routeId}
              onChange={(event) => setRouteId(event.target.value)}
              className={inputClass}
              disabled={loadingRoutes}
            >
              <option value="">
                {loadingRoutes ? "Loading routes..." : "Auto-suggest from municipality"}
              </option>
              {routes.map((route) => (
                <option key={route.routeId} value={route.routeId}>
                  {route.routeName} ({route.routeId})
                </option>
              ))}
            </select>
          </div>

          {suggestion?.length > 0 && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${isDark ? "border-slate-700 bg-slate-950 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700"}`}
            >
              {suggestion.map((entry) => (
                <div key={entry.shipmentId} className="py-1">
                  <span className="font-mono">{entry.shipmentId}</span>
                  {entry.suggestedRouteName ? (
                    <span> → {entry.suggestedRouteName}</span>
                  ) : null}
                  {Array.isArray(entry.suggestedRoutes) &&
                  entry.suggestedRoutes.length > 1 ? (
                    <span>
                      {" "}
                      — multiple matches:{" "}
                      {entry.suggestedRoutes
                        .map((route) => route.routeName)
                        .join(", ")}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {error ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : null}
        </div>

        <div
          className={`px-5 py-4 border-t flex flex-wrap justify-end gap-2 ${isDark ? "border-slate-800" : "border-slate-200"}`}
        >
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${isDark ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSuggest}
            disabled={!canSubmit || submitting}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-600 text-white hover:bg-slate-500 disabled:opacity-50"
          >
            Suggest route
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? "Assigning..." : "Confirm assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}
