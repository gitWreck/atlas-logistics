"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faCircleNotch,
  faFloppyDisk,
  faLocationDot,
  faPlus,
  faTrash,
  faTruck,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";
import { cacheOperationalSettings } from "@/app/utility/useOperationalSettings";
import {
  DEFAULT_OPERATIONAL_SETTINGS,
  normalizeOperationalSettings,
} from "@/app/utility/settingsDefaults";

const emptyWarehouse = { name: "", code: "", city: "", province: "" };
const emptyCity = { name: "", code: "" };

export default function AdminSettingsBoard({ user, isDark = false }) {
  const [settings, setSettings] = useState(DEFAULT_OPERATIONAL_SETTINGS);
  const [activeTab, setActiveTab] = useState("truckTypes");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const theme = useMemo(
    () => ({
      page: isDark ? "text-slate-100" : "text-slate-900",
      panel: isDark
        ? "bg-slate-950/60 border-slate-800"
        : "bg-white border-slate-200",
      muted: isDark ? "text-slate-400" : "text-slate-500",
      input: isDark
        ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
        : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400",
      row: isDark
        ? "bg-slate-900/80 border-slate-800"
        : "bg-slate-50 border-slate-200",
      button: isDark
        ? "border-slate-700 hover:bg-slate-800"
        : "border-slate-300 hover:bg-slate-100",
    }),
    [isDark],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      setLoading(true);

      try {
        const res = await fetch("/api/app-settings", { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load settings");
        }

        const nextSettings = normalizeOperationalSettings(data.settings);

        if (isMounted) {
          setSettings(nextSettings);
          cacheOperationalSettings(nextSettings);
        }
      } catch (error) {
        setMessage(error.message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateTruckType = (index, value) => {
    setSettings((prev) => ({
      ...prev,
      truckTypes: prev.truckTypes.map((type, idx) =>
        idx === index ? value : type,
      ),
    }));
  };

  const updateWarehouse = (index, field, value) => {
    setSettings((prev) => ({
      ...prev,
      warehouses: prev.warehouses.map((warehouse, idx) =>
        idx === index ? { ...warehouse, [field]: value } : warehouse,
      ),
    }));
  };

  const updateCity = (province, index, field, value) => {
    setSettings((prev) => ({
      ...prev,
      phLocations: {
        ...prev.phLocations,
        [province]: prev.phLocations[province].map((city, idx) =>
          idx === index ? { ...city, [field]: value } : city,
        ),
      },
    }));
  };

  const addProvince = () => {
    const name = window.prompt("Province name");
    const trimmed = name?.trim();

    if (!trimmed) return;

    setSettings((prev) => ({
      ...prev,
      phLocations: prev.phLocations[trimmed]
        ? prev.phLocations
        : { ...prev.phLocations, [trimmed]: [{ ...emptyCity }] },
    }));
  };

  const confirmDelete = (label) => {
    return window.confirm(`Delete ${label}? This change is not saved until you click Save Settings.`);
  };

  const removeTruckType = (index, type) => {
    if (!confirmDelete(`truck type "${type || "this row"}"`)) return;

    setSettings((prev) => ({
      ...prev,
      truckTypes: prev.truckTypes.filter((_, idx) => idx !== index),
    }));
  };

  const removeWarehouse = (index, warehouse) => {
    if (!confirmDelete(`warehouse "${warehouse.name || warehouse.code || "this row"}"`)) return;

    setSettings((prev) => ({
      ...prev,
      warehouses: prev.warehouses.filter((_, idx) => idx !== index),
    }));
  };

  const removeProvince = (province) => {
    if (!confirmDelete(`province "${province}" and all of its cities`)) return;

    setSettings((prev) => {
      const next = { ...prev.phLocations };
      delete next[province];
      return { ...prev, phLocations: next };
    });
  };

  const removeCity = (province, index, city) => {
    if (!confirmDelete(`city "${city.name || "this row"}"`)) return;

    setSettings((prev) => ({
      ...prev,
      phLocations: {
        ...prev.phLocations,
        [province]: prev.phLocations[province].filter(
          (_, idx) => idx !== index,
        ),
      },
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage("");

    try {
      const token = await user.getIdToken();
      const normalized = normalizeOperationalSettings({
        truckTypes: settings.truckTypes.map((type) => type.trim()).filter(Boolean),
        warehouses: settings.warehouses
          .map((warehouse) => ({
            name: warehouse.name.trim(),
            code: warehouse.code.trim().toUpperCase(),
            city: warehouse.city.trim(),
            province: warehouse.province.trim(),
          }))
          .filter((warehouse) => warehouse.name && warehouse.code),
        phLocations: Object.fromEntries(
          Object.entries(settings.phLocations)
            .map(([province, cities]) => [
              province.trim(),
              cities
                .map((city) => ({
                  name: city.name.trim(),
                  code: city.code.trim().toUpperCase(),
                }))
                .filter((city) => city.name && city.code),
            ])
            .filter(([province, cities]) => province && cities.length),
        ),
      });

      const res = await fetch("/api/app-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings: normalized }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      const savedSettings = normalizeOperationalSettings(data.settings);
      setSettings(savedSettings);
      cacheOperationalSettings(savedSettings);
      setMessage("Settings saved. Forms will use the latest downloaded JSON.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const provinces = Object.keys(settings.phLocations).sort();

  return (
    <div
      className={`max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-6 ${theme.page}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wide">
            App Settings
          </h2>
          <p className={`text-xs mt-1 ${theme.muted}`}>
            Live values are stored in Firestore and cached as JSON in each browser.
          </p>
        </div>

        <button
          type="button"
          onClick={saveSettings}
          disabled={saving || loading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-white"
        >
          <FontAwesomeIcon icon={saving ? faCircleNotch : faFloppyDisk} spin={saving} />
          {saving ? "Saving" : "Save Settings"}
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            message.includes("saved")
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              : "bg-red-500/10 border-red-500/30 text-red-500"
          }`}
        >
          <FontAwesomeIcon icon={message.includes("saved") ? faCheck : faTrash} className="mr-2" />
          {message}
        </div>
      )}

      <div className={`rounded-lg border overflow-hidden ${theme.panel}`}>
        <div className="grid grid-cols-3 sm:flex overflow-x-auto border-b border-inherit">
          <TabButton active={activeTab === "truckTypes"} onClick={() => setActiveTab("truckTypes")} icon={faTruck}>
            Truck Types
          </TabButton>
          <TabButton active={activeTab === "warehouses"} onClick={() => setActiveTab("warehouses")} icon={faWarehouse}>
            Warehouses
          </TabButton>
          <TabButton active={activeTab === "locations"} onClick={() => setActiveTab("locations")} icon={faLocationDot}>
            Locations
          </TabButton>
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <div className={`py-12 text-center text-sm ${theme.muted}`}>
              <FontAwesomeIcon icon={faCircleNotch} spin className="mr-2" />
              Loading settings
            </div>
          ) : (
            <>
              {activeTab === "truckTypes" && (
                <div className="space-y-3">
                  {settings.truckTypes.map((type, index) => (
                    <EditableRow
                      key={`${type}-${index}`}
                      theme={theme}
                      className="flex-row"
                    >
                      <input
                        value={type}
                        onChange={(e) => updateTruckType(index, e.target.value)}
                        className={`w-full min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm ${theme.input}`}
                      />
                      <IconButton
                        theme={theme}
                        variant="danger"
                        label="Remove truck type"
                        icon={faTrash}
                        onClick={() => removeTruckType(index, type)}
                      />
                    </EditableRow>
                  ))}
                  <AddButton
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        truckTypes: [...prev.truckTypes, ""],
                      }))
                    }
                  >
                    Add Truck Type
                  </AddButton>
                </div>
              )}

              {activeTab === "warehouses" && (
                <div className="space-y-3">
                  {settings.warehouses.map((warehouse, index) => (
                    <EditableRow
                      key={`${warehouse.code}-${index}`}
                      theme={theme}
                      className="sm:grid sm:grid-cols-[minmax(0,2fr)_6rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem]"
                    >
                      <input
                        placeholder="Name"
                        value={warehouse.name}
                        onChange={(e) => updateWarehouse(index, "name", e.target.value)}
                        className={`w-full min-w-0 rounded-lg border px-3 py-2 text-sm ${theme.input}`}
                      />
                      <input
                        placeholder="Code"
                        value={warehouse.code}
                        onChange={(e) => updateWarehouse(index, "code", e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2 text-sm uppercase ${theme.input}`}
                      />
                      <input
                        placeholder="City"
                        value={warehouse.city}
                        onChange={(e) => updateWarehouse(index, "city", e.target.value)}
                        className={`w-full min-w-0 rounded-lg border px-3 py-2 text-sm ${theme.input}`}
                      />
                      <input
                        placeholder="Province"
                        value={warehouse.province}
                        onChange={(e) => updateWarehouse(index, "province", e.target.value)}
                        className={`w-full min-w-0 rounded-lg border px-3 py-2 text-sm ${theme.input}`}
                      />
                      <IconButton
                        theme={theme}
                        variant="danger"
                        label="Remove warehouse"
                        icon={faTrash}
                        onClick={() => removeWarehouse(index, warehouse)}
                      />
                    </EditableRow>
                  ))}
                  <AddButton
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        warehouses: [...prev.warehouses, { ...emptyWarehouse }],
                      }))
                    }
                  >
                    Add Warehouse
                  </AddButton>
                </div>
              )}

              {activeTab === "locations" && (
                <div className="space-y-5">
                  <AddButton onClick={addProvince}>Add Province</AddButton>

                  {provinces.map((province) => (
                    <section
                      key={province}
                      className={`rounded-lg border p-2 sm:p-3 ${theme.row}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                        <h3 className="text-sm font-bold break-words">
                          {province}
                        </h3>
                        <div className="flex gap-2 self-end sm:self-auto">
                          <IconButton
                            theme={theme}
                            label="Add city"
                            icon={faPlus}
                            onClick={() =>
                              setSettings((prev) => ({
                                ...prev,
                                phLocations: {
                                  ...prev.phLocations,
                                  [province]: [...prev.phLocations[province], { ...emptyCity }],
                                },
                              }))
                            }
                          />
                          <IconButton
                            theme={theme}
                            variant="danger"
                            label="Remove province and all cities"
                            icon={faTrash}
                            indicator="P"
                            onClick={() => removeProvince(province)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {settings.phLocations[province].map((city, index) => (
                          <div
                            key={`${city.code}-${index}`}
                            className="grid grid-cols-[minmax(0,1fr)_5rem_2.5rem] gap-2"
                          >
                            <input
                              placeholder="City"
                              value={city.name}
                              onChange={(e) =>
                                updateCity(province, index, "name", e.target.value)
                              }
                              className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm ${theme.input}`}
                            />
                            <input
                              placeholder="Code"
                              value={city.code}
                              onChange={(e) =>
                                updateCity(province, index, "code", e.target.value)
                              }
                              className={`w-20 rounded-lg border px-3 py-2 text-sm uppercase ${theme.input}`}
                            />
                            <IconButton
                              theme={theme}
                              variant="danger"
                              label="Remove city"
                              icon={faTrash}
                              onClick={() => removeCity(province, index, city)}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 inline-flex items-center justify-center gap-2 px-2 sm:px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 ${
        active
          ? "border-blue-500 text-blue-500"
          : "border-transparent text-slate-500 hover:text-blue-500"
      }`}
    >
      <FontAwesomeIcon icon={icon} />
      {children}
    </button>
  );
}

function EditableRow({ theme, children, className = "" }) {
  return (
    <div
      className={`flex flex-col sm:flex-row gap-2 rounded-lg border p-2 ${theme.row} ${className}`}
    >
      {children}
    </div>
  );
}

function IconButton({
  theme,
  icon,
  label,
  onClick,
  variant = "default",
  indicator,
}) {
  const buttonClass =
    variant === "danger"
      ? "border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:border-red-500/50"
      : theme.button;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`relative h-10 w-10 shrink-0 rounded-lg border transition-colors ${buttonClass}`}
    >
      <FontAwesomeIcon icon={icon} />
      {indicator && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-red-500 bg-white px-1 text-[9px] font-black leading-none text-red-600 shadow-sm">
          {indicator}
        </span>
      )}
    </button>
  );
}

function AddButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-500 hover:bg-blue-500/15"
    >
      <FontAwesomeIcon icon={faPlus} />
      {children}
    </button>
  );
}
