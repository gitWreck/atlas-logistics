"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartPie,
  faTruck,
  faSignOutAlt,
  faTruckLoading,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import { handleLogout } from "@/app/utility/utilities";

// Components
import TabButton from "../../components/ui/TabButton";
import ManagerOverview from "../../components/manager/ManagerOverview"; // We will create this below
import ShipmentBoard from "../../components/shipments/ShipmentBoard";
import ManifestPage from "../../components/manifests/ManifestBoard";
import TripBoard from "../../components/trips/TripBoard";

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const { user, profile, loading } = useAuth();

  if (loading)
    return (
      <div className="p-10 text-slate-400">Loading Manager Console...</div>
    );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* --- MANAGER HEADER --- */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-6 pt-4 pb-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
                M
              </div>
              <div>
                <h1 className="font-bold text-white tracking-wide text-lg uppercase">
                  Manager Console
                </h1>
                <p className="text-xs text-slate-500">Operations Dashboard</p>
              </div>
            </div>

            {/* User Profile & Actions */}
            <div className="flex items-center gap-4">
              <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-white">
                  {profile?.name || "Manager"}
                </div>
                <div className="text-xs text-slate-500 uppercase">
                  {profile?.role || "Manager"}
                </div>
              </div>

              <button
                onClick={() => handleLogout(auth, router)}
                className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-900/50 hover:border-red-800 transition-colors"
                title="Sign Out"
              >
                <FontAwesomeIcon icon={faSignOutAlt} />
              </button>
            </div>
          </div>

          {/* --- TABS --- */}
          <div className="flex gap-6">
            <TabButton
              isActive={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              icon={faChartPie}
              label="Overview"
            />
            <TabButton
              isActive={activeTab === "trips"}
              onClick={() => setActiveTab("trips")}
              icon={faTruckLoading}
              label="Trip Operations"
            />
            <TabButton
              isActive={activeTab === "shipments"}
              onClick={() => setActiveTab("shipments")}
              icon={faTruck}
              label="Shipment and Packages"
            />
            <TabButton
              isActive={activeTab === "manifests"}
              onClick={() => setActiveTab("manifests")}
              icon={faTruckLoading}
              label="Manifest & Trips"
            />
          </div>
        </div>
      </header>

      {/* --- CONTENT AREA --- */}
      <main className="max-w-7xl mx-auto p-6">
        {activeTab === "overview" && (
          <ManagerOverview
            onNavigateToShipments={() => setActiveTab("shipments")}
          />
        )}
        {activeTab === "shipments" && (
          <ShipmentBoard user={user} userRole="manager" profile={profile} />
        )}
        {activeTab === "manifests" && <ManifestPage />}
        {activeTab === "trips" && <TripBoard />}
      </main>
    </div>
  );
}
