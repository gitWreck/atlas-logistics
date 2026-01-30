"use client";
import React, { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faUserCheck,
  faUserTimes,
  faShieldAlt,
  faHistory,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import DisableUserModal from "./DisableUserModal";
import AddUserModal from "./AddUserModal";
import StatusCard from "../ui/StatusCard";
import { useAuth } from "@/app/context/AuthContext";
import UserManagementTable from "./UserManagementTable";
import DelayApprovalWidget from "../delay/DelayApprovalWIdget";

export default function AdminOverview() {
  const { user } = useAuth();
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
      <DelayApprovalWidget />

      {/* 1. STATS GRID (DYNAMIC) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard
          title="Total Users"
          value={stats.total}
          icon={faUsers}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
        <StatusCard
          title="Active Accounts"
          value={stats.active}
          icon={faUserCheck}
          color="text-emerald-400"
          bg="bg-emerald-500/10"
        />
        <StatusCard
          title="Inactive / Banned"
          value={stats.inactive}
          icon={faUserTimes}
          color="text-red-400"
          bg="bg-red-500/10"
        />
      </div>

      {/* 2. ANALYTICS GRID (MOCKED FOR NOW) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Admin Actions (24h)
            </p>
            <p className="text-2xl font-mono text-slate-200">
              {stats.actions24h}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <FontAwesomeIcon icon={faShieldAlt} />
          </div>
        </div>
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Total Audit Events
            </p>
            <p className="text-2xl font-mono text-slate-200">
              {stats.actionsTotal}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-slate-700/30 flex items-center justify-center text-slate-400">
            <FontAwesomeIcon icon={faHistory} />
          </div>
        </div>
      </div>

      {/* 3. USERS TABLE (REAL DATA) */}
      <UserManagementTable
        users={users}
        loading={loading}
        onDeleteUser={initiateDisable}
        onAddUser={() => setUserModalOpen(true)}
      />

      {/* 4. MODAL */}
      <AddUserModal
        isOpen={isUserModalOpen}
        onClose={() => setUserModalOpen(false)}
      />
      <DisableUserModal
        isOpen={isDisableModalOpen}
        user={selectedUser}
        onClose={() => {
          setDisableModalOpen(false);
          setSelectedUser(null);
        }}
        refreshUsers={fetchUsers} // <-- NEW
      />
    </div>
  );
}
