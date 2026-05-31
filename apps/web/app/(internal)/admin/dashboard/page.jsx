"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import ShipmentBoard from "../../components/shipments/ShipmentBoard";
import TripBoard from "../../components/trips/TripBoard";
import AdminOverview from "../../components/admin/AdminOverview";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSignOutAlt,
  faRoute,
  faClipboardList,
  faCog,
  faQuestionCircle,
  faSun,
  faMoon,
  faChevronLeft,
  faChevronRight,
  faPlus,
  faFileCirclePlus,
} from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import { handleLogout } from "@/app/utility/utilities";
import NotificationBell from "../../components/notifications/NotificationBell";
import TruckBoard from "../../components/trucks/TruckBoard";
import InvoiceBoard from "../../components/invoice/InvoiceBoard";
import CustomerBoard from "../../components/customers/CustomerBoard";
import { mainNavItems } from "@/app/utility/constant/templates";

import {
  getDashboardThemeClasses,
  // getStatCardColors,
} from "@/app/utility/constant/theme";
import { useDashboardPreferences } from "@/app/hooks/useDashboardPreferences";

const secondaryNavItems = [
  { id: "tracking", label: "Tracking", icon: faRoute, disabled: true },
  { id: "manifest", label: "Manifest", icon: faClipboardList, disabled: true },
  { id: "settings", label: "Settings", icon: faCog, disabled: true },
  { id: "help", label: "Help", icon: faQuestionCircle, disabled: true },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const tabIds = useMemo(() => mainNavItems.map((item) => item.id), []);
  const { isDark, toggleDarkMode, activeTab, setActiveTab } =
    useDashboardPreferences("admin", tabIds);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const { user, profile, loading } = useAuth();

  const tripBoardRef = useRef(null);
  // const tripScheduleRef = useRef(null);
  const shipmentBoardRef = useRef(null);
  const truckBoardRef = useRef(null);
  const invoiceBoardRef = useRef(null);
  const customerBoardRef = useRef(null);
  const mainScrollRef = useRef(null);

  const currentTabConfig = useMemo(
    () => mainNavItems.find((tab) => tab.id === activeTab) || mainNavItems[0],
    [activeTab],
  );

  const theme = getDashboardThemeClasses(isDark);

  useEffect(() => {
    mainScrollRef.current?.scrollTo(0, 0);
  }, [activeTab]);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [activeTab]);

  const headerButton = useMemo(() => {
    if (activeTab === "trips") {
      return {
        label: "Trip",
        icon: faPlus,
        accent: "emerald",
        onClick: () => tripBoardRef.current?.openCreateTripModal?.(),
      };
    }

    if (activeTab === "shipments") {
      return {
        label: "Shipment",
        icon: faPlus,
        accent: "blue",
        onClick: () => shipmentBoardRef.current?.openCreateModal?.(),
      };
    }

    if (activeTab === "trucks") {
      return {
        label: "Truck",
        icon: faPlus,
        accent: "blue",
        onClick: () => truckBoardRef.current?.openRegisterModal?.(),
      };
    }

    if (activeTab === "invoice") {
      return {
        label: "Invoice",
        icon: faFileCirclePlus,
        accent: "emerald",
        onClick: () => invoiceBoardRef.current?.openCreateInvoice?.(),
      };
    }

    if (activeTab === "customers") {
      return {
        label: "Customer",
        icon: faPlus,
        accent: "blue",
        onClick: () => customerBoardRef.current?.openAddCustomerModal?.(),
      };
    }

    return null;
  }, [activeTab]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (profile?.role !== "admin") {
      console.warn("Unauthorized access attempt by:", user.email);
      handleLogout(auth, router);
      router.push("/login");
    }
  }, [user, profile, loading, router]);

  if (loading) return <div>Loading...</div>;
  if (!user || profile?.role !== "admin") return null;

  return (
    <div
      className={`h-screen flex font-sans overflow-hidden ${theme.rootBackground}`}
    >
      <div
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isMobileSidebarOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!isMobileSidebarOpen}
      >
        <button
          type="button"
          aria-label="Close navigation"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          onClick={() => setIsMobileSidebarOpen(false)}
        />

        <aside
          className={`relative h-full w-64 max-w-[80vw] shrink-0 border-r px-4 py-6 overflow-y-auto overflow-x-hidden transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } ${theme.sidebar}`}
        >
          <SidebarContent
            isDark={isDark}
            theme={theme}
            isSidebarCollapsed={false}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onNavigate={() => setIsMobileSidebarOpen(false)}
            router={router}
          />
        </aside>
      </div>

      <aside
        className={`hidden md:flex flex-col shrink-0 border-r px-4 py-6 overflow-y-auto overflow-x-hidden [transition-property:width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] ${
          isSidebarCollapsed ? "w-20" : "w-64"
        } ${theme.sidebar}`}
      >
        <SidebarContent
          isDark={isDark}
          theme={theme}
          isSidebarCollapsed={isSidebarCollapsed}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          router={router}
        />
      </aside>

      <section className="flex-1 flex flex-col min-h-0">
        <header
          className={`flex items-center justify-between gap-4 border-b pl-4 pr-4 sm:pl-6 sm:pr-6 py-4 min-h-[56px] ${theme.topbar}`}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className={`md:hidden h-9 w-9 shrink-0 flex items-center justify-center rounded-full border text-sm transition-colors duration-200 ${theme.mobileMenuButton}`}
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
              className={`hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-sm border transition-colors duration-200 ${theme.sidebarToggle}`}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={
                isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              aria-expanded={!isSidebarCollapsed}
            >
              <FontAwesomeIcon
                icon={faChevronLeft}
                size="sm"
                className={`transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isSidebarCollapsed ? "rotate-180" : "rotate-0"
                }`}
              />
            </button>
          </div>

          <div className={`flex-1 min-w-0 px-1 sm:px-2 ${theme.titleText}`}>
            <h1 className="font-bold tracking-wide text-lg uppercase leading-tight">
              {currentTabConfig?.title ?? "Dashboard"}
            </h1>
            <p className={`text-xs mt-0.5 leading-tight ${theme.subtitleText}`}>
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
              onClick={toggleDarkMode}
              className={`h-9 w-9 rounded-full border flex items-center justify-center ${theme.themeToggle}`}
              title="Toggle theme"
            >
              <FontAwesomeIcon icon={isDark ? faSun : faMoon} size="sm" />
            </button>

            <NotificationBell />

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

        <main ref={mainScrollRef} className="flex-1 overflow-y-auto">
          <div className="w-full">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
              {activeTab === "overview" && (
                <div className="space-y-4 sm:space-y-6">
                  <AdminOverview
                    user={user}
                    userRole="admin"
                    profile={profile}
                    isDark={isDark}
                  />
                </div>
              )}
            </div>

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
                <ShipmentBoard
                  ref={shipmentBoardRef}
                  user={user}
                  userRole="admin"
                  profile={profile}
                  isDark={isDark}
                />
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

              {activeTab === "customers" && (
                <CustomerBoard
                  ref={customerBoardRef}
                  user={user}
                  userRole="admin"
                  profile={profile}
                  isDark={isDark}
                />
              )}

              {activeTab === "invoice" && (
                <InvoiceBoard
                  ref={invoiceBoardRef}
                  user={user}
                  isDark={isDark}
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

function SidebarContent({
  isDark,
  theme,
  isSidebarCollapsed,
  activeTab,
  setActiveTab,
  onNavigate,
  router,
}) {
  return (
    <>
      <div
        className={`flex items-center transition-[gap] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isSidebarCollapsed ? "justify-center gap-0" : "gap-3"
        }`}
      >
        <img
          src="/atlas-logo.png"
          alt="Atlas"
          className="w-10 h-10 rounded-2xl object-contain shrink-0"
        />

        <div
          className={`min-w-0 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isSidebarCollapsed
              ? "max-w-0 opacity-0 -translate-x-2"
              : "max-w-40 opacity-100 translate-x-0"
          }`}
        >
          <div
            className={`whitespace-nowrap text-xs font-semibold tracking-[0.2em] uppercase ${theme.brandLabel}`}
          >
            Atlas
          </div>
          <div
            className={`whitespace-nowrap text-sm font-semibold ${theme.brandTitle}`}
          >
            Fast &amp; Easy Shipping
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div
          className={`overflow-hidden whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${theme.secondaryLabel} ${
            isSidebarCollapsed
              ? "max-w-0 opacity-0 -translate-x-2"
              : "max-w-20 opacity-100 translate-x-0"
          }`}
        >
          Main
        </div>

        <div className="mt-3 space-y-1">
          {mainNavItems.map((item) => {
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  onNavigate?.();
                }}
                className={`w-full flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-[background-color,color,gap] duration-300 ${
                  isSidebarCollapsed ? "justify-center gap-0" : "gap-3"
                } ${
                  isActive
                    ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25"
                    : theme.navIdle
                }`}
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${
                    isActive ? "bg-white/20 text-white" : theme.navIconIdle
                  }`}
                >
                  <FontAwesomeIcon icon={item.icon} size="sm" />
                </span>

                <span
                  className={`whitespace-nowrap overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isSidebarCollapsed
                      ? "max-w-0 opacity-0 -translate-x-2"
                      : "max-w-32 opacity-100 translate-x-0"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* {!isSidebarCollapsed && secondaryNavItems?.length > 0 && (
        <div className="mt-8">
          <div
            className={`text-[11px] font-semibold uppercase tracking-wide ${theme.secondaryLabel}`}
          >
            More
          </div>

          <div className="mt-3 space-y-1">
            {secondaryNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium opacity-60 cursor-not-allowed ${
                  theme.navIdle
                }`}
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${theme.navIconIdle}`}
                >
                  <FontAwesomeIcon icon={item.icon} size="sm" />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )} */}

      <div className="flex-1" />

      <div className="pt-4">
        <button
          type="button"
          onClick={() => handleLogout(auth, router)}
          className={`w-full flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-[background-color,color,gap] duration-300 ${
            isSidebarCollapsed ? "justify-center gap-0" : "gap-3"
          } ${theme.logoutButton}`}
        >
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${theme.logoutIcon}`}
          >
            <FontAwesomeIcon icon={faSignOutAlt} size="sm" />
          </span>

          <span
            className={`whitespace-nowrap overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isSidebarCollapsed
                ? "max-w-0 opacity-0 -translate-x-2"
                : "max-w-24 opacity-100 translate-x-0"
            }`}
          >
            Logout
          </span>
        </button>
      </div>
    </>
  );
}
