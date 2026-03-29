"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWineGlass, faSnowflake } from "@fortawesome/free-solid-svg-icons";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";

export default function AddPackageForm({
  newPackage,
  setNewPackage,
  setIsAdding,
  handleAddSave,
  isSaving,
  isDark = false,
  packagingTypes = [],
}) {
  const theme = getModalThemeClasses(isDark);
  const action = getModalActionClasses();

  const inactiveToggleClass = isDark
    ? "bg-slate-900 border-slate-700 text-slate-500"
    : "bg-slate-100 border-slate-300 text-slate-600";

  return (
    <div
      className={`border p-4 rounded-xl space-y-3 ${
        isDark
          ? "bg-blue-500/5 border-blue-500/30"
          : "bg-blue-50 border-blue-200"
      }`}
    >
      <div
        className={`text-xs font-bold uppercase mb-2 ${
          isDark ? "text-blue-400" : "text-blue-600"
        }`}
      >
        New Package Details
      </div>

      <input
        type="text"
        placeholder="Description (e.g. Large Box)"
        className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 ${theme.input}`}
        value={newPackage.description}
        onChange={(e) =>
          setNewPackage((prev) => ({
            ...prev,
            description: e.target.value,
          }))
        }
        autoFocus
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 ${theme.input}`}
          value={newPackage.packagingType}
          onChange={(e) =>
            setNewPackage((prev) => ({
              ...prev,
              packagingType: e.target.value,
            }))
          }
        >
          {packagingTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Quantity"
          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 ${theme.input}`}
          value={newPackage.quantity || ""}
          onChange={(e) =>
            setNewPackage((prev) => ({
              ...prev,
              quantity: e.target.value,
            }))
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder="Value (PHP)"
          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 ${theme.input}`}
          value={newPackage.declaredValue || ""}
          onChange={(e) =>
            setNewPackage((prev) => ({
              ...prev,
              declaredValue: e.target.value,
            }))
          }
        />

        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() =>
              setNewPackage((prev) => ({
                ...prev,
                isFragile: !prev.isFragile,
              }))
            }
            className={`flex-1 h-full rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              newPackage.isFragile
                ? "bg-amber-500/10 border-amber-500 text-amber-500"
                : inactiveToggleClass
            }`}
          >
            <FontAwesomeIcon icon={faWineGlass} />
            Fragile
          </button>

          <button
            type="button"
            onClick={() =>
              setNewPackage((prev) => ({
                ...prev,
                isPerishable: !prev.isPerishable,
              }))
            }
            className={`flex-1 h-full rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              newPackage.isPerishable
                ? "bg-cyan-500/10 border-cyan-500 text-cyan-500"
                : inactiveToggleClass
            }`}
          >
            <FontAwesomeIcon icon={faSnowflake} />
            Perishable
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => setIsAdding(false)}
          className={theme.secondaryButton}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleAddSave}
          disabled={isSaving}
          className={action.primaryInline}
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
