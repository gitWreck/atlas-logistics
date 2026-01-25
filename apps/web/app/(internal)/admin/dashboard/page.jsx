"use client";
import React, { useState } from "react"; // Added useEffect
import TripManager from "../../components/trips/TripManager";
import ShipmentBoard from "../../components/shipments/ShipmentBoard";
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
import PackageManager from "../../components/packages/PackageManager";
import ManifestPage from "../../components/manifests/ManifestBoard";
import TabButton from "../../components/ui/TabButton";
// import NotificationBell from "../../../../../../NotificationBell";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  // 👇 THIS IS HOW YOU ACCESS THE INFO NOW
  const { user, profile, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  // Optional: Security Check
  // if (!profile || profile.role !== "admin") {
  //   router.push("/login"); // Uncomment to auto-redirect
  //   return <div>Access Denied: You are not an admin.</div>;
  // }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* --- ADMIN HEADER --- */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-6 pt-4 pb-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
                A
              </div>
              <div>
                <h1 className="font-bold text-white tracking-wide text-lg uppercase">
                  Admin Console
                </h1>
                <p className="text-xs text-slate-500">System Management</p>
              </div>
            </div>

            {/* ✅ DYNAMIC USER INFO */}
            <div className="flex items-center gap-4">
              {/* 1. INSERT BELL HERE */}
              {/* <NotificationBell /> */}

              {/* Divider (Optional visual separator) */}
              <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>

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
                onClick={() => {
                  handleLogout(auth, router);
                }}
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
              label="Overview & Users"
            />
            <TabButton
              isActive={activeTab === "shipments"}
              onClick={() => setActiveTab("shipments")}
              icon={faTruck}
              label="Shipment Operations"
            />
            <TabButton
              isActive={activeTab === "manifests"}
              onClick={() => setActiveTab("manifests")}
              icon={faTruckLoading}
              label="Manifest & Trips"
            />
            {/* <TabButton
              isActive={activeTab === "manager"}
              onClick={() => setActiveTab("manager")}
              icon={faMapSigns}
              label="Package Manager"
            /> */}
            {/* <TabButton
              isActive={activeTab === "trips"}
              onClick={() => setActiveTab("trips")}
              icon={faMapSigns}
              label="Trip Operations"
            /> */}
          </div>
        </div>
      </header>

      {/* --- CONTENT AREA --- */}
      <main className="max-w-7xl mx-auto p-6">
        {activeTab === "overview" && <AdminOverview />}
        {activeTab === "shipments" && <ShipmentBoard userRole="admin" />}
        {activeTab === "manifests" && <ManifestPage />}
        {/* {activeTab === "manager" && <PackageManager />} */}
        {/* {activeTab === "trips" && <TripManager />} */}
      </main>
    </div>
  );
}
