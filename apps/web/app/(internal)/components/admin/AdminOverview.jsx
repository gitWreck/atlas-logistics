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
import { useAuth } from "@/apps/web/app/context/AuthContext";

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
      <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="font-bold text-white">User Management</h2>
          <button
            onClick={() => setUserModalOpen(true)}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
          >
            + Add User
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-950 text-slate-500 uppercase font-semibold text-xs">
              <tr>
                <th className="px-6 py-3">Name / Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td
                    colSpan="4"
                    className="px-6 py-8 text-center text-slate-600"
                  >
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    className="px-6 py-8 text-center text-slate-600"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-200">
                        {u.name || "—"}
                      </div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-800 px-2 py-1 rounded text-xs border border-slate-700 font-mono">
                        {u.role || "USER"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          u.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}
                      >
                        {u.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => initiateDisable(u)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
