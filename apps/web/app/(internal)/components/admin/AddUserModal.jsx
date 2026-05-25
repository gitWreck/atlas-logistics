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
import { getModalThemeClasses } from "@/app/utility/constant/theme";
import { getModalActionClasses } from "@/app/utility/constant/action";

const INITIAL_FORM_STATE = {
  displayName: "",
  email: "",
  password: "",
  role: "driver",
  phoneNumber: "",
  warehouseCode: "",
  warehouseName: "",
  province: "",
  city: "",
  barangay: "",
  street: "",
};

const ROLE_OPTIONS = [
  { value: "driver", label: "Driver" },
  { value: "checker", label: "Checker" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
  { value: "customer", label: "Customer" },
];

const DEFAULT_ALLOWED_ROLES = ROLE_OPTIONS.map((role) => role.value);

function getInitialFormState(role = "driver") {
  return {
    ...INITIAL_FORM_STATE,
    role,
  };
}

export default function AddUserModal({
  isOpen,
  onClose,
  isDark = false,
  onSuccess,
  initialRole = "driver",
  allowedRoles = DEFAULT_ALLOWED_ROLES,
  title = "Add New User",
}) {
  const roleOptions = ROLE_OPTIONS.filter((role) =>
    allowedRoles.includes(role.value),
  );
  const defaultRole = roleOptions.some((role) => role.value === initialRole)
    ? initialRole
    : roleOptions[0]?.value || "driver";

  const [step, setStep] = useState("FORM");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(() =>
    getInitialFormState(defaultRole),
  );
  const [cities, setCities] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);

  const theme = getModalThemeClasses(isDark);
  const action = getModalActionClasses();

  useEffect(() => {
    if (formData.province) {
      setCities(getCities(formData.province));
    } else {
      setCities([]);
    }
  }, [formData.province]);

  if (!isOpen) return null;

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
    const selectedCode = e.target.value;
    const selectedWarehouse = WAREHOUSES.find(
      (warehouse) => warehouse.code === selectedCode,
    );

    setFormData((prev) => ({
      ...prev,
      warehouseCode: selectedCode,
      warehouseName: selectedWarehouse ? selectedWarehouse.name : "",
    }));
  };

  const handlePhoneBlur = (e) => {
    const formatted = normalizePhoneNumber(e.target.value);

    if (formatted !== formData.phoneNumber) {
      setFormData((prev) => ({
        ...prev,
        phoneNumber: formatted,
      }));
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
      const result = await createUserProfile(formData);
      setCreatedUser(result.data || null);
      setStep("SUCCESS");
      onSuccess?.();
    } catch (err) {
      setCreatedUser(null);
      setError(err.message || "Failed to create user.");
      setStep("FORM");
    }
  };

  const handleClose = () => {
    setStep("FORM");
    setError("");
    setShowPassword(false);
    setCreatedUser(null);
    setFormData(getInitialFormState(defaultRole));
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 transition-opacity ${theme.overlay}`}
        onClick={handleClose}
      />

      <div
        className={`relative border w-full max-w-md rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${theme.modal}`}
      >
        <div
          className={`px-6 py-4 border-b flex justify-between items-center ${theme.header}`}
        >
          <h3 className={`font-bold flex items-center gap-2 ${theme.title}`}>
            <FontAwesomeIcon icon={faUserPlus} className="text-blue-500" />
            {title}
          </h3>

          <button
            type="button"
            onClick={handleClose}
            className={theme.closeButton}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {step === "FORM" && (
          <form
            onSubmit={handleNext}
            className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar"
          >
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label
                  className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme.label}`}
                >
                  Name
                </label>
                <input
                  name="displayName"
                  type="text"
                  placeholder="e.g. Juan Dela Cruz"
                  className={`w-full border rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none ${theme.input}`}
                  value={formData.displayName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <label
                  className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme.label}`}
                >
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  placeholder="user@atlas.com"
                  className={`w-full border rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none ${theme.input}`}
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <label
                  className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme.label}`}
                >
                  Temporary Password
                </label>

                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className={`w-full border rounded-lg px-4 py-2.5 pr-12 focus:border-blue-500 outline-none ${theme.input}`}
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className={theme.iconButton}
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>

              <div>
                <label
                  className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme.label}`}
                >
                  Phone Number
                </label>
                <input
                  name="phoneNumber"
                  type="tel"
                  placeholder="0917 123 4567"
                  className={`w-full border rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none ${theme.input}`}
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  onBlur={handlePhoneBlur}
                />
              </div>
            </div>

            {roleOptions.length > 1 && (
              <div>
                <label
                  className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme.label}`}
                >
                  Role
                </label>
                <select
                  name="role"
                  className={`w-full border rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none appearance-none cursor-pointer ${theme.input}`}
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

            {formData.role === "customer" && (
              <div
                className={`space-y-3 pt-4 border-t animate-in fade-in slide-in-from-top-2 ${theme.divider}`}
              >
                <p className="text-xs font-black uppercase tracking-widest text-blue-500">
                  Address Details
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      className={`block text-xs font-bold mb-1 ${theme.label}`}
                    >
                      PROVINCE
                    </label>
                    <select
                      name="province"
                      className={`w-full border rounded-lg px-3 py-2 appearance-none outline-none ${theme.input}`}
                      value={formData.province}
                      onChange={handleChange}
                    >
                      <option value="">Select Province</option>
                      {PROVINCES.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      className={`block text-xs font-bold mb-1 ${theme.label}`}
                    >
                      CITY / MUNICIPALITY
                    </label>
                    <select
                      name="city"
                      className={`w-full border rounded-lg px-3 py-2 appearance-none outline-none disabled:opacity-50 ${theme.input}`}
                      value={formData.city}
                      onChange={handleChange}
                      disabled={!formData.province}
                    >
                      <option value="">Select City</option>
                      {cities.map((city) => (
                        <option key={city.name} value={city.name}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>
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
                    placeholder="Street Name"
                    className={`border rounded-lg px-3 py-2 ${theme.input}`}
                    value={formData.street}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            {formData.role !== "admin" && formData.role !== "customer" && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label
                  className={`block text-xs font-bold uppercase tracking-wider mb-1 ${theme.label}`}
                >
                  Assign Warehouse Base
                </label>
                <select
                  name="warehouseCode"
                  className={`w-full border rounded-lg px-4 py-2.5 focus:border-blue-500 outline-none appearance-none cursor-pointer ${theme.input}`}
                  value={formData.warehouseCode}
                  onChange={handleWarehouseChange}
                >
                  <option value="">Select Warehouse...</option>
                  {WAREHOUSES.map((warehouse) => (
                    <option key={warehouse.code} value={warehouse.code}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className={theme.errorBox}>{error}</p>}

            <button type="submit" className={action.primary}>
              Review Details
            </button>
          </form>
        )}

        {step === "CONFIRM" && (
          <div className="p-8 text-center animate-in fade-in zoom-in-95">
            <div className={theme.warningIconWrap}>
              <FontAwesomeIcon icon={faExclamationTriangle} size="lg" />
            </div>

            <h4 className={`text-xl font-bold mb-2 ${theme.title}`}>
              Are you sure?
            </h4>

            <div className={`text-sm mb-6 space-y-1 ${theme.bodyText}`}>
              <p>
                Creating{" "}
                <strong className={theme.strongText}>{formData.role}</strong>{" "}
                account for:
              </p>
              <p className={`font-bold ${theme.strongText}`}>
                {formData.displayName}
              </p>
              <p>{formData.email}</p>
              <p className={`mt-2 text-xs ${theme.helperText}`}>
                A 9-digit system ID will be generated automatically.
              </p>

              {formData.role === "customer" && (
                <p className={`mt-2 text-xs italic ${theme.helperText}`}>
                  Address: {formData.barangay}, {formData.city}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("FORM")}
                className={action.secondary}
              >
                Go Back
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                className={action.primaryInline}
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {step === "LOADING" && (
          <div className="p-12 text-center">
            <FontAwesomeIcon
              icon={faCircleNotch}
              spin
              className="text-4xl text-blue-500 mb-4"
            />

            <h4 className={`text-lg font-bold ${theme.title}`}>
              Creating User...
            </h4>
          </div>
        )}

        {step === "SUCCESS" && (
          <div className="p-12 text-center">
            <div className={action.success}>
              <FontAwesomeIcon icon={faCheckCircle} size="2x" />
            </div>

            <h4 className={`text-xl font-bold mb-6 ${theme.title}`}>
              Success!
            </h4>

            {createdUser?.publicId && (
              <div
                className={`mb-6 rounded-xl border px-4 py-3 ${theme.header}`}
              >
                <p
                  className={`text-[10px] font-black uppercase tracking-widest ${theme.helperText}`}
                >
                  Assigned ID
                </p>
                <p className={`text-2xl font-black ${theme.title}`}>
                  {createdUser.publicId}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleClose}
              className={action.primary}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
