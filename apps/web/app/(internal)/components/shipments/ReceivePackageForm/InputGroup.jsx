import { useState, useEffect } from "react";
import {
  PH_LOCATIONS,
  PROVINCES,
  getCities,
} from "@/app/utility/PhilippinesData";
import { normalizePhoneNumber } from "@/app/utility/utilities";

export default function InputGroup({
  label,
  values,
  onChange,
  color = "blue",
  isDark = false,
  user,
  phLocations = PH_LOCATIONS,
  optional = false,
}) {
  const [cities, setCities] = useState([]);
  const provinces = Object.keys(phLocations || {}).sort();
  // ✅ New States for Search
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (values.province) {
      setCities(phLocations?.[values.province] || getCities(values.province));
    } else {
      setCities([]);
    }
  }, [values.province, phLocations]);

  // ✅ New Function to Search Customers
  const searchCustomers = async (namePart) => {
    if (namePart.length < 2) return;

    try {
      const token = await user.getIdToken(); // Get current user token
      const res = await fetch(`/api/customers?search=${namePart}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      setSuggestions(data.customers || []);
      setShowDropdown(true);
    } catch (err) {
      console.error("API Call failed:", err);
    }
  };
  // ✅ New Function to Select a Customer
  const handleSelectCustomer = (customer) => {
    const addr = customer.address || {};
    onChange({
      ...values,
      uid: customer.uid || null,
      email: customer.email || "",
      name: customer.name,
      phone: customer.phoneNumber || "",
      unit: addr.unit || "",
      street: addr.street || "",
      barangay: addr.barangay || "",
      province: addr.province || "",
      city: addr.city || "",
    });
    setShowDropdown(false);
  };

  const handleChange = (field, val) => {
    if (field === "name") {
      searchCustomers(val);
    }
    if (field === "province") {
      onChange({ ...values, province: val, city: "", code: "" });
    } else if (field === "city") {
      const selectedCity = cities.find((c) => c.name === val);
      onChange({
        ...values,
        city: val,
        code: selectedCity ? selectedCity.code : "",
      });
    } else {
      onChange({ ...values, [field]: val });
    }
  };

  const ringColor =
    color === "emerald" ? "focus:ring-emerald-500" : "focus:ring-blue-500";
  const borderColor =
    color === "emerald" ? "focus:border-emerald-500" : "focus:border-blue-500";
  const titleColor =
    color === "emerald"
      ? isDark
        ? "text-emerald-400"
        : "text-emerald-600"
      : isDark
        ? "text-blue-400"
        : "text-blue-600";
  const inputClass = isDark
    ? `w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm ${ringColor} ${borderColor} focus:ring-1`
    : `w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm ${ringColor} ${borderColor} focus:ring-1`;

  return (
    <div
      className={`space-y-4 p-4 rounded-xl border ${isDark ? "bg-slate-950/50 border-slate-800/50" : "bg-slate-50 border-slate-200"}`}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <h3
            className={`text-xs font-bold uppercase tracking-wider ${titleColor}`}
          >
            {label} Details
          </h3>
          {optional && (
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-600"}`}
            >
              Optional
            </span>
          )}
        </div>
        {values.code && (
          <span
            className={`text-[10px] font-mono px-2 py-1 rounded border ${isDark ? "bg-slate-800 text-white border-slate-700" : "bg-slate-200 text-slate-800 border-slate-300"}`}
          >
            CODE: {values.code}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <input
            placeholder={optional ? "Contact Name (optional)" : "Contact Name"}
            className={inputClass}
            value={values.name}
            onChange={(e) => handleChange("name", e.target.value)}
            onFocus={() => values.name?.length > 1 && setShowDropdown(true)}
          />

          {/* ✅ DROPDOWN SUGGESTIONS */}
          {showDropdown && suggestions.length > 0 && (
            <div
              className={`absolute z-50 w-full mt-1 rounded-lg border shadow-xl overflow-hidden ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}
            >
              {suggestions.map((cust) => (
                <button
                  key={cust.uid}
                  type="button"
                  onClick={() => handleSelectCustomer(cust)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${isDark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-700"}`}
                >
                  <div className="font-bold">{cust.name}</div>
                  <div className="opacity-60 text-[10px]">
                    {cust.phoneNumber}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          placeholder={optional ? "Phone Number (optional)" : "Phone Number"}
          className={inputClass}
          value={values.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          onBlur={(e) => {
            const formatted = normalizePhoneNumber(e.target.value);
            if (formatted !== values.phone) {
              handleChange("phone", formatted);
            }
          }}
        />
      </div>

      <input
        placeholder="Secondary Phone (optional)"
        className={inputClass}
        value={values.secondaryPhone || ""}
        onChange={(e) => handleChange("secondaryPhone", e.target.value)}
        onBlur={(e) => {
          const formatted = normalizePhoneNumber(e.target.value);
          if (formatted !== (values.secondaryPhone || "")) {
            handleChange("secondaryPhone", formatted);
          }
        }}
      />

      <input
        placeholder="Email (optional)"
        type="email"
        className={inputClass}
        value={values.email || ""}
        onChange={(e) => handleChange("email", e.target.value)}
      />

      {/* STREET INFO */}
      <div className="grid grid-cols-3 gap-3">
        <input
          placeholder="Unit/House/Block"
          className={inputClass + " col-span-1"}
          value={values.unit}
          onChange={(e) => handleChange("unit", e.target.value)}
        />
        <input
          placeholder="Street Name"
          className={inputClass + " col-span-2"}
          value={values.street}
          onChange={(e) => handleChange("street", e.target.value)}
        />
      </div>

      {/* BARANGAY & PROVINCE */}
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Barangay"
          className={inputClass}
          value={values.barangay}
          onChange={(e) => handleChange("barangay", e.target.value)}
        />
        <select
          className={inputClass}
          value={values.province}
          onChange={(e) => handleChange("province", e.target.value)}
        >
          <option value="">Select Province</option>
          {(provinces.length ? provinces : PROVINCES).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* CITY */}
      <select
        className={inputClass + " disabled:opacity-50"}
        value={values.city}
        onChange={(e) => handleChange("city", e.target.value)}
        disabled={!values.province}
      >
        <option value="">Select City / Municipality</option>
        {cities.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
