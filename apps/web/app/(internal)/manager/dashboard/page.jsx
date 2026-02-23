"use client";
import React, { useEffect, useRef, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartPie,
  faTruck,
  faSignOutAlt,
  faTruckLoading,
  faMapSigns,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import { handleLogout } from "@/app/utility/utilities";

// Components
import TabButton from "../../components/ui/TabButton";
import ManagerOverview from "../../components/manager/ManagerOverview";
import ShipmentBoard from "../../components/shipments/ShipmentBoard";
import ManifestPage from "../../components/manifests/ManifestBoard";
import TripBoard from "../../components/trips/TripBoard";
import NotificationBell from "../../components/notifications/NotificationBell";
import TruckBoard from "../../components/trucks/TruckBoard";

const TABS = [
  { id: "overview", icon: faChartPie, label: "Overview", title: "Overview", description: "Operations dashboard" },
  { id: "trips", icon: faMapSigns, label: "Trip Operations", title: "Trip Board", description: "Manage truck assignments and routes." },
  { id: "shipments", icon: faTruck, label: "Shipments", title: "Shipments", description: "Manage shipments and orders." },
  { id: "trucks", icon: faTruckLoading, label: "Trucks", title: "Truck Board", description: "Manage fleet health and availability." },
];

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const { user, profile, loading } = useAuth();
  const tripBoardRef = useRef(null);
  const shipmentBoardRef = useRef(null);
  const truckBoardRef = useRef(null);

  const currentTabConfig = useMemo(() => TABS.find((t) => t.id === activeTab) || TABS[0], [activeTab]);

  const headerButton = useMemo(() => {
    if (activeTab === "trips") return { label: "Trip", icon: faPlus, accent: "emerald", onClick: () => tripBoardRef.current?.openCreateTripModal?.() };
    if (activeTab === "shipments") return { label: "Shipment", icon: faPlus, accent: "blue", onClick: () => shipmentBoardRef.current?.openCreateModal?.() };
    if (activeTab === "trucks") return { label: "Register Truck", icon: faPlus, accent: "blue", onClick: () => truckBoardRef.current?.openRegisterModal?.() };
    return null;
  }, [activeTab]);

  console.log("Manager Dashboard - User:", user);
  console.log("Manager Dashboard - Profile:", profile);

  useEffect(() => {
    // 1. Do nothing while loading
    if (loading) return;

    // 2. Check if user is not logged in
    if (!user) {
      router.push("/login");
      return;
    }

    // 3. Check if user is logged in but NOT a manager
    if (profile?.role !== "manager") {
      // Option A: Kick them out (Strict)
      handleLogout(auth, router);

      // Option B: Redirect to home (Friendlier)
      console.warn("Unauthorized access attempt by:", user.email);
      router.push("/login");
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  if (loading)
    return (
      <div className="p-10 text-slate-400">Loading Manager Console...</div>
    );
  if (!user || profile?.role !== "manager") return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* --- MANAGER HEADER --- */}
      <header className="sticky top-0 z-40 bg-slate-950 border-b border-slate-800 px-6 pt-4 pb-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-start sm:items-center mb-6 gap-4 min-h-[72px]">
            {/* Tab-specific title & description */}
            <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20 shrink-0">
                M
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-white tracking-wide text-lg uppercase leading-tight">
                  {currentTabConfig?.title ?? "Manager Console"}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5 leading-tight">
                  {currentTabConfig?.description ?? "Operations dashboard"}
                </p>
              </div>
            </div>

            {/* Optional header action + User area */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              {headerButton && (
                <>
                  <button
                    onClick={headerButton.onClick}
                    className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all ${
                      headerButton.accent === "emerald"
                        ? "bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
                        : "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20"
                    }`}
                  >
                    <FontAwesomeIcon icon={headerButton.icon} />
                    <span>{headerButton.label}</span>
                  </button>
                  <button
                    onClick={headerButton.onClick}
                    className={`sm:hidden h-10 w-10 rounded-lg flex items-center justify-center text-white ${
                      headerButton.accent === "emerald"
                        ? "bg-emerald-600 shadow-lg shadow-emerald-500/20"
                        : "bg-blue-600 shadow-lg shadow-blue-500/20"
                    }`}
                  >
                    <FontAwesomeIcon icon={headerButton.icon} />
                  </button>
                </>
              )}
              <NotificationBell />

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
          <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
            {TABS.map((tab) => (
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
      <main className="max-w-7xl mx-auto p-6">
        {activeTab === "overview" && (
          <ManagerOverview
            user={user}
            userRole="manager"
            profile={profile}
            onNavigateToShipments={() => setActiveTab("shipments")}
          />
        )}
        {activeTab === "trips" && (
          <TripBoard
            ref={tripBoardRef}
            user={user}
            userRole="manager"
            profile={profile}
            isDark={false}
          />
        )}
        {activeTab === "shipments" && (
          <ShipmentBoard ref={shipmentBoardRef} user={user} userRole="manager" profile={profile} isDark={false} />
        )}
        {activeTab === "trucks" && (
          <TruckBoard ref={truckBoardRef} user={user} userRole="admin" profile={profile} />
        )}
        {/* {activeTab === "manifests" && <ManifestPage />} */}
      </main>
    </div>
  );
}
