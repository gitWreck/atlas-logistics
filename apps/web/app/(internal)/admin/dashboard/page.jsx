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
import PickupBoard from "../../components/shipments/PickupBoard";

const mainNavItems = [
  {
    id: "overview",
    label: "Dashboard",
    icon: faChartPie,
    title: "Overview",
    description: "Operations dashboard",
  },
  {
    id: "trips",
    label: "Trips",
    icon: faMapSigns,
    title: "Trip Board",
    description: "Manage truck assignments and routes.",
  },
  {
    id: "shipments",
    label: "Shipments",
    icon: faTruck,
    title: "Shipments",
    description: "Manage shipments and orders.",
  },
  {
    id: "trucks",
    label: "Trucks",
    icon: faTruckLoading,
    title: "Truck Board",
    description: "Manage fleet health and availability.",
  },
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { user, profile, loading } = useAuth();
  const tripBoardRef = useRef(null);
  const shipmentBoardRef = useRef(null);
  const truckBoardRef = useRef(null);
  const mainScrollRef = useRef(null);

  const currentTabConfig = useMemo(
    () => mainNavItems.find((t) => t.id === activeTab) || mainNavItems[0],
    [activeTab],
  );

  useEffect(() => {
    mainScrollRef.current?.scrollTo(0, 0);
  }, [activeTab]);

  // Close the mobile sidebar whenever the active tab changes
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [activeTab]);

  const headerButton = useMemo(() => {
    if (activeTab === "trips")
      return {
        label: "Trip",
        icon: faPlus,
        accent: "emerald",
        onClick: () => tripBoardRef.current?.openCreateTripModal?.(),
      };
    if (activeTab === "shipments")
      return {
        label: "Shipment",
        icon: faPlus,
        accent: "blue",
        onClick: () => shipmentBoardRef.current?.openCreateModal?.(),
      };
    if (activeTab === "trucks")
      return {
        label: "Register Truck",
        icon: faPlus,
        accent: "blue",
        onClick: () => truckBoardRef.current?.openRegisterModal?.(),
      };
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

  const statCards = [
    {
      title: "Active Trips",
      value: "2",
      subtitle: "Trips currently in progress",
      colors: {
        bg: isDark
          ? "bg-indigo-950/40 border-indigo-800"
          : "bg-indigo-50 border-indigo-100",
        title: isDark ? "text-indigo-300" : "text-indigo-700",
        val: isDark ? "text-indigo-100" : "text-indigo-900",
        sub: isDark ? "text-indigo-400" : "text-indigo-600",
      },
    },
    {
      title: "Delayed Trips",
      value: "2",
      subtitle: "Trips requiring attention",
      colors: {
        bg: isDark
          ? "bg-amber-950/40 border-amber-800"
          : "bg-amber-50 border-amber-100",
        title: isDark ? "text-amber-300" : "text-amber-700",
        val: isDark ? "text-amber-100" : "text-amber-900",
        sub: isDark ? "text-amber-400" : "text-amber-600",
      },
    },
    {
      title: "Pickup Requests",
      value: "3",
      subtitle: "Pending driver assignments",
      colors: {
        bg: isDark
          ? "bg-sky-950/40 border-sky-800"
          : "bg-sky-50 border-sky-100",
        title: isDark ? "text-sky-300" : "text-sky-700",
        val: isDark ? "text-sky-100" : "text-sky-900",
        sub: isDark ? "text-sky-400" : "text-sky-600",
      },
    },
    {
      title: "Delivered Trips",
      value: "4",
      subtitle: "Completed within SLA",
      colors: {
        bg: isDark
          ? "bg-emerald-950/40 border-emerald-800"
          : "bg-emerald-50 border-emerald-100",
        title: isDark ? "text-emerald-300" : "text-emerald-700",
        val: isDark ? "text-emerald-100" : "text-emerald-900",
        sub: isDark ? "text-emerald-400" : "text-emerald-600",
      },
    },
  ];

  return (
    <div
      className={`h-screen flex font-sans overflow-hidden ${rootBackgroundClasses}`}
    >
      {/* Mobile sidebar (off-canvas) */}
      {isMobileSidebarOpen && (
        // <div className="fixed inset-0 z-40 md:hidden">
        <div
          className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${
            isMobileSidebarOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          {/* <aside
            className={`relative h-full w-64 max-w-[80vw] shrink-0 border-r px-4 py-6 overflow-y-auto ${sidebarClasses}`}
          > */}
          <aside
            className={`relative h-full w-64 max-w-[80vw] shrink-0 border-r px-4 py-6 overflow-y-auto
            transform transition-transform duration-300 ease-in-out
            ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
            ${sidebarClasses}`}
          >
            <SidebarContent
              isDark={isDark}
              isSidebarCollapsed={false}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onNavigate={() => setIsMobileSidebarOpen(false)}
              router={router}
            />
          </aside>
        </div>
      )}

      {/* Sidebar - fixed height, does not scroll (desktop and tablet) */}
      {/* <aside
        className={`hidden md:flex flex-col ${
          isSidebarCollapsed ? "w-20" : "w-64"
        } shrink-0 border-r px-4 py-6 overflow-y-auto ${sidebarClasses}`}
      > */}
      <aside
        className={`hidden md:flex flex-col shrink-0 border-r px-4 py-6 overflow-y-auto
        transition-all duration-300 ease-in-out
        ${isSidebarCollapsed ? "w-20" : "w-64"}
        ${sidebarClasses}`}
      >
        <SidebarContent
          isDark={isDark}
          isSidebarCollapsed={isSidebarCollapsed}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          router={router}
        />
      </aside>

      {/* Main content area - min-h-0 lets main scroll inside flex */}
      <section className="flex-1 flex flex-col min-h-0">
        {/* Topbar - collapse button + title + actions */}
        <header
          className={`flex items-center justify-between gap-4 border-b pl-4 pr-4 sm:pl-6 sm:pr-6 py-4 min-h-[56px] ${topbarClasses}`}
        >
          <div className="flex items-center gap-2">
            {/* Mobile sidebar toggle */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className={`md:hidden h-9 w-9 shrink-0 flex items-center justify-center rounded-full border text-sm ${
                isDark
                  ? "border-slate-700 bg-slate-900 text-slate-100"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
              aria-label="Open navigation"
              aria-expanded={isMobileSidebarOpen}
            >
              <span className="space-y-1">
                <span className="block w-4 h-0.5 rounded bg-current" />
                <span className="block w-4 h-0.5 rounded bg-current" />
                <span className="block w-4 h-0.5 rounded bg-current" />
              </span>
            </button>

            {/* Sidebar collapse toggle (desktop) */}
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
          </div>

          {/* Tab title & description */}
          <div
            className={`flex-1 min-w-0 px-1 sm:px-2 ${isDark ? "text-white" : "text-slate-900"}`}
          >
            <h1 className="font-bold tracking-wide text-lg uppercase leading-tight">
              {currentTabConfig?.title ?? "Dashboard"}
            </h1>
            <p
              className={`text-xs mt-0.5 leading-tight ${isDark ? "text-slate-400" : "text-slate-600"}`}
            >
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
        <main ref={mainScrollRef} className="flex-1 overflow-y-auto">
          <div className="w-full">
            {/* <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6"> */}
            {/* Summary cards row - only show on Overview tab */}
            {/* <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
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
              {activeTab === "overview" && (
                <AdminOverview
                  user={user}
                  userRole="admin"
                  profile={profile}
                  isDark={isDark}
                />
              )}
            </div> */}

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
              {activeTab === "overview" && (
                <div className="space-y-4 sm:space-y-6">
                  {/* --- STATS GRID --- */}
                  {/* grid-cols-2 makes it a 2x2 square on phones, lg:grid-cols-4 makes it a single row on desktop */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {statCards.map((stat, index) => (
                      <div
                        key={index}
                        className={`rounded-xl sm:rounded-2xl border px-3 py-3 sm:px-4 sm:py-4 flex flex-col justify-center ${stat.colors.bg}`}
                      >
                        <div
                          className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide ${stat.colors.title}`}
                        >
                          {stat.title}
                        </div>
                        <div
                          className={`mt-1 sm:mt-2 text-xl sm:text-2xl font-semibold ${stat.colors.val}`}
                        >
                          {stat.value}
                        </div>
                        <div
                          className={`mt-1 text-[9px] sm:text-xs leading-tight ${stat.colors.sub}`}
                        >
                          {stat.subtitle}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* --- ADMIN OVERVIEW --- */}
                  <AdminOverview
                    user={user}
                    userRole="admin"
                    profile={profile}
                    isDark={isDark}
                  />
                </div>
              )}
            </div>

            {/* Active tab content */}
            <div>
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
                <>
                  <ShipmentBoard
                    ref={shipmentBoardRef}
                    user={user}
                    userRole="admin"
                    profile={profile}
                    isDark={isDark}
                  />
                  <PickupBoard
                    ref={shipmentBoardRef}
                    user={user}
                    userRole="admin"
                    profile={profile}
                    isDark={isDark}
                  />
                </>
              )}
              {activeTab === "trucks" && (
                <TruckBoard
                  ref={truckBoardRef}
                  user={user}
                  userRole="admin"
                  profile={profile}
                  isDark={isDark}
                />
              )}
            </div>
          </div>
        </main>
      </section>
    </div>
  );
}

function SidebarContent({
  isDark,
  isSidebarCollapsed,
  activeTab,
  setActiveTab,
  onNavigate,
  router,
}) {
  return (
    <>
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
                onClick={() => {
                  setActiveTab(item.id);
                  onNavigate?.();
                }}
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
                {/* {!isSidebarCollapsed && <span>{item.label}</span>} */}
                <span
                  className={`whitespace-nowrap transition-opacity duration-200 ${
                    isSidebarCollapsed
                      ? "opacity-0 w-0 overflow-hidden"
                      : "opacity-100"
                  }`}
                >
                  {item.label}
                </span>
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
          className={`w-full flex items-center ${
            isSidebarCollapsed ? "justify-center" : "gap-3"
          } rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
            isDark
              ? "text-slate-300 hover:bg-slate-800"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${
              isDark
                ? "bg-slate-900 text-slate-300"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            <FontAwesomeIcon icon={faSignOutAlt} size="sm" />
          </span>
          {!isSidebarCollapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  );
}
