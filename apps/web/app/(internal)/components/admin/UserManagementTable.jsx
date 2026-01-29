import React, { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faSearch,
  faFilter,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

export default function UserManagementTable({
  users,
  loading,
  onDeleteUser,
  onAddUser,
}) {
  // --- STATE ---
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  // --- LOGIC ---
  const filteredUsers = useMemo(() => {
    // Reset to page 1 if filters change
    if (page !== 1 && (search || roleFilter !== "ALL")) setPage(1);

    return users.filter((u) => {
      const matchesSearch =
        (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter, page]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );

  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden shadow-lg">
      {/* A. HEADER */}
      <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/30">
        <h2 className="font-bold text-white">User Management</h2>
        <button
          onClick={onAddUser}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 font-bold shadow-lg shadow-blue-900/20"
        >
          + Add User
        </button>
      </div>

      {/* B. FILTERS */}
      <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/20 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <FontAwesomeIcon
            icon={faSearch}
            className="absolute left-3 top-2.5 text-slate-500 text-xs"
          />
          <input
            type="text"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:border-blue-500 outline-none transition-colors"
          />
        </div>
        {/* Role Filter */}
        <div className="relative w-full sm:w-40">
          <FontAwesomeIcon
            icon={faFilter}
            className="absolute left-3 top-2.5 text-slate-500 text-xs"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:border-blue-500 outline-none appearance-none cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="driver">Driver</option>
            <option value="checker">Checker</option>
          </select>
        </div>
      </div>

      {/* C. TABLE */}
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
                  <div className="animate-pulse">Loading users...</div>
                </td>
              </tr>
            ) : paginatedUsers.length === 0 ? (
              <tr>
                <td
                  colSpan="4"
                  className="px-6 py-8 text-center text-slate-600 italic"
                >
                  {users.length === 0
                    ? "No users found."
                    : "No matching users found."}
                </td>
              </tr>
            ) : (
              paginatedUsers.map((u) => (
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
                    <span className="bg-slate-800 px-2 py-1 rounded text-xs border border-slate-700 font-mono uppercase">
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
                      onClick={() => onDeleteUser(u)}
                      className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded hover:bg-slate-800"
                      title="Disable User"
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

      {/* D. PAGINATION FOOTER */}
      {!loading && filteredUsers.length > 0 && (
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/30 flex justify-between items-center text-xs">
          <span className="text-slate-500">
            Showing{" "}
            <span className="text-white font-bold">
              {(page - 1) * itemsPerPage + 1}
            </span>{" "}
            to{" "}
            <span className="text-white font-bold">
              {Math.min(page * itemsPerPage, filteredUsers.length)}
            </span>{" "}
            of {filteredUsers.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="mr-1" /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next <FontAwesomeIcon icon={faChevronRight} className="ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
