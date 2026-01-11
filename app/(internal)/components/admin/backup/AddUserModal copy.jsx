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
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase"; // Make sure this path is correct

export default function AddUserModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState("FORM"); // FORM | CONFIRM | LOADING | SUCCESS
  const [error, setError] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    email: "",
    password: "", // Optional: Depending on your function
    displayName: "",
    role: "DRIVER", // Default
  });

  if (!isOpen) return null;

  // 1. Handle Input Changes
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 2. Validate and Move to Confirmation
  const handleNext = (e) => {
    e.preventDefault();
    if (!formData.email || !formData.displayName || !formData.password) {
      setError("Please fill in all required fields.");
      return;
    }
    setError("");
    setStep("CONFIRM");
  };

  // 3. Submit to Firebase Function
  const handleSubmit = async () => {
    setStep("LOADING");
    setError("");

    try {
      const functions = getFunctions(app);
      // REPLACE 'createUser' WITH YOUR ACTUAL FUNCTION NAME IF DIFFERENT
      const createUserFunc = httpsCallable(functions, "createUser");

      const result = await createUserFunc({
        email: formData.email,
        password: formData.password,
        displayName: formData.displayName,
        role: formData.role,
      });

      if (result.data.error) throw new Error(result.data.error);

      setStep("SUCCESS");
      if (onSuccess) onSuccess(); // Refresh the table behind modal
    } catch (err) {
      console.error("Creation Error:", err);
      setError(err.message || "Failed to create user.");
      setStep("FORM"); // Go back to fix error
    }
  };

  // 4. Reset & Close
  const handleClose = () => {
    setStep("FORM");
    setFormData({ email: "", password: "", displayName: "", role: "DRIVER" });
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Content */}
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

        {/* --- STEP 1: THE FORM --- */}
        {step === "FORM" && (
          <form onSubmit={handleNext} className="p-6 space-y-4">
            {/* Display Name */}
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

            {/* Email */}
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

            {/* Password */}
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

            {/* Role */}
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
                <option value="DRIVER">Driver</option>
                <option value="CHECKER">Checker</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

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

        {/* --- STEP 2: CONFIRMATION --- */}
        {step === "CONFIRM" && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20 animate-bounce">
              <FontAwesomeIcon icon={faExclamationTriangle} size="lg" />
            </div>

            <h4 className="text-xl font-bold text-white mb-2">Are you sure?</h4>
            <p className="text-slate-400 text-sm mb-6">
              You are about to create a new <strong>{formData.role}</strong>{" "}
              account for <br />
              <strong className="text-white">{formData.displayName}</strong> (
              {formData.email}).
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

        {/* --- STEP 3: LOADING --- */}
        {step === "LOADING" && (
          <div className="p-12 text-center">
            <FontAwesomeIcon
              icon={faCircleNotch}
              spin
              className="text-4xl text-blue-500 mb-4"
            />
            <h4 className="text-lg font-bold text-white">Creating User...</h4>
            <p className="text-slate-500 text-sm mt-2">
              Connecting to Firebase Functions
            </p>
          </div>
        )}

        {/* --- STEP 4: SUCCESS --- */}
        {step === "SUCCESS" && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
              <FontAwesomeIcon icon={faCheckCircle} size="2x" />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">Success!</h4>
            <p className="text-slate-400 text-sm mb-6">
              The user has been successfully created and added to the database.
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
