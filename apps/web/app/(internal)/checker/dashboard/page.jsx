"use client";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartPie,
  faTruck,
  faSignOutAlt,
  faClipboardCheck,
  faSun,
  faMoon,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import { handleLogout } from "@/app/utility/utilities";
import NotificationBell from "../../components/notifications/NotificationBell";
import CheckerOverview from "../../components/checker/CheckerOverview.jsx";
import CheckerBoard from "../../components/checker/CheckerBoard";
import ShipmentBoard from "../../components/shipments/ShipmentBoard";
import { useDashboardPreferences } from "@/app/hooks/useDashboardPreferences";

const mainNavItems = [
  { id: "overview", label: "Overview", icon: faChartPie, title: "Overview", description: "Warehouse operations dashboard" },
  { id: "checkerBoard", label: "Checker Board", icon: faClipboardCheck, title: "Checker Board", description: "Scan and manage package flows." },
  { id: "shipments", label: "Shipments", icon: faTruck, imageIcon: "/truck-3d.png", title: "Shipment Operations", description: "Manage shipments and orders." },
];

export default function CheckerDashboardPage() {
  const router = useRouter();
  const tabIds = useMemo(() => mainNavItems.map((item) => item.id), []);
  const { isDark, toggleDarkMode, activeTab, setActiveTab } =
    useDashboardPreferences("checker", tabIds);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { user, profile, loading } = useAuth();
  const mainScrollRef = useRef(null);

  const currentTabConfig = useMemo(() => mainNavItems.find((t) => t.id === activeTab) || mainNavItems[0], [activeTab]);

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
    if (profile?.role !== "checker") {
      handleLogout(auth, router);
      console.warn("Unauthorized access attempt by:", user.email);
      router.push("/login");
    }
  }, [user, profile, loading, router]);

  if (loading) return <div className="p-10 text-slate-400">Loading Checker Console...</div>;
  if (!user || profile?.role !== "checker") return null;

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

          <div className={`flex-1 min-w-0 px-1 sm:px-2 ${isDark ? "text-white" : "text-slate-900"}`}>
            <h1 className="font-bold tracking-wide text-lg uppercase leading-tight">
              {currentTabConfig?.title ?? "Checker Console"}
            </h1>
            <p className={`text-xs mt-0.5 leading-tight ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {currentTabConfig?.description ?? "Warehouse operations"}
            </p>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="h-9 w-9 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              title="Toggle theme"
            >
              <FontAwesomeIcon icon={isDark ? faSun : faMoon} size="sm" />
            </button>

            <NotificationBell />

            <div className="hidden sm:flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-medium">
                  {profile?.name || "Checker"}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  {profile?.role || "checker"}
                </div>
              </div>
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xs font-semibold text-white">
                {profile?.name?.[0]?.toUpperCase() || "C"}
              </div>
            </div>
          </div>
        </header>

        <main ref={mainScrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
            {activeTab === "overview" && (
              <CheckerOverview isDark={isDark} />
            )}
            {activeTab === "checkerBoard" && (
              <CheckerBoard isDark={isDark} />
            )}
            {activeTab === "shipments" && (
              <ShipmentBoard
                user={user}
                userRole="checker"
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
              Checker
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
                  {item.imageIcon ? (
                    <img
                      src={item.imageIcon}
                      alt=""
                      className="h-7 w-7 object-contain"
                    />
                  ) : (
                    <FontAwesomeIcon icon={item.icon} size="sm" />
                  )}
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
