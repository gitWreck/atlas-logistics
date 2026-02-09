import { useState, useEffect } from "react";
import { PROVINCES, getCities } from "@/app/utility/PhilippinesData";
import { normalizePhoneNumber } from "@/app/utility/utilities";

export default function InputGroup({
  label,
  values,
  onChange,
  color = "blue",
}) {
  const [cities, setCities] = useState([]);

  // Update city list when province changes
  useEffect(() => {
    if (values.province) {
      setCities(getCities(values.province));
    } else {
      setCities([]);
    }
  }, [values.province]);

  const handleChange = (field, val) => {
    // If province changes, reset city and code
    if (field === "province") {
      onChange({ ...values, province: val, city: "", code: "" });
    }
    // If city changes, automatically find and set the code
    else if (field === "city") {
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
  const titleColor = color === "emerald" ? "text-emerald-400" : "text-blue-400";

  return (
    <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
      <div className="flex justify-between items-center mb-2">
        <h3
          className={`text-xs font-bold uppercase tracking-wider ${titleColor}`}
        >
          {label} Details
        </h3>
        {values.code && (
          <span className="bg-slate-800 text-white text-[10px] font-mono px-2 py-1 rounded border border-slate-700">
            CODE: {values.code}
          </span>
        )}
      </div>

      {/* NAME & PHONE */}
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Contact Name"
          className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm ${ringColor} ${borderColor} focus:ring-1`}
          value={values.name}
          onChange={(e) => handleChange("name", e.target.value)}
        />
        <input
          placeholder="Phone Number"
          className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm ${ringColor} ${borderColor} focus:ring-1`}
          value={values.phone}
          // onChange={(e) => handleChange("phone", e.target.value)}
          // 1. ALLOW TYPING: Let them type dashes/spaces if they want
          onChange={(e) => handleChange("phone", e.target.value)}
          // 2. FORMAT ON LEAVE: When they click away, auto-fix the format
          onBlur={(e) => {
            const formatted = normalizePhoneNumber(e.target.value);
            // Only update if it changed
            if (formatted !== values.phone) {
              handleChange("phone", formatted);
            }
          }}
        />
      </div>

      {/* STREET INFO */}
      <div className="grid grid-cols-3 gap-3">
        <input
          placeholder="Unit/House/Block"
          className={`col-span-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm ${ringColor} ${borderColor} focus:ring-1`}
          value={values.unit}
          onChange={(e) => handleChange("unit", e.target.value)}
        />
        <input
          placeholder="Street Name"
          className={`col-span-2 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm ${ringColor} ${borderColor} focus:ring-1`}
          value={values.street}
          onChange={(e) => handleChange("street", e.target.value)}
        />
      </div>

      {/* BARANGAY & PROVINCE */}
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Barangay"
          className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm ${ringColor} ${borderColor} focus:ring-1`}
          value={values.barangay}
          onChange={(e) => handleChange("barangay", e.target.value)}
        />
        <select
          className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm ${ringColor} ${borderColor} focus:ring-1`}
          value={values.province}
          onChange={(e) => handleChange("province", e.target.value)}
        >
          <option value="">Select Province</option>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* CITY */}
      <select
        className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm ${ringColor} ${borderColor} focus:ring-1 disabled:opacity-50`}
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
