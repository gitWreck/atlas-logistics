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
  isDark = false,
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  const filteredUsers = useMemo(() => {
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

  const containerClasses = isDark
    ? "border-slate-800 bg-slate-900/50"
    : "border-slate-200 bg-white shadow-sm";
  const headerClasses = isDark
    ? "border-slate-800 bg-slate-950/30"
    : "border-slate-200 bg-slate-50";
  const filtersClasses = isDark
    ? "border-slate-800 bg-slate-950/20"
    : "border-slate-200 bg-slate-50/50";
  const inputClasses = isDark
    ? "bg-slate-900 border-slate-700 text-slate-200"
    : "bg-white border-slate-200 text-slate-900";
  const theadClasses = isDark
    ? "bg-slate-950 text-slate-500"
    : "bg-slate-50 text-slate-600";
  const tbodyDivide = isDark ? "divide-slate-800" : "divide-slate-200";
  const rowHover = isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-50";
  const cellPrimary = isDark ? "text-slate-200" : "text-slate-900";
  const cellSecondary = isDark ? "text-slate-500" : "text-slate-600";
  const roleBadgeClasses = isDark
    ? "bg-slate-800 border-slate-700"
    : "bg-slate-100 border-slate-200 text-slate-700";
  const statusActiveClasses = isDark
    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    : "bg-emerald-100 text-emerald-700 border-emerald-200";
  const statusInactiveClasses = isDark
    ? "bg-red-500/10 text-red-400 border-red-500/20"
    : "bg-red-100 text-red-700 border-red-200";
  const actionBtnClasses = isDark
    ? "text-slate-500 hover:text-red-400 hover:bg-slate-800"
    : "text-slate-600 hover:text-red-600 hover:bg-slate-100";
  const footerClasses = isDark
    ? "border-slate-800 bg-slate-950/30 text-slate-500"
    : "border-slate-200 bg-slate-50 text-slate-600";
  const footerBold = isDark ? "text-white" : "text-slate-900";
  const paginationBtnClasses = isDark
    ? "border-slate-700 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800"
    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900";

  return (
    <div
      className={`border rounded-xl overflow-hidden shadow-lg ${containerClasses}`}
    >
      {/* A. HEADER */}
      <div
        className={`px-6 py-4 border-b flex justify-between items-center ${headerClasses}`}
      >
        <h2
          className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}
        >
          User Management
        </h2>
        <button
          onClick={onAddUser}
          className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 font-bold shadow-lg shadow-blue-900/20"
        >
          + Add User
        </button>
      </div>

      {/* B. FILTERS */}
      <div
        className={`px-6 py-3 border-b flex flex-col sm:flex-row gap-3 ${filtersClasses}`}
      >
        <div className="relative flex-1">
          <FontAwesomeIcon
            icon={faSearch}
            className={`absolute left-3 top-2.5 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
          />
          <input
            type="text"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:border-blue-500 outline-none transition-colors ${inputClasses}`}
          />
        </div>
        <div className="relative w-full sm:w-40">
          <FontAwesomeIcon
            icon={faFilter}
            className={`absolute left-3 top-2.5 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={`w-full border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:border-blue-500 outline-none appearance-none cursor-pointer ${inputClasses}`}
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
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="min-w-[720px] px-4 sm:px-0">
          <table
            className={`w-full text-left text-sm ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
          <thead className={`uppercase font-semibold text-xs ${theadClasses}`}>
            <tr>
              <th className="px-6 py-3">Name / Email</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${tbodyDivide}`}>
            {loading ? (
              <tr>
                <td
                  colSpan="4"
                  className={`px-6 py-8 text-center ${isDark ? "text-slate-600" : "text-slate-500"}`}
                >
                  <div className="animate-pulse">Loading users...</div>
                </td>
              </tr>
            ) : paginatedUsers.length === 0 ? (
              <tr>
                <td
                  colSpan="4"
                  className={`px-6 py-8 text-center italic ${isDark ? "text-slate-600" : "text-slate-500"}`}
                >
                  {users.length === 0
                    ? "No users found."
                    : "No matching users found."}
                </td>
              </tr>
            ) : (
              paginatedUsers.map((u) => (
                <tr key={u.id} className={`${rowHover} transition-colors`}>
                  <td className="px-6 py-4">
                    <div className={`font-medium ${cellPrimary}`}>
                      {u.name || "—"}
                    </div>
                    <div className={`text-xs ${cellSecondary}`}>{u.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs border font-mono uppercase ${roleBadgeClasses}`}
                    >
                      {u.role || "USER"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        u.status === "active"
                          ? statusActiveClasses
                          : statusInactiveClasses
                      }`}
                    >
                      {u.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => onDeleteUser(u)}
                      className={`transition-colors p-2 rounded ${actionBtnClasses}`}
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
      </div>

      {/* D. PAGINATION FOOTER */}
      {!loading && filteredUsers.length > 0 && (
        <div
          className={`px-6 py-4 border-t flex justify-between items-center text-xs ${footerClasses}`}
        >
          <span>
            Showing{" "}
            <span className={`font-bold ${footerBold}`}>
              {(page - 1) * itemsPerPage + 1}
            </span>{" "}
            to{" "}
            <span className={`font-bold ${footerBold}`}>
              {Math.min(page * itemsPerPage, filteredUsers.length)}
            </span>{" "}
            of {filteredUsers.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-3 py-1.5 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-all ${paginationBtnClasses}`}
            >
              <FontAwesomeIcon icon={faChevronLeft} className="mr-1" /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`px-3 py-1.5 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-all ${paginationBtnClasses}`}
            >
              Next <FontAwesomeIcon icon={faChevronRight} className="ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
