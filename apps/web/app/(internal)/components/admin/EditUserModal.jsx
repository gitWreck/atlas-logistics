"use client";
import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faEdit,
  faCircleNotch,
  faCheckCircle,
  faEyeSlash,
  faEye,
} from "@fortawesome/free-solid-svg-icons";
import { WAREHOUSES } from "@/app/utility/WarehouseData";
import { normalizePhoneNumber } from "@/app/utility/utilities";
import { updateUserProfile } from "../../../utility/FirebaseFunctions"; // Ensure this is imported
import { PROVINCES, getCities } from "@/app/utility/PhilippinesData";

export default function EditUserModal({
  isOpen,
  onClose,
  onSuccess,
  user,
  isDark = false,
}) {
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [citiesList, setCitiesList] = useState([]); // ✅ Added to store dynamic city options
  const [showPassword, setShowPassword] = useState(false);

  // ✅ Update city list whenever the province in formData changes
  useEffect(() => {
    if (formData?.province) {
      setCitiesList(getCities(formData.province));
    } else {
      setCitiesList([]);
    }
  }, [formData?.province]);

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        uid: user.id,
        displayName: user.name || "",
        role: user.role || "driver",
        email: user.email || "", // ✅ Add this
        phoneNumber: user.phoneNumber || "",
        password: "", // ✅ Initialize empty password
        status: user.status || "active",
        warehouseCode: user.warehouseCode || "",
        warehouseName: user.warehouseName || "",
        province: user.address?.province || "",
        city: user.address?.city || "",
        barangay: user.address?.barangay || "",
        street: user.address?.street || "",
      });
      setSuccess(false);
      setError("");
    }
  }, [user, isOpen]);

  if (!isOpen || !formData) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "province") {
      // ✅ Reset city when province changes to prevent invalid data
      setFormData((prev) => ({ ...prev, province: value, city: "" }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleWarehouseChange = (e) => {
    const code = e.target.value;
    const selected = WAREHOUSES.find((w) => w.code === code);
    setFormData((prev) => ({
      ...prev,
      warehouseCode: code,
      warehouseName: selected ? selected.name : "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await updateUserProfile(formData);
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err.message || "Failed to update user.");
    } finally {
      setLoading(false);
    }
  };

  const modalClasses = isDark
    ? "bg-slate-900 border-slate-700"
    : "bg-white border-slate-200 shadow-xl";
  const labelClasses = isDark ? "text-slate-500" : "text-slate-600";
  const inputClasses = isDark
    ? "bg-slate-950 border-slate-700 text-white"
    : "bg-white border-slate-200 text-slate-900";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative border w-full max-w-md rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${modalClasses}`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex justify-between items-center ${isDark ? "bg-slate-950/50" : "bg-slate-50"}`}
        >
          <h3
            className={`font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}
          >
            <FontAwesomeIcon icon={faEdit} className="text-blue-500" /> Edit
            User
          </h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-red-500 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {success ? (
          <div className="p-12 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
              <FontAwesomeIcon icon={faCheckCircle} size="2x" />
            </div>
            <h4
              className={`text-xl font-bold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Update Successful
            </h4>
            <p className="text-slate-500 text-sm mb-8">
              The user profile has been updated.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar"
          >
            {/* Basic Info */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${labelClasses}`}
                >
                  Full Name
                </label>
                <input
                  name="displayName"
                  className={`w-full border rounded-lg px-4 py-2 ${inputClasses}`}
                  value={formData.displayName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${labelClasses}`}
                >
                  Phone Number
                </label>
                <input
                  name="phoneNumber"
                  type="tel"
                  className={`w-full border rounded-lg px-4 py-2 ${inputClasses}`}
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  onBlur={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      phoneNumber: normalizePhoneNumber(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <label
                className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${labelClasses}`}
              >
                Email Address
              </label>
              <input
                name="email"
                type="email"
                className={`w-full border rounded-lg px-4 py-2 ${inputClasses}`}
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${labelClasses}`}
                >
                  Role
                </label>
                <select
                  name="role"
                  className={`w-full border rounded-lg px-4 py-2 appearance-none ${inputClasses}`}
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
              <div>
                <label
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${labelClasses}`}
                >
                  Status
                </label>
                <select
                  name="status"
                  className={`w-full border rounded-lg px-4 py-2 appearance-none ${inputClasses}`}
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label
                className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${labelClasses}`}
              >
                Reset Password (Optional)
              </label>
              <div className="relative">
                <input
                  name="password"
                  // ✅ Toggle type between "password" and "text"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current"
                  className={`w-full border rounded-lg px-4 py-2 pr-12 ${inputClasses}`}
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
                >
                  {/* Import faEye and faEyeSlash from fontawesome icons */}
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>
              <p className="text-[9px] text-slate-500 mt-1">
                Min. 6 characters. User will need to use this new password on
                their next login.
              </p>
            </div>

            {/* Warehouse - Hidden for customers/admins depending on your logic */}
            {formData.role !== "customer" && formData.role !== "admin" && (
              <div className="animate-in fade-in slide-in-from-top-1">
                <label
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${labelClasses}`}
                >
                  Warehouse Base
                </label>
                <select
                  name="warehouseCode"
                  className={`w-full border rounded-lg px-4 py-2 appearance-none ${inputClasses}`}
                  value={formData.warehouseCode}
                  onChange={handleWarehouseChange}
                >
                  <option value="">Select Warehouse...</option>
                  {WAREHOUSES.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Customer Specific: Address */}
            {formData.role === "customer" && (
              <div className="space-y-3 pt-4 border-t border-slate-700/30 animate-in fade-in slide-in-from-top-2">
                <p
                  className={`text-[10px] font-black uppercase tracking-widest text-blue-500`}
                >
                  Address Details
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {/* ✅ Province Select */}
                  <select
                    name="province"
                    className={`border rounded-lg px-3 py-2 outline-none appearance-none cursor-pointer ${inputClasses}`}
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

                  {/* ✅ City Select */}
                  <select
                    name="city"
                    disabled={!formData.province}
                    className={`border rounded-lg px-3 py-2 outline-none appearance-none cursor-pointer ${inputClasses} disabled:opacity-50`}
                    value={formData.city}
                    onChange={handleChange}
                  >
                    <option value="">Select City / Municipality</option>
                    {citiesList.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    name="barangay"
                    placeholder="Barangay"
                    className={`border rounded-lg px-3 py-2 ${inputClasses}`}
                    value={formData.barangay}
                    onChange={handleChange}
                  />
                  <input
                    name="street"
                    placeholder="Street/House No."
                    className={`border rounded-lg px-3 py-2 ${inputClasses}`}
                    value={formData.street}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 p-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 mt-4"
            >
              {loading ? (
                <FontAwesomeIcon icon={faCircleNotch} spin />
              ) : (
                "Save Changes"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
