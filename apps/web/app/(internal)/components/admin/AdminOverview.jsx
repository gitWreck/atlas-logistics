"use client";
import React, { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faUserCheck,
  faUserTimes,
  faShieldAlt,
  faHistory,
} from "@fortawesome/free-solid-svg-icons";
import DisableUserModal from "./DisableUserModal";
import AddUserModal from "./AddUserModal";
import StatusCard from "../ui/StatusCard";
import UserManagementTable from "./UserManagementTable";
import DelayApprovalWidget from "../delay/DelayWidget";
import RecentAlertsLogs from "../logs/RecentAlertsLogs";
import RecentSmsLogs from "../logs/RecentSmsLogs";

export default function AdminOverview({ user, isDark = false }) {
  if (user?.customClaims?.admin) {
    console.log("This user is definitely an admin.");
  }

  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  });

  const [loading, setLoading] = useState(true);

  const [isUserModalOpen, setUserModalOpen] = useState(false);
  const [isDisableModalOpen, setDisableModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // const listUsers = httpsCallable(functions, "listUsers");
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/dashboard");
      const data = await res.json();

      if (data.users) setUsers(data.users);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error("Failed to load dashboard", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchUsers();
  }, []);

  const initiateDisable = (user) => {
    setSelectedUser(user);
    setDisableModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <DelayApprovalWidget isDark={isDark} />

      {/* 1. STATS GRID (DYNAMIC) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatusCard
          title="Total Users"
          value={stats.total}
          icon={faUsers}
          color={isDark ? "text-blue-400" : "text-blue-600"}
          bg={isDark ? "bg-blue-500/20" : "bg-blue-100"}
          isDark={isDark}
        />
        <StatusCard
          title="Active Accounts"
          value={stats.active}
          icon={faUserCheck}
          color={isDark ? "text-emerald-400" : "text-emerald-600"}
          bg={isDark ? "bg-emerald-500/20" : "bg-emerald-100"}
          isDark={isDark}
        />
        <StatusCard
          title="Inactive / Banned"
          value={stats.inactive}
          icon={faUserTimes}
          color={isDark ? "text-red-400" : "text-red-600"}
          bg={isDark ? "bg-red-500/20" : "bg-red-100"}
          isDark={isDark}
        />
      </div>

      {/* 2. ANALYTICS GRID (MOCKED FOR NOW) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={`p-5 rounded-xl border shadow-sm flex items-center justify-between ${
            isDark
              ? "border-slate-700 bg-slate-800/50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div>
            <p
              className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Admin Actions (24h)
            </p>
            <p
              className={`text-2xl font-mono ${isDark ? "text-slate-100" : "text-slate-900"}`}
            >
              {stats.actions24h}
            </p>
          </div>
          <div
            className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              isDark ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-100 text-indigo-600"
            }`}
          >
            <FontAwesomeIcon icon={faShieldAlt} />
          </div>
        </div>
        <div
          className={`p-5 rounded-xl border shadow-sm flex items-center justify-between ${
            isDark
              ? "border-slate-700 bg-slate-800/50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div>
            <p
              className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Total Audit Events
            </p>
            <p
              className={`text-2xl font-mono ${isDark ? "text-slate-100" : "text-slate-900"}`}
            >
              {stats.actionsTotal}
            </p>
          </div>
          <div
            className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              isDark ? "bg-slate-600/30 text-slate-300" : "bg-slate-100 text-slate-600"
            }`}
          >
            <FontAwesomeIcon icon={faHistory} />
          </div>
        </div>
      </div>

      {/* 3. USER MANAGEMENT TABLE */}
      <UserManagementTable
        users={users}
        loading={loading}
        onDeleteUser={initiateDisable}
        onAddUser={() => setUserModalOpen(true)}
        isDark={isDark}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* LEFT: INCOMING ALERTS */}
        <RecentAlertsLogs isDark={isDark} />

        {/* RIGHT: OUTGOING LOGS */}
        <RecentSmsLogs isDark={isDark} />
      </div>

      {/* MODALS */}
      <AddUserModal
        isOpen={isUserModalOpen}
        onClose={() => setUserModalOpen(false)}
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
      />
    </div>
  );
}
