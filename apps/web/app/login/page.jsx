"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase"; // Ensure this path matches your setup
import { useAuth } from "@/app/context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleNotch,
  faExclamationCircle,
  faEye,
  faEyeSlash,
} from "@fortawesome/free-solid-svg-icons";

function getDashboardPathForRole(role) {
  switch (role?.toUpperCase()) {
    case "ADMIN":
      return "/admin/dashboard";
    case "MANAGER":
      return "/manager/dashboard";
    case "DRIVER":
      return "/driver/dashboard";
    case "CHECKER":
      return "/checker/dashboard";
    default:
      return null;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const dashboardPath = profile ? getDashboardPathForRole(profile.role) : null;

  useEffect(() => {
    if (authLoading || !user || !dashboardPath) return;
    router.replace(dashboardPath);
  }, [authLoading, user, dashboardPath, router]);

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
      const path = getDashboardPathForRole(userData.role);

      if (!path) {
        throw new Error("Unauthorized role. Access denied.");
      }

      router.replace(path);
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

  if (authLoading || (user && dashboardPath)) {
    return (
      <div className="min-h-screen min-h-dvh flex items-center justify-center bg-slate-100">
        <FontAwesomeIcon
          icon={faCircleNotch}
          spin
          className="text-3xl text-blue-600"
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh h-dvh flex justify-center bg-slate-100 overflow-x-hidden">
      <div className="relative flex h-full w-full max-w-[640px] sm:w-[43vw] sm:min-w-[320px] flex-col overflow-hidden border-0 sm:border sm:border-slate-200 bg-white shadow-sm sm:my-6 sm:h-[calc(100dvh-3rem)] sm:min-h-0 sm:rounded-2xl">
        <img
          src="/login_bg.jpeg"
          alt=""
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[min(42%,360px)] min-h-[220px] w-full object-cover object-bottom"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[min(42%,360px)] min-h-[220px] bg-linear-to-t from-white/25 via-white/55 to-white"
          aria-hidden
        />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col justify-start px-4 sm:px-6 pt-10 sm:pt-14 pb-4">
            <div className="pb-4 text-center">
              <img
                src="/atlas-login.svg"
                alt="Atlas Logo"
                className="w-28 h-28 sm:w-40 sm:h-40 md:w-[200px] md:h-[200px] mx-auto object-contain"
              />
              <h1
                className="text-xl sm:text-2xl font-bold mt-3 sm:mt-4"
                style={{ color: "#0650A0" }}
              >
                Atlas Login
              </h1>
              <p className="text-xs sm:text-sm mt-1.5 sm:mt-2 text-slate-500 px-2">
                Secure access for Admins, and Managers
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                className="w-full h-12 sm:h-14 pl-5 sm:pl-6 pr-4 sm:pr-5 bg-slate-50 border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-base"
                placeholder="Enter Your Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full h-12 sm:h-14 pl-5 sm:pl-6 pr-11 sm:pr-12 bg-slate-50 border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-base"
                  placeholder="Enter Your Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-blue-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <FontAwesomeIcon
                    icon={showPassword ? faEyeSlash : faEye}
                    className="text-lg"
                  />
                </button>
              </div>
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

            {/* Sign In – fully rounded gradient button; touch-friendly on mobile */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 sm:h-[52px] rounded-full font-semibold text-white flex items-center justify-center gap-2 shadow-md disabled:opacity-70 disabled:cursor-not-allowed transition-all text-lg"
              style={
                loading
                  ? { backgroundColor: "#94a3b8" }
                  : {
                      background: "linear-gradient(to right, #042C83, #07B9F4)",
                      boxShadow: "0 6px 12px rgba(7, 185, 244, 0.35)",
                    }
              }
            >
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faCircleNotch} spin /> Verifying...
                </>
              ) : (
                <>Sign In</>
              )}
            </button>
            </form>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 sm:px-6 pb-6 sm:pb-8">
            <img
              src="/shield.svg"
              alt=""
              className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0"
              aria-hidden
            />
            <p
              className="text-center text-xs sm:text-[13px]"
              style={{ color: "#94a3b8" }}
            >
              All login attempts are monitored and audited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
