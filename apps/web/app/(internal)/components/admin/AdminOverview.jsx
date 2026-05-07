"use client";

import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faUserCheck,
  faUserTimes,
  faShieldAlt,
  faHistory,
  faClock,
  faCheckCircle,
  faExclamationTriangle,
  faTruckFast,
} from "@fortawesome/free-solid-svg-icons";

import DisableUserModal from "./DisableUserModal";
import AddUserModal from "./AddUserModal";
import EditUserModal from "./EditUserModal";
import StatusCard from "../ui/StatusCard";
import UserManagementTable from "./UserManagementTable";
import DelayWidget from "../delay/DelayWidget";
import RecentAlertsLogs from "../logs/RecentAlertsLogs";
import RecentAdminLogs from "../logs/RecentAdminLogs";
import RecentSmsLogs from "../logs/RecentSmsLogs";
import Statistics from "../statistics/Statistics";
import { getOverviewThemeClasses } from "@/app/utility/constant/theme";

export default function AdminOverview({ user, isDark = false }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    actions24h: 0,
    actionsTotal: 0,

    activeTrips: 0,
    delayedTrips: 0,
    pickupRequests: 0,
    deliveredTrips: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("today");

  const [isUserModalOpen, setUserModalOpen] = useState(false);
  const [isDisableModalOpen, setDisableModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const theme = getOverviewThemeClasses(isDark);

  useEffect(() => {
    if (user?.customClaims?.admin) {
      console.log("This user is definitely an admin.");
    }
  }, [user]);

  const fetchUsers = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/admin/dashboard");
      const data = await res.json();

      if (data.users) {
        setUsers(data.users);
      }

      if (data.stats) {
        setStats((prev) => ({
          ...prev,
          ...data.stats,
        }));
      }
    } catch (err) {
      console.error("Failed to load dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTripStats = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const token = await user.getIdToken();

      const res = await fetch(`/api/trips/statistics?range=${dateRange}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to load admin overview");
      }

      const data = await res.json();

      setStats((prev) => ({
        ...prev,
        ...(data.stats || {
          activeTrips: 0,
          delayedTrips: 0,
          pickupRequests: 0,
          deliveredTrips: 0,
        }),
      }));
    } catch (error) {
      console.error("Admin overview fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchTripStats();
  }, [dateRange, user]);

  const handleEditClick = (userData) => {
    setSelectedUser(userData);
    setEditModalOpen(true);
  };

  const initiateDisable = (userData) => {
    setSelectedUser(userData);
    setDisableModalOpen(true);
  };

  const rangeLabel =
    dateRange === "today"
      ? "Today"
      : dateRange === "7days"
        ? "Last 7 Days"
        : "Last 30 Days";

  const adminCards = [
    {
      title: "Active Trips",
      value: stats.activeTrips,
      subtitle: "Trips currently in progress",
      icon: faTruckFast,
      variant: "indigo",
    },
    {
      title: "Delayed Trips",
      value: stats.delayedTrips,
      subtitle: "Trips requiring attention",
      icon: faExclamationTriangle,
      variant: "amber",
    },
    {
      title: "Pickup Requests",
      value: stats.pickupRequests,
      subtitle: "Pending driver assignments",
      icon: faClock,
      variant: "sky",
    },
    {
      title: "Delivered Trips",
      value: stats.deliveredTrips,
      subtitle: "Completed within SLA",
      icon: faCheckCircle,
      variant: "emerald",
    },
  ];

  const summaryCards = [
    {
      title: "Total Users",
      value: stats.total,
      icon: faUsers,
      color: isDark ? "text-blue-400" : "text-blue-600",
      bg: isDark ? "bg-blue-500/20" : "bg-blue-100",
    },
    {
      title: "Active Accounts",
      value: stats.active,
      icon: faUserCheck,
      color: isDark ? "text-emerald-400" : "text-emerald-600",
      bg: isDark ? "bg-emerald-500/20" : "bg-emerald-100",
    },
    {
      title: "Inactive / Banned",
      value: stats.inactive,
      icon: faUserTimes,
      color: isDark ? "text-red-400" : "text-red-600",
      bg: isDark ? "bg-red-500/20" : "bg-red-100",
    },
  ];

  const analyticsCards = [
    {
      title: "Admin Actions (24h)",
      value: stats.actions24h ?? 0,
      icon: faShieldAlt,
      iconClasses: isDark
        ? "bg-indigo-500/20 text-indigo-400"
        : "bg-indigo-100 text-indigo-600",
    },
    {
      title: "Total Audit Events",
      value: stats.actionsTotal ?? 0,
      icon: faHistory,
      iconClasses: isDark
        ? "bg-slate-600/30 text-slate-300"
        : "bg-slate-100 text-slate-600",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <DelayWidget isDark={isDark} />

      <Statistics
        title="Statistics"
        description="Metrics based on updates since"
        rangeLabel={rangeLabel}
        dateRange={dateRange}
        setDateRange={setDateRange}
        cards={adminCards}
        loading={loading}
        isDark={isDark}
        theme={theme}
        gridClassName="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {summaryCards.map((card) => (
          <StatusCard
            key={card.title}
            title={card.title}
            value={card.value}
            icon={card.icon}
            color={card.color}
            bg={card.bg}
            isDark={isDark}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {analyticsCards.map((card) => (
          <div
            key={card.title}
            className={`p-5 rounded-xl border shadow-sm flex items-center justify-between ${theme.analyticsCard}`}
          >
            <div>
              <p
                className={`text-xs font-bold uppercase tracking-wider mb-1 ${theme.analyticsLabel}`}
              >
                {card.title}
              </p>
              <p className={`text-2xl font-mono ${theme.analyticsValue}`}>
                {card.value}
              </p>
            </div>

            <div
              className={`h-10 w-10 rounded-lg flex items-center justify-center ${card.iconClasses}`}
            >
              <FontAwesomeIcon icon={card.icon} />
            </div>
          </div>
        ))}
      </div>

      <UserManagementTable
        users={users}
        loading={loading}
        onEditUser={handleEditClick}
        onDeleteUser={initiateDisable}
        onAddUser={() => setUserModalOpen(true)}
        isDark={isDark}
      />

      {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"></div> */}
      <RecentAdminLogs isDark={isDark} />
      <RecentSmsLogs isDark={isDark} />
      <RecentAlertsLogs isDark={isDark} />

      <AddUserModal
        isOpen={isUserModalOpen}
        onClose={() => setUserModalOpen(false)}
        isDark={isDark}
        onSuccess={fetchUsers}
      />

      <EditUserModal
        isOpen={isEditModalOpen}
        user={selectedUser}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchUsers}
        isDark={isDark}
      />

      <DisableUserModal
        isOpen={isDisableModalOpen}
        user={selectedUser}
        onClose={() => {
          setDisableModalOpen(false);
          setSelectedUser(null);
        }}
        refreshUsers={fetchUsers}
        isDark={isDark}
      />
    </div>
  );
}
