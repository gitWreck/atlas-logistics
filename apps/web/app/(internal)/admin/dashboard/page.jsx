"use client";
import React, { useEffect, useState } from "react"; // Added useEffect
// import TripManager from "../../components/trips/TripManager";
import ShipmentBoard from "../../components/shipments/ShipmentBoard";
import TripBoard from "../../components/trips/TripBoard";
import AdminOverview from "../../components/admin/AdminOverview";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartPie,
  faTruck,
  faSignOutAlt,
  faMapSigns,
  faTruckLoading,
} from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import { handleLogout } from "@/app/utility/utilities";
import ManifestPage from "../../components/manifests/ManifestBoard";
import TabButton from "../../components/ui/TabButton";
import NotificationBell from "../../components/notifications/NotificationBell";
import TruckBoard from "../../components/trucks/TruckBoard";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    // 1. Do nothing while loading
    if (loading) return;

    // 2. Check if user is not logged in
    if (!user) {
      router.push("/login");
      return;
    }

    // 3. Check if user is logged in but NOT a admin
    if (profile?.role !== "admin") {
      // Option A: Kick them out (Strict)
      handleLogout(auth, router);

      // Option B: Redirect to home (Friendlier)
      console.warn("Unauthorized access attempt by:", user.email);
      router.push("/login");
    }
  }, [user, profile, loading, router]);

  if (loading) return <div>Loading...</div>;
  if (!user || profile?.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans overflow-x-hidden">
      {/* --- ADMIN HEADER --- */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 pt-4 pb-0">
        <div className="max-w-7xl mx-auto">
          {/* Top Section: Logo & User Actions */}
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            {/* Logo Section */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 shrink-0">
                A
              </div>
              <div>
                <h1 className="font-bold text-white tracking-wide text-base sm:text-lg uppercase leading-tight">
                  Admin Console
                </h1>
                <p className="text-[10px] sm:text-xs text-slate-500">
                  System Management
                </p>
              </div>
            </div>

            {/* User Actions */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <NotificationBell />

              {/* Divider (Hidden on mobile) */}
              <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>

              {/* User Info (Hidden on mobile to save space) */}
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-white">
                  {profile?.name || "test"}
                </div>
                <div className="text-xs text-slate-500 uppercase">
                  {profile?.role || "admin"}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={() => handleLogout(auth, router)}
                className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-900/50 hover:border-red-800 transition-colors"
                title="Sign Out"
              >
                <FontAwesomeIcon icon={faSignOutAlt} size="sm" />
              </button>
            </div>
          </div>

          {/* --- SCROLLABLE TABS --- */}
          {/* 1. -mx-4 px-4: Pulls container to screen edges on mobile for full-width scroll 
          2. overflow-x-auto: Enables horizontal scrolling 
          3. no-scrollbar: Utility to hide scroll bar (see CSS below)
      */}
          <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
            {[
              { id: "overview", icon: faChartPie, label: "Overview" },
              { id: "trips", icon: faMapSigns, label: "Trip Operations" },
              { id: "shipments", icon: faTruck, label: "Shipments" },
              { id: "trucks", icon: faTruckLoading, label: "Trucks" },
              { id: "manifests", icon: faTruckLoading, label: "Manifests" },
            ].map((tab) => (
              <div key={tab.id} className="shrink-0 pb-3">
                {" "}
                {/* shrink-0 prevents squishing */}
                <TabButton
                  isActive={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  icon={tab.icon}
                  label={tab.label}
                  // Ensure TabButton accepts className to prevent text wrapping
                  className="whitespace-nowrap"
                />
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* --- CONTENT AREA --- */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {activeTab === "overview" && (
          <AdminOverview user={user} userRole="admin" profile={profile} />
        )}
        {activeTab === "trips" && (
          <TripBoard user={user} userRole="admin" profile={profile} />
        )}
        {activeTab === "shipments" && (
          <ShipmentBoard user={user} userRole="admin" profile={profile} />
        )}
        {activeTab === "trucks" && (
          <TruckBoard user={user} userRole="admin" profile={profile} />
        )}
        {activeTab === "manifests" && <ManifestPage />}
      </main>
    </div>
  );
}
