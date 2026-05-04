import React, { useState, useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faSearch,
  faFilter,
  faChevronLeft,
  faChevronRight,
  faEdit,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { getTableTheme } from "@/app/utility/constant/theme";

export default function UserManagementTable({
  users = [],
  loading = false,
  onDeleteUser,
  onAddUser,
  onEditUser,
  isDark = false,
  title = "User Management",
  addButtonLabel = "User",
  allowedRoles = null,
  showRoleFilter = true,
  loadingMessage = "Loading users...",
  emptyUsersMessage = "No users found.",
  emptySearchMessage = "No matching users found.",
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const itemsPerPage = 5;
  const theme = getTableTheme(isDark);
  const allowedRoleSet = useMemo(
    () => (allowedRoles?.length ? new Set(allowedRoles) : null),
    [allowedRoles],
  );
  const hasRowActions = Boolean(onEditUser || onDeleteUser);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (allowedRoleSet && !allowedRoleSet.has(user.role)) {
        return false;
      }

      const name = (user.name || "").toLowerCase();
      const email = (user.email || "").toLowerCase();
      const publicId = (
        user.publicId ||
        user.userCode ||
        user.driverCode ||
        ""
      ).toLowerCase();
      const keyword = search.toLowerCase();

      const matchesSearch =
        name.includes(keyword) ||
        email.includes(keyword) ||
        publicId.includes(keyword);

      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter, allowedRoleSet]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / itemsPerPage),
  );

  const currentPage = Math.min(page, totalPages);

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const emptyMessage =
    users.length === 0 ? emptyUsersMessage : emptySearchMessage;

  return (
    <div
      className={`border rounded-xl overflow-hidden shadow-lg ${theme.container}`}
    >
      {/* Header */}
      <div
        className={`px-4 sm:px-6 py-4 border-b flex justify-between items-center ${theme.header}`}
      >
        <h2 className={`font-bold ${theme.headingText}`}>{title}</h2>

        {onAddUser && (
          <button
            type="button"
            onClick={onAddUser}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 font-bold shadow-lg shadow-blue-900/20"
          >
            <FontAwesomeIcon icon={faPlus} className="hidden sm:inline-block" />
            <span>{addButtonLabel}</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div
        className={`px-4 sm:px-6 py-3 border-b flex flex-col sm:flex-row gap-3 ${theme.filters}`}
      >
        <div className="relative flex-1">
          <FontAwesomeIcon
            icon={faSearch}
            className={`absolute left-3 top-2.5 ${theme.inputIcon}`}
          />
          <input
            type="text"
            placeholder="Search name, email, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full border rounded-lg pl-8 pr-3 py-1.5 focus:border-blue-500 outline-none transition-colors ${theme.input}`}
          />
        </div>

        {showRoleFilter && (
          <div className="relative w-full sm:w-40">
            <FontAwesomeIcon
              icon={faFilter}
              className={`absolute left-3 top-2.5 ${theme.inputIcon}`}
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className={`w-full border rounded-lg pl-8 pr-3 py-1.5 focus:border-blue-500 outline-none appearance-none cursor-pointer ${theme.input}`}
            >
              <option value="ALL">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="driver">Driver</option>
              <option value="checker">Checker</option>
              <option value="customer">Customer</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="w-full">
        {/* Mobile */}
        <div
          className={`md:hidden flex flex-col divide-y ${theme.tbodyDivide}`}
        >
          {loading ? (
            <div className={`px-6 py-8 text-center ${theme.emptyText}`}>
              <div className="animate-pulse">{loadingMessage}</div>
            </div>
          ) : paginatedUsers.length === 0 ? (
            <div className={`px-6 py-8 text-center italic ${theme.emptyText}`}>
              {emptyMessage}
            </div>
          ) : (
            paginatedUsers.map((user) => {
              const isActive = user.status === "active";

              return (
                <div
                  key={user.id}
                  className={`p-4 flex flex-col gap-3 transition-colors ${theme.rowHover}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="truncate">
                      <div
                        className={`font-medium truncate ${theme.cellPrimary}`}
                      >
                        {user.name || "—"}
                      </div>
                      <div
                        className={`text-[10px] font-mono mt-0.5 ${theme.cellSecondary}`}
                      >
                        {user.publicId ||
                          user.userCode ||
                          user.driverCode ||
                          "—"}
                      </div>
                      <div
                        className={`text-xs truncate ${theme.cellSecondary}`}
                      >
                        {user.email}
                      </div>
                    </div>

                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        isActive ? theme.statusActive : theme.statusInactive
                      }`}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="flex justify-between items-end mt-1">
                    <span
                      className={`px-2 py-1 rounded text-[10px] border font-mono uppercase ${theme.roleBadge}`}
                    >
                      {user.role || "USER"}
                    </span>

                    {hasRowActions && (
                      <div className="flex gap-1">
                        {onEditUser && (
                          <button
                            type="button"
                            onClick={() => onEditUser(user)}
                            className={`transition-colors p-2 rounded ${theme.editButton}`}
                            title="Edit User"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                        )}

                        {onDeleteUser && (
                          <button
                            type="button"
                            onClick={() => onDeleteUser(user)}
                            className={`transition-colors p-2 rounded ${theme.deleteButton}`}
                            title="Disable User"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className={`w-full text-left text-sm ${theme.tableText}`}>
            <thead className={`uppercase font-semibold text-xs ${theme.thead}`}>
              <tr>
                <th className="px-6 py-3">User ID</th>
                <th className="px-6 py-3">Name / Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                {hasRowActions && (
                  <th className="px-6 py-3 text-right">Action</th>
                )}
              </tr>
            </thead>

            <tbody className={`divide-y ${theme.tbodyDivide}`}>
              {loading ? (
                <tr>
                  <td
                    colSpan={hasRowActions ? 5 : 4}
                    className={`px-6 py-8 text-center ${theme.emptyText}`}
                  >
                    <div className="animate-pulse">{loadingMessage}</div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={hasRowActions ? 5 : 4}
                    className={`px-6 py-8 text-center italic ${theme.emptyText}`}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  const isActive = user.status === "active";

                  return (
                    <tr
                      key={user.id}
                      className={`transition-colors ${theme.rowHover}`}
                    >
                      <td className="px-6 py-4">
                        <div
                          className={`font-mono text-xs ${theme.cellPrimary}`}
                        >
                          {user.publicId ||
                            user.userCode ||
                            user.driverCode ||
                            "—"}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className={`font-medium ${theme.cellPrimary}`}>
                          {user.name || "—"}
                        </div>
                        <div className={`text-xs ${theme.cellSecondary}`}>
                          {user.email}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-xs border font-mono uppercase ${theme.roleBadge}`}
                        >
                          {user.role || "USER"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            isActive ? theme.statusActive : theme.statusInactive
                          }`}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {hasRowActions && (
                        <td className="px-6 py-4 text-right">
                          {onEditUser && (
                            <button
                              type="button"
                              onClick={() => onEditUser(user)}
                              className={`transition-colors p-2 rounded ${theme.editButton}`}
                              title="Edit User"
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                          )}

                          {onDeleteUser && (
                            <button
                              type="button"
                              onClick={() => onDeleteUser(user)}
                              className={`transition-colors p-2 rounded ${theme.deleteButton}`}
                              title="Disable User"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && filteredUsers.length > 0 && (
        <div
          className={`px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row justify-between items-center gap-3 text-xs ${theme.footer}`}
        >
          <span>
            Showing{" "}
            <span className={`font-bold ${theme.footerBold}`}>
              {Math.min(currentPage * itemsPerPage, filteredUsers.length)}
            </span>{" "}
            of {filteredUsers.length}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
            >
              <FontAwesomeIcon icon={faChevronLeft} className="mr-1" />
            </button>

            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
            >
              <FontAwesomeIcon icon={faChevronRight} className="ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
