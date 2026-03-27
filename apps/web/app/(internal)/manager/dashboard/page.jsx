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
  faSun,
  faMoon,
  faChevronLeft,
  faChevronRight,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import { handleLogout } from "@/app/utility/utilities";

import ManagerOverview from "../../components/manager/ManagerOverview";
import ShipmentBoard from "../../components/shipments/ShipmentBoard";
import TripBoard from "../../components/trips/TripBoard";
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

export default function ManagerDashboardPage() {
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
    mainScrollRef.current?.scrollTo(0, 0);
  }, [activeTab]);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (profile?.role !== "manager") {
      handleLogout(auth, router);
      console.warn("Unauthorized access attempt by:", user.email);
      router.push("/login");
    }
  }, [user, profile, loading, router]);

  if (loading)
    return (
      <div className="p-10 text-slate-400">Loading Manager Console...</div>
    );
  if (!user || profile?.role !== "manager") return null;

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
      {/* Mobile sidebar (off-canvas) */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <aside
            className={`relative h-full w-64 max-w-[80vw] shrink-0 border-r px-4 py-6 overflow-y-auto ${sidebarClasses}`}
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

      {/* Sidebar - desktop and tablet */}
      <aside
        className={`hidden md:flex flex-col ${
          isSidebarCollapsed ? "w-20" : "w-64"
        } shrink-0 border-r px-4 py-6 overflow-y-auto ${sidebarClasses}`}
      >
        <SidebarContent
          isDark={isDark}
          isSidebarCollapsed={isSidebarCollapsed}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          router={router}
        />
      </aside>

      {/* Main content area */}
      <section className="flex-1 flex flex-col min-h-0">
        <header
          className={`flex items-center justify-between gap-4 border-b pl-4 pr-4 sm:pl-6 sm:pr-6 py-4 min-h-[56px] ${topbarClasses}`}
        >
          <div className="flex items-center gap-2">
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

          <div
            className={`flex-1 min-w-0 px-1 sm:px-2 ${isDark ? "text-white" : "text-slate-900"}`}
          >
            <h1 className="font-bold tracking-wide text-lg uppercase leading-tight">
              {currentTabConfig?.title ?? "Manager Console"}
            </h1>
            <p
              className={`text-xs mt-0.5 leading-tight ${isDark ? "text-slate-400" : "text-slate-600"}`}
            >
              {currentTabConfig?.description ?? "Operations dashboard"}
            </p>
          </div>

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
            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              className="h-9 w-9 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              title="Toggle theme"
            >
              <FontAwesomeIcon icon={isDark ? faSun : faMoon} size="sm" />
            </button>

            <NotificationBell />

            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-medium">
                  {profile?.name || "Manager"}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  {profile?.role || "manager"}
                </div>
              </div>
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xs font-semibold text-white">
                {profile?.name?.[0]?.toUpperCase() || "M"}
              </div>
            </div>
          </div>
        </header>

        <main ref={mainScrollRef} className="flex-1 overflow-y-auto">
          {/* <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6"> */}
          <div className="w-full">
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
              {activeTab === "overview" && (
                <ManagerOverview
                  user={user}
                  userRole="manager"
                  profile={profile}
                  onNavigateToShipments={() => setActiveTab("shipments")}
                  isDark={isDark}
                />
              )}
            </div>

            {activeTab === "trips" && (
              <TripBoard
                ref={tripBoardRef}
                user={user}
                userRole="manager"
                profile={profile}
                isDark={isDark}
              />
            )}
            {activeTab === "shipments" && (
              <>
                <ShipmentBoard
                  ref={shipmentBoardRef}
                  user={user}
                  userRole="manager"
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
                userRole="manager"
                profile={profile}
                isDark={isDark}
              />
            )}
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
              Manager
            </div>
          </div>
        )}
      </div>

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
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1" />

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
