"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/apps/web/lib/firebase"; // Ensure this path matches your setup
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleNotch,
  faExclamationCircle,
  faLock,
} from "@fortawesome/free-solid-svg-icons";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Authenticate
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const uid = userCredential.user.uid;

      // 2. Fetch Role & Profile
      const userDoc = await getDoc(doc(db, "users", uid));

      if (!userDoc.exists()) {
        throw new Error("No user record found. Contact support.");
      }

      const userData = userDoc.data();
      const role = userData.role?.toUpperCase();

      // 4. Route to Dashboard
      switch (role) {
        case "ADMIN":
          router.push("/admin/dashboard");
          break;
        case "MANAGER":
          router.push("/manager/dashboard");
          break;
        case "DRIVER":
          router.push("/driver/dashboard");
          break;
        case "CHECKER":
          router.push("/checker/dashboard");
          break;
        default:
          throw new Error("Unauthorized role. Access denied.");
      }
    } catch (err) {
      console.error("Login Error:", err);
      // Friendly error messages
      if (err.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(err.message || "Failed to sign in.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Section */}
        <div className="bg-slate-900 p-8 text-center border-b border-slate-800">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
            {/* <span className="text-2xl font-bold text-white">A</span> */}
            <img
              src="/atlas-logo1.png"
              alt="Atlas Logo"
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            ATLAS LOGIN
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Secure Gateway for Operations
          </p>
        </div>

        {/* Form Section */}
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="user@atlas.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3 text-red-600 text-sm">
                <FontAwesomeIcon
                  icon={faExclamationCircle}
                  className="mt-0.5"
                />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`
                w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2
                ${
                  loading
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30 hover:shadow-blue-500/40 hover:-translate-y-0.5"
                }
              `}
            >
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faCircleNotch} spin /> Verifying...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faLock} /> Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              Access is monitored and audited. <br />
              Contact IT Support for access issues.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
