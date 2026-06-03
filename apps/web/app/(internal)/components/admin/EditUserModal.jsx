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
import { normalizePhoneNumber } from "@/app/utility/utilities";
import { updateUserProfile } from "../../../utility/FirebaseFunctions";
import { getCities } from "@/app/utility/PhilippinesData";
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";
import { useOperationalSettings } from "@/app/utility/useOperationalSettings";

export default function EditUserModal({
  isOpen,
  onClose,
  onSuccess,
  user,
  isDark = false,
  title = "Edit User",
  allowedRoles = null,
}) {
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [citiesList, setCitiesList] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const { settings } = useOperationalSettings();
  const warehouses = settings.warehouses;
  const phLocations = settings.phLocations;
  const provinces = Object.keys(phLocations || {}).sort();

  const theme = getModalThemeClasses(isDark);
  const action = getModalActionClasses();
  const roleOptions = [
    { value: "driver", label: "Driver" },
    { value: "checker", label: "Checker" },
    { value: "manager", label: "Manager" },
    { value: "admin", label: "Admin" },
    { value: "customer", label: "Customer" },
  ].filter((role) => !allowedRoles || allowedRoles.includes(role.value));

  useEffect(() => {
    if (formData?.province) {
      setCitiesList(
        phLocations?.[formData.province] || getCities(formData.province),
      );
    } else {
      setCitiesList([]);
    }
  }, [formData?.province, phLocations]);

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        uid: user.id,
        publicId: user.publicId || user.userCode || user.driverCode || "",
        displayName: user.name || "",
        role: user.role || "driver",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        password: "",
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
      setShowPassword(false);
    }
  }, [user, isOpen]);

  if (!isOpen || !formData) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "province") {
      setFormData((prev) => ({
        ...prev,
        province: value,
        city: "",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleWarehouseChange = (e) => {
    const code = e.target.value;
    const selected = warehouses.find((warehouse) => warehouse.code === code);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={`absolute inset-0 ${theme.overlay}`} onClick={onClose} />

      <div
        className={`relative border w-full max-w-md rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${theme.modal}`}
      >
        <div
          className={`px-6 py-4 border-b flex justify-between items-center ${theme.header}`}
        >
          <h3 className={`font-bold flex items-center gap-2 ${theme.title}`}>
            <FontAwesomeIcon icon={faEdit} className="text-blue-500" />
            {title}
          </h3>

          <button type="button" onClick={onClose} className={theme.closeButton}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {success ? (
          <div className="p-12 text-center animate-in fade-in zoom-in duration-300">
            <div className={theme.successIconWrap}>
              <FontAwesomeIcon icon={faCheckCircle} size="2x" />
            </div>

            <h4 className={`text-xl font-bold mb-2 ${theme.title}`}>
              Update Successful
            </h4>

            <p className={`text-sm mb-8 ${theme.helperText}`}>
              The user profile has been updated.
            </p>

            <button type="button" onClick={onClose} className={action.primary}>
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar"
          >
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${theme.label}`}
                >
                  User ID
                </label>
                <input
                  className={`w-full border rounded-lg px-4 py-2 opacity-60 cursor-not-allowed ${theme.input}`}
                  value={formData.publicId || "N/A"}
                  readOnly
                  disabled
                />
              </div>

              <div>
                <label
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${theme.label}`}
                >
                  Full Name
                </label>
                <input
                  name="displayName"
                  className={`w-full border rounded-lg px-4 py-2 ${theme.input}`}
                  value={formData.displayName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <label
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${theme.label}`}
                >
                  Phone Number
                </label>
                <input
                  name="phoneNumber"
                  type="tel"
                  className={`w-full border rounded-lg px-4 py-2 ${theme.input}`}
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
                className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${theme.label}`}
              >
                Email Address
              </label>
              <input
                name="email"
                type="email"
                className={`w-full border rounded-lg px-4 py-2 ${theme.input}`}
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div
              className={roleOptions.length > 1 ? "grid grid-cols-2 gap-4" : ""}
            >
              {roleOptions.length > 1 && (
                <div>
                  <label
                    className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${theme.label}`}
                  >
                    Role
                  </label>
                  <select
                    name="role"
                    className={`w-full border rounded-lg px-4 py-2 appearance-none ${theme.input}`}
                    value={formData.role}
                    onChange={handleChange}
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${theme.label}`}
                >
                  Status
                </label>
                <select
                  name="status"
                  className={`w-full border rounded-lg px-4 py-2 appearance-none ${theme.input}`}
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
                className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${theme.label}`}
              >
                Reset Password (Optional)
              </label>

              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current"
                  className={`w-full border rounded-lg px-4 py-2 pr-12 ${theme.input}`}
                  value={formData.password}
                  onChange={handleChange}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className={theme.iconButton}
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>

              <p className={`text-[9px] mt-1 ${theme.helperText}`}>
                Min. 6 characters. User will need to use this new password on
                their next login.
              </p>
            </div>

            {formData.role !== "customer" && formData.role !== "admin" && (
              <div className="animate-in fade-in slide-in-from-top-1">
                <label
                  className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${theme.label}`}
                >
                  Warehouse Base
                </label>
                <select
                  name="warehouseCode"
                  className={`w-full border rounded-lg px-4 py-2 appearance-none ${theme.input}`}
                  value={formData.warehouseCode}
                  onChange={handleWarehouseChange}
                >
                  <option value="">Select Warehouse...</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.code} value={warehouse.code}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.role === "customer" && (
              <div
                className={`space-y-3 pt-4 border-t animate-in fade-in slide-in-from-top-2 ${theme.divider}`}
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                  Address Details
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    name="province"
                    className={`border rounded-lg px-3 py-2 outline-none appearance-none cursor-pointer ${theme.input}`}
                    value={formData.province}
                    onChange={handleChange}
                  >
                    <option value="">Select Province</option>
                    {provinces.map((province) => (
                      <option key={province} value={province}>
                        {province}
                      </option>
                    ))}
                  </select>

                  <select
                    name="city"
                    disabled={!formData.province}
                    className={`border rounded-lg px-3 py-2 outline-none appearance-none cursor-pointer disabled:opacity-50 ${theme.input}`}
                    value={formData.city}
                    onChange={handleChange}
                  >
                    <option value="">Select City / Municipality</option>
                    {citiesList.map((city) => (
                      <option key={city.name} value={city.name}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    name="barangay"
                    placeholder="Barangay"
                    className={`border rounded-lg px-3 py-2 ${theme.input}`}
                    value={formData.barangay}
                    onChange={handleChange}
                  />
                  <input
                    name="street"
                    placeholder="Street/House No."
                    className={`border rounded-lg px-3 py-2 ${theme.input}`}
                    value={formData.street}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            {error && <div className={theme.errorBox}>{error}</div>}

            <button type="submit" disabled={loading} className={action.primary}>
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
