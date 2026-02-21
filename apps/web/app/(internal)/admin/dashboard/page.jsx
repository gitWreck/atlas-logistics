"use client";
import React, { useEffect, useState, useRef, useMemo } from "react";
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
  faRoute,
  faClipboardList,
  faCog,
  faQuestionCircle,
  faSun,
  faMoon,
  faChevronLeft,
  faChevronRight,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import { handleLogout } from "@/app/utility/utilities";
import NotificationBell from "../../components/notifications/NotificationBell";
import TruckBoard from "../../components/trucks/TruckBoard";

const mainNavItems = [
  { id: "overview", label: "Dashboard", icon: faChartPie, title: "Overview", description: "Operations dashboard" },
  { id: "trips", label: "Trips", icon: faMapSigns, title: "Trip Board", description: "Manage truck assignments and routes." },
  { id: "shipments", label: "Shipments", icon: faTruck, title: "Shipments", description: "Manage shipments and orders." },
  { id: "trucks", label: "Trucks", icon: faTruckLoading, title: "Truck Board", description: "Manage fleet health and availability." },
];

const secondaryNavItems = [
  { id: "tracking", label: "Tracking", icon: faRoute, disabled: true },
  { id: "manifest", label: "Manifest", icon: faClipboardList, disabled: true },
  { id: "settings", label: "Settings", icon: faCog, disabled: true },
  { id: "help", label: "Help", icon: faQuestionCircle, disabled: true },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [isDark, setIsDark] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { user, profile, loading } = useAuth();
  const tripBoardRef = useRef(null);
  const shipmentBoardRef = useRef(null);
  const truckBoardRef = useRef(null);

  const currentTabConfig = useMemo(() => mainNavItems.find((t) => t.id === activeTab) || mainNavItems[0], [activeTab]);

  const headerButton = useMemo(() => {
    if (activeTab === "trips") return { label: "Trip", icon: faPlus, accent: "emerald", onClick: () => tripBoardRef.current?.openCreateTripModal?.() };
    if (activeTab === "shipments") return { label: "Shipment", icon: faPlus, accent: "blue", onClick: () => shipmentBoardRef.current?.openCreateModal?.() };
    if (activeTab === "trucks") return { label: "Register Truck", icon: faPlus, accent: "blue", onClick: () => truckBoardRef.current?.openRegisterModal?.() };
    return null;
  }, [activeTab]);

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

  const rootBackgroundClasses = isDark
    ? "bg-slate-950 text-slate-100"
    : "bg-slate-50 text-slate-900";

  const sidebarClasses = isDark
    ? "bg-slate-900 border-slate-800"
    : "bg-white border-slate-200";

  const topbarClasses = isDark
    ? "bg-slate-900 border-slate-800"
    : "bg-white border-slate-200";

  const sidebarToggleClasses = isDark
    ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-slate-50"
    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900";

  return (
    <div
      className={`h-screen flex font-sans overflow-hidden ${rootBackgroundClasses}`}
    >
      {/* Sidebar - fixed height, does not scroll */}
      <aside
        className={`hidden md:flex flex-col ${
          isSidebarCollapsed ? "w-20" : "w-64"
        } shrink-0 border-r px-4 py-6 overflow-y-auto ${sidebarClasses}`}
      >
        {/* Logo / Brand */}
        <div
          className={`flex items-center ${
            isSidebarCollapsed ? "justify-center" : "gap-3"
          }`}
        >
          <img
            src="/atlas-logo.png"
            alt="Atlas"
            className="w-10 h-10 rounded-2xl object-contain shrink-0"
          />
          {!isSidebarCollapsed && (
            <div className="ml-3">
              <div
                className={`text-xs font-semibold tracking-[0.2em] uppercase ${
                  isDark ? "text-slate-400" : "text-slate-600"
                }`}
              >
                Atlas
              </div>
              <div
                className={`text-sm font-semibold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                Fast &amp; Easy Shipping
              </div>
            </div>
          )}
        </div>

        {/* Main Navigation */}
        <div className="mt-8">
          {!isSidebarCollapsed && (
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Main
            </div>
          )}
          <div className="mt-3 space-y-1">
            {mainNavItems.map((item) => {
              const isActive = activeTab === item.id;
              const idleClasses = isDark
                ? "text-slate-200 hover:bg-slate-800"
                : "text-slate-700 hover:bg-slate-100";

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? "justify-center" : "gap-3"
                  } rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25"
                      : idleClasses
                  }`}
                >
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${
                      isActive
                        ? "bg-white/20 text-white"
                        : isDark
                          ? "bg-slate-100/10 text-slate-400"
                          : "bg-slate-900/5 text-slate-500"
                    }`}
                  >
                    <FontAwesomeIcon icon={item.icon} size="sm" />
                  </span>
                  {!isSidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Logout */}
        <div className="pt-4">
          <button
            type="button"
            onClick={() => handleLogout(auth, router)}
            className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
          >
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                <FontAwesomeIcon icon={faSignOutAlt} size="sm" />
              </span>
              {!isSidebarCollapsed && <span>Logout</span>}
            </span>
          </button>
        </div>
      </aside>

      {/* Main content area - min-h-0 lets main scroll inside flex */}
      <section className="flex-1 flex flex-col min-h-0">
        {/* Topbar - collapse button + title + actions */}
        <header
          className={`flex items-center justify-between gap-4 border-b pl-4 pr-4 sm:pl-6 sm:pr-6 py-4 min-h-[72px] ${topbarClasses}`}
        >
          {/* Sidebar collapse toggle */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className={`hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-sm ${sidebarToggleClasses}`}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <FontAwesomeIcon
              icon={isSidebarCollapsed ? faChevronRight : faChevronLeft}
              size="sm"
            />
          </button>

          {/* Tab title & description */}
          <div className={`flex-1 min-w-0 px-2 ${isDark ? "text-white" : "text-slate-900"}`}>
            <h1 className="font-bold tracking-wide text-lg uppercase leading-tight">
              {currentTabConfig?.title ?? "Dashboard"}
            </h1>
            <p className={`text-xs mt-0.5 leading-tight ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {currentTabConfig?.description ?? "Operations dashboard"}
            </p>
          </div>

          {/* Actions + optional header button */}
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
            {/* Theme toggle */}
            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              className="h-9 w-9 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              title="Toggle theme"
            >
              <FontAwesomeIcon icon={isDark ? faSun : faMoon} size="sm" />
            </button>

            {/* Notifications */}
            <NotificationBell />

            {/* User */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-medium">
                  {profile?.name || "Admin User"}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  {profile?.role || "admin"}
                </div>
              </div>
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-xs font-semibold text-white">
                {profile?.name?.[0]?.toUpperCase() || "A"}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
            {/* Summary cards row - only show on Overview tab */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div
                  className={`rounded-2xl border px-4 py-3 ${
                    isDark
                      ? "bg-indigo-950/40 border-indigo-800 text-indigo-200"
                      : "bg-indigo-50 border-indigo-100"
                  }`}
                >
                  <div
                    className={`text-xs font-medium uppercase tracking-wide ${
                      isDark ? "text-indigo-300" : "text-indigo-700"
                    }`}
                  >
                    Active Trips
                  </div>
                  <div
                    className={`mt-2 text-2xl font-semibold ${
                      isDark ? "text-indigo-100" : "text-indigo-900"
                    }`}
                  >
                    2
                  </div>
                  <div
                    className={`mt-1 text-xs ${isDark ? "text-indigo-400" : "text-indigo-600"}`}
                  >
                    Trips currently in progress
                  </div>
                </div>

                <div
                  className={`rounded-2xl border px-4 py-3 ${
                    isDark
                      ? "bg-amber-950/40 border-amber-800 text-amber-200"
                      : "bg-amber-50 border-amber-100"
                  }`}
                >
                  <div
                    className={`text-xs font-medium uppercase tracking-wide ${
                      isDark ? "text-amber-300" : "text-amber-700"
                    }`}
                  >
                    Delayed Trips
                  </div>
                  <div
                    className={`mt-2 text-2xl font-semibold ${
                      isDark ? "text-amber-100" : "text-amber-900"
                    }`}
                  >
                    2
                  </div>
                  <div
                    className={`mt-1 text-xs ${isDark ? "text-amber-400" : "text-amber-600"}`}
                  >
                    Trips requiring attention
                  </div>
                </div>

                <div
                  className={`rounded-2xl border px-4 py-3 ${
                    isDark
                      ? "bg-sky-950/40 border-sky-800 text-sky-200"
                      : "bg-sky-50 border-sky-100"
                  }`}
                >
                  <div
                    className={`text-xs font-medium uppercase tracking-wide ${
                      isDark ? "text-sky-300" : "text-sky-700"
                    }`}
                  >
                    Pickup Requests
                  </div>
                  <div
                    className={`mt-2 text-2xl font-semibold ${
                      isDark ? "text-sky-100" : "text-sky-900"
                    }`}
                  >
                    3
                  </div>
                  <div
                    className={`mt-1 text-xs ${isDark ? "text-sky-400" : "text-sky-600"}`}
                  >
                    Pending driver assignments
                  </div>
                </div>

                <div
                  className={`rounded-2xl border px-4 py-3 ${
                    isDark
                      ? "bg-emerald-950/40 border-emerald-800 text-emerald-200"
                      : "bg-emerald-50 border-emerald-100"
                  }`}
                >
                  <div
                    className={`text-xs font-medium uppercase tracking-wide ${
                      isDark ? "text-emerald-300" : "text-emerald-700"
                    }`}
                  >
                    Delivered Trips
                  </div>
                  <div
                    className={`mt-2 text-2xl font-semibold ${
                      isDark ? "text-emerald-100" : "text-emerald-900"
                    }`}
                  >
                    4
                  </div>
                  <div
                    className={`mt-1 text-xs ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
                  >
                    Completed within SLA
                  </div>
                </div>
              </div>
            )}

            {/* Active tab content */}
            <div>
                {activeTab === "overview" && (
                  <AdminOverview
                    user={user}
                    userRole="admin"
                    profile={profile}
                    isDark={isDark}
                  />
                )}
                {activeTab === "trips" && (
                  <TripBoard
                    ref={tripBoardRef}
                    user={user}
                    userRole="admin"
                    profile={profile}
                    isDark={isDark}
                  />
                )}
                {activeTab === "shipments" && (
                  <ShipmentBoard
                    ref={shipmentBoardRef}
                    user={user}
                    userRole="admin"
                    profile={profile}
                  />
                )}
                {activeTab === "trucks" && (
                  <TruckBoard
                    ref={truckBoardRef}
                    user={user}
                    userRole="admin"
                    profile={profile}
                  />
                )}
            </div>
          </div>
        </main>
      </section>
    </div>
  );
}
