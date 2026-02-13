"use client";
import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faUserPlus,
  faExclamationTriangle,
  faCircleNotch,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";
import { createUserProfile } from "../../../utility/FirebaseFunctions";
import { WAREHOUSES } from "@/app/utility/WarehouseData";
import { normalizePhoneNumber } from "@/app/utility/utilities";

const INITIAL_FORM_STATE = {
  displayName: "",
  email: "",
  password: "",
  role: "driver",
  phoneNumber: "",
  warehouseCode: "",
  warehouseName: "",
};

export default function AddUserModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState("FORM");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState(INITIAL_FORM_STATE);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleWarehouseChange = (e) => {
    const selectedCode = e.target.value;

    // Find the full warehouse object that matches the selected code
    const selectedWarehouse = WAREHOUSES.find((w) => w.code === selectedCode);

    setFormData({
      ...formData,
      warehouseCode: selectedCode,
      // If found, save the name; otherwise clear it (e.g. if they selected the placeholder)
      warehouseName: selectedWarehouse ? selectedWarehouse.name : "",
    });
  };

  const handlePhoneChange = (e) => {
    const rawValue = e.target.value;

    // Update state immediately so the user sees what they type
    setFormData((prev) => ({
      ...prev,
      phoneNumber: rawValue,
    }));
  };

  const handlePhoneBlur = (e) => {
    const rawValue = e.target.value;
    const formatted = normalizePhoneNumber(rawValue);

    // Only update if the formatting actually changed something
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

    console.log("formData: ", formData);

    try {
      await createUserProfile(formData);

      setStep("SUCCESS");
      onSuccess?.();
    } catch (err) {
      console.error(err);

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
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />
      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <h3 className="text-white font-bold flex items-center gap-2">
            <FontAwesomeIcon icon={faUserPlus} className="text-blue-500" />
            Add New User
          </h3>
          <button
            onClick={handleClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Step 1: Form */}
        {step === "FORM" && (
          <form onSubmit={handleNext} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                name="displayName"
                type="text"
                placeholder="e.g. Juan Dela Cruz"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                value={formData.displayName}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Email
              </label>
              <input
                name="email"
                type="email"
                placeholder="user@atlas.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Temporary Password
              </label>
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            {/* NEW: Phone Number */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Phone Number{" "}
                <span className="text-slate-600 font-normal normal-case">
                  (Required for Drivers)
                </span>
              </label>
              <input
                name="phoneNumber"
                type="tel"
                placeholder="+63 917 123 4567"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                value={formData.phoneNumber}
                onChange={handlePhoneChange}
                onBlur={handlePhoneBlur}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Role
              </label>
              <select
                name="role"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none appearance-none"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="driver">Driver</option>
                <option value="checker">Checker</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {formData.role !== "admin" && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Assign Warehouse Base
                </label>
                <select
                  name="warehouseCode"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none appearance-none"
                  value={formData.warehouseCode}
                  // onChange={handleChange}
                  onChange={handleWarehouseChange}
                >
                  <option value="">Select Warehouse...</option>
                  {/* Ideally, fetch these from Firestore too */}
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

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Review Details
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Confirm */}
        {step === "CONFIRM" && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
              <FontAwesomeIcon icon={faExclamationTriangle} size="lg" />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">Are you sure?</h4>
            <p className="text-slate-400 text-sm mb-6">
              You are about to create a new <strong>{formData.role}</strong>{" "}
              account for <br />
              <strong className="text-white">{formData.displayName}</strong> (
              {formData.email}).
            </p>
            <p className="text-slate-400 text-sm mb-6">
              Role:{" "}
              <strong className="text-white uppercase">{formData.role}</strong>
              <br />
              Warehouse:{" "}
              <strong className="text-white">
                {formData.warehouseName || "None"}
              </strong>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("FORM")}
                className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-medium transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-bold transition-colors"
              >
                Confirm Create
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
            <h4 className="text-lg font-bold text-white">Creating User...</h4>
            <p className="text-slate-500 text-sm mt-2">
              Connecting to Authentication...
            </p>
          </div>
        )}

        {/* Step 4: Success */}
        {step === "SUCCESS" && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
              <FontAwesomeIcon icon={faCheckCircle} size="2x" />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">Success!</h4>
            <p className="text-slate-400 text-sm mb-6">
              The user has been successfully created.
            </p>
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
