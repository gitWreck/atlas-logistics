"use client";
import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faUserPlus,
  faExclamationTriangle,
  faCircleNotch,
  faCheckCircle,
  faEyeSlash,
  faEye,
} from "@fortawesome/free-solid-svg-icons";
import { createUserProfile } from "../../../utility/FirebaseFunctions";
import { WAREHOUSES } from "@/app/utility/WarehouseData";
import { normalizePhoneNumber } from "@/app/utility/utilities";
import { PROVINCES, getCities } from "@/app/utility/PhilippinesData";

const INITIAL_FORM_STATE = {
  displayName: "",
  email: "",
  password: "",
  role: "driver",
  phoneNumber: "",
  warehouseCode: "",
  warehouseName: "",
  // Added address fields
  province: "",
  city: "",
  barangay: "",
  street: "",
};

export default function AddUserModal({
  isOpen,
  onClose,
  isDark = false,
  onSuccess,
}) {
  const [step, setStep] = useState("FORM");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [cities, setCities] = useState([]); // ✅ Added to store dynamic city list
  const [showPassword, setShowPassword] = useState(false);

  // ✅ Trigger city updates when province changes
  useEffect(() => {
    if (formData.province) {
      setCities(getCities(formData.province));
    } else {
      setCities([]);
    }
  }, [formData.province]);

  if (!isOpen) return null;

  // --- Dynamic Classes ---
  const overlayClasses = isDark ? "bg-slate-950/70" : "bg-slate-900/50";
  const modalClasses = isDark
    ? "bg-slate-900 border-slate-700"
    : "bg-white border-slate-200 shadow-xl";
  const headerClasses = isDark
    ? "border-slate-800 bg-slate-950/50"
    : "border-slate-200 bg-slate-50";
  const titleClasses = isDark ? "text-white" : "text-slate-900";
  const closeBtnClasses = isDark
    ? "text-slate-500 hover:text-white"
    : "text-slate-500 hover:text-slate-900";
  const labelClasses = isDark ? "text-slate-500" : "text-slate-600";
  const inputClasses = isDark
    ? "bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
    : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400";
  const hintClasses = isDark ? "text-slate-600" : "text-slate-500";
  const confirmStrongClasses = isDark ? "text-white" : "text-slate-900";

  // --- Handlers ---
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "province") {
      // ✅ Reset city when province changes
      setFormData({ ...formData, province: value, city: "" });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleWarehouseChange = (e) => {
    const selectedCode = e.target.value;
    const selectedWarehouse = WAREHOUSES.find((w) => w.code === selectedCode);
    setFormData({
      ...formData,
      warehouseCode: selectedCode,
      warehouseName: selectedWarehouse ? selectedWarehouse.name : "",
    });
  };

  const handlePhoneBlur = (e) => {
    const formatted = normalizePhoneNumber(e.target.value);
    if (formatted !== formData.phoneNumber) {
      setFormData((prev) => ({ ...prev, phoneNumber: formatted }));
    }
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (!formData.email || !formData.displayName || !formData.password) {
      setError("Please fill in all required fields.");
      return;
    }
    setError("");
    setStep("CONFIRM");
  };

  const handleSubmit = async () => {
    setStep("LOADING");
    setError("");
    try {
      await createUserProfile(formData);
      setStep("SUCCESS");
      onSuccess?.();
    } catch (err) {
      setError(err.message || "Failed to create user.");
      setStep("FORM");
    }
  };

  const handleClose = () => {
    setStep("FORM");
    setFormData(INITIAL_FORM_STATE);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 backdrop-blur-sm transition-opacity ${overlayClasses}`}
        onClick={handleClose}
      />
      <div
        className={`relative border w-full max-w-md rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${modalClasses}`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex justify-between items-center ${headerClasses}`}
        >
          <h3 className={`${titleClasses} font-bold flex items-center gap-2`}>
            <FontAwesomeIcon icon={faUserPlus} className="text-blue-500" /> Add
            New User
          </h3>
          <button
            onClick={handleClose}
            className={`transition-colors ${closeBtnClasses}`}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Form Step */}
        {step === "FORM" && (
          <form
            onSubmit={handleNext}
            className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar"
          >
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label
                  className={`block text-xs font-bold uppercase tracking-wider mb-1 ${labelClasses}`}
                >
                  Name
                </label>
                <input
                  name="displayName"
                  type="text"
                  placeholder="e.g. Juan Dela Cruz"
                  className={`w-full border rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none ${inputClasses}`}
                  value={formData.displayName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label
                  className={`block text-xs font-bold uppercase tracking-wider mb-1 ${labelClasses}`}
                >
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  placeholder="user@atlas.com"
                  className={`w-full border rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none ${inputClasses}`}
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="relative">
                <label
                  className={`block text-xs font-bold uppercase tracking-wider mb-1 ${labelClasses}`}
                >
                  Temporary Password
                </label>
                <div className="relative">
                  <input
                    name="password"
                    // ✅ Toggle type between "password" and "text"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className={`w-full border rounded-lg px-4 py-2.5 pr-12 focus:border-blue-500 outline-none ${inputClasses}`}
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>
              <div>
                <label
                  className={`block text-xs font-bold uppercase tracking-wider mb-1 ${labelClasses}`}
                >
                  Phone Number
                </label>
                <input
                  name="phoneNumber"
                  type="tel"
                  placeholder="0917 123 4567"
                  className={`w-full border rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none ${inputClasses}`}
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  onBlur={handlePhoneBlur}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label
                  className={`block text-xs font-bold uppercase tracking-wider mb-1 ${labelClasses}`}
                >
                  Role
                </label>
                <select
                  name="role"
                  className={`w-full border rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none appearance-none cursor-pointer ${inputClasses}`}
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="driver">Driver</option>
                  <option value="checker">Checker</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="customer">Customer</option>
                </select>
              </div>
            </div>

            {/* Address Fields - Visible only for Customers */}
            {formData.role === "customer" && (
              <div className="space-y-3 pt-4 border-t border-slate-700/30 animate-in fade-in slide-in-from-top-2">
                <p className="text-xs font-black uppercase tracking-widest text-blue-500">
                  Address Details
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {/* Province Select */}
                  <div className="col-span-1">
                    <label
                      className={`block text-[10px] font-bold mb-1 ${labelClasses}`}
                    >
                      Province
                    </label>
                    <select
                      name="province"
                      className={`w-full border rounded-lg px-3 py-2 appearance-none outline-none ${inputClasses}`}
                      value={formData.province}
                      onChange={handleChange}
                    >
                      <option value="">Select Province</option>
                      {PROVINCES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* City Select */}
                  <div className="col-span-1">
                    <label
                      className={`block text-[10px] font-bold mb-1 ${labelClasses}`}
                    >
                      City / Municipality
                    </label>
                    <select
                      name="city"
                      className={`w-full border rounded-lg px-3 py-2 appearance-none outline-none ${inputClasses} disabled:opacity-50`}
                      value={formData.city}
                      onChange={handleChange}
                      disabled={!formData.province}
                    >
                      <option value="">Select City</option>
                      {cities.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    name="barangay"
                    placeholder="Barangay"
                    className={`border rounded-lg px-3 py-2  ${inputClasses}`}
                    value={formData.barangay}
                    onChange={handleChange}
                  />
                  <input
                    name="street"
                    placeholder="Street Name"
                    className={`border rounded-lg px-3 py-2  ${inputClasses}`}
                    value={formData.street}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            {/* Warehouse - Visible for non-customer staff */}
            {formData.role !== "admin" && formData.role !== "customer" && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label
                  className={`block text-xs font-bold uppercase tracking-wider mb-1 ${labelClasses}`}
                >
                  Assign Warehouse Base
                </label>
                <select
                  name="warehouseCode"
                  className={`w-full border rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none appearance-none cursor-pointer ${inputClasses}`}
                  value={formData.warehouseCode}
                  onChange={handleWarehouseChange}
                >
                  <option value="">Select Warehouse...</option>
                  {WAREHOUSES.map((w, i) => (
                    <option key={i} value={w.code}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 p-2 rounded border border-red-500/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors mt-2"
            >
              Review Details
            </button>
          </form>
        )}

        {/* Step 2: Confirm */}
        {step === "CONFIRM" && (
          <div className="p-8 text-center animate-in fade-in zoom-in-95">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${isDark ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-amber-100 text-amber-600 border-amber-200"}`}
            >
              <FontAwesomeIcon icon={faExclamationTriangle} size="lg" />
            </div>
            <h4
              className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Are you sure?
            </h4>
            <div
              className={`text-sm mb-6 space-y-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}
            >
              <p>
                Creating{" "}
                <strong className={confirmStrongClasses}>
                  {formData.role}
                </strong>{" "}
                account for:
              </p>
              <p className={`font-bold ${confirmStrongClasses}`}>
                {formData.displayName}
              </p>
              <p>{formData.email}</p>
              {formData.role === "customer" && (
                <p className="mt-2 text-xs italic">
                  Address: {formData.barangay}, {formData.city}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("FORM")}
                className={`flex-1 py-3 rounded-xl border font-medium transition-colors ${isDark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
              >
                Go Back
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-bold transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Loading */}
        {step === "LOADING" && (
          <div className="p-12 text-center">
            <FontAwesomeIcon
              icon={faCircleNotch}
              spin
              className="text-4xl text-blue-500 mb-4"
            />
            <h4
              className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Creating User...
            </h4>
          </div>
        )}

        {/* Step 4: Success */}
        {step === "SUCCESS" && (
          <div className="p-12 text-center">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${isDark ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}
            >
              <FontAwesomeIcon icon={faCheckCircle} size="2x" />
            </div>
            <h4
              className={`text-xl font-bold mb-6 ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Success!
            </h4>
            <button
              onClick={handleClose}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-bold transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
