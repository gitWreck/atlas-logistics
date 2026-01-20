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
import { createUserProfileCallable } from "../../../../utility/FirebaseFunctions";
import { createUserProfile } from "../../../../utility/FirebaseFunctionsLocal";

export default function AddUserModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState("FORM");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "driver",
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

    try {
      await createUserProfile({
        email: formData.email,
        password: formData.password,
        displayName: formData.displayName,
        role: formData.role,
      });

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
    setFormData({ email: "", password: "", displayName: "", role: "driver" });
    setError("");
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

// --------------------------------

// const handleSubmit = async () => {
//   setStep("LOADING");
//   setError("");

//   let secondaryApp = null;

//   try {
//     // 1. TRICK: Initialize a second Firebase App to avoid logging out the Admin
//     secondaryApp = initializeApp(mainApp.options, "SecondaryApp");
//     const secondaryAuth = getAuth(secondaryApp);

//     // 2. Create the User (on the secondary app instance)
//     const userCredential = await createUserWithEmailAndPassword(
//       secondaryAuth,
//       formData.email,
//       formData.password
//     );
//     const newUser = userCredential.user;

//     // 3. Set the Display Name
//     await updateProfile(newUser, {
//       displayName: formData.displayName,
//     });

//     // 4. Force Write the Role to Firestore
//     // await setDoc(
//     //   doc(db, "users", newUser.uid),
//     //   {
//     //     uid: newUser.uid,
//     //     email: formData.email,
//     //     name: formData.displayName,
//     //     role: formData.role,
//     //     active: true,
//     //     createdAt: serverTimestamp(),
//     //   },
//     //   { merge: true }
//     // );

//     // 5. Cleanup: Sign out the new user from the secondary app (just in case)
//     await signOut(secondaryAuth);

//     setStep("SUCCESS");
//     if (onSuccess) onSuccess();
//   } catch (err) {
//     console.error("Creation Error:", err);
//     let msg = "Failed to create user.";
//     if (err.code === "auth/email-already-in-use")
//       msg = "That email is already registered.";
//     if (err.code === "auth/weak-password")
//       msg = "Password must be at least 6 characters.";

//     setError(msg);
//     setStep("FORM");
//   } finally {
//     // 6. Delete the secondary app to free resources
//     if (secondaryApp) {
//       await deleteApp(secondaryApp);
//     }
//   }
// };
