"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilter,
  faSearch,
  faSync,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import CustomerDrawer from "./CustomerDrawer";
import CustomerRow from "./CustomerRow";
import TablePaginationFooter from "../ui/TablePaginationFooter";
import { getBoardThemeClasses } from "@/app/utility/constant/theme";

const ITEMS_PER_PAGE = 10;

function getCustomerStatus(customer) {
  return String(
    customer?.status || (customer?.active === false ? "inactive" : "active"),
  ).toLowerCase();
}

function getCustomerId(customer) {
  return (
    customer?.publicId ||
    customer?.userCode ||
    customer?.customerCode ||
    customer?.uid ||
    customer?.id ||
    "N/A"
  );
}

function getEndpointForRole(userRole) {
  const role = String(userRole || "").toLowerCase();
  return role === "admin" || role === "manager"
    ? "/api/manager/customers"
    : "/api/customers";
}

export default function CustomerBoard({
  user,
  userRole,
  isDark = false,
  endpoint,
}) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const theme = getBoardThemeClasses(isDark);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);

      if (!user) {
        setCustomers([]);
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch(endpoint || getEndpointForRole(userRole), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to fetch customers");

      const data = await res.json();
      const list = data.users || data.customers || [];

      setCustomers(
        list.map((customer) => ({
          ...customer,
          id: customer.id || customer.uid,
          uid: customer.uid || customer.id,
        })),
      );
    } catch (err) {
      console.error("Error fetching customers:", err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, user, userRole]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    return customers.filter((customer) => {
      const status = getCustomerStatus(customer);

      if (statusFilter !== "ALL" && status !== statusFilter.toLowerCase()) {
        return false;
      }

      if (!keyword) return true;

      const address = customer.address || {};
      const searchContent = [
        customer.name,
        customer.email,
        customer.phoneNumber,
        customer.phone,
        getCustomerId(customer),
        address.street,
        address.barangay,
        address.city,
        address.province,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchContent.includes(keyword);
    });
  }, [customers, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const currentItems = filteredCustomers.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE,
  );
  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId,
  );

  return (
    <div className={`min-h-screen font-sans ${theme.page}`}>
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div
          className={`rounded-xl overflow-hidden shadow-xl backdrop-blur-sm border ${theme.board}`}
        >
          <div
            className={`px-4 sm:px-6 py-4 border-b flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 ${theme.header}`}
          >
            <h2
              className={`font-bold whitespace-nowrap flex items-center gap-2 ${theme.title}`}
            >
              <FontAwesomeIcon icon={faUsers} className={theme.iconMuted} />
              Customers
              <button
                type="button"
                onClick={fetchCustomers}
                disabled={loading}
                className={`transition-colors p-1 rounded ${theme.refreshButton}`}
                title="Refresh customers"
              >
                <FontAwesomeIcon icon={faSync} spin={loading} />
              </button>
            </h2>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-96">
                <FontAwesomeIcon
                  icon={faSearch}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.iconMuted}`}
                />
                <input
                  type="text"
                  placeholder="Search customers..."
                  className={`w-full rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none border ${theme.input}`}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>

              <div className="relative w-full sm:w-44">
                <FontAwesomeIcon
                  icon={faFilter}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${theme.iconMuted}`}
                />
                <select
                  className={`w-full rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none appearance-none cursor-pointer border ${theme.input}`}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="ALL">All Customers</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
          </div>

          <div className="md:overflow-x-auto">
            <div className="md:min-w-[900px]">
              <div
                className={`hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b text-xs font-semibold uppercase tracking-wider ${theme.tableHead}`}
              >
                <div className="col-span-3">Customer</div>
                <div className="col-span-3">Contact</div>
                <div className="col-span-3">Address</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              <div className="min-h-[400px]">
                {loading ? (
                  <div className={`p-16 text-center ${theme.emptyText}`}>
                    <div className="animate-pulse">Loading customers...</div>
                  </div>
                ) : currentItems.length === 0 ? (
                  <div className={`p-16 text-center italic ${theme.emptyText}`}>
                    No customers found.
                  </div>
                ) : (
                  currentItems.map((customer) => (
                    <CustomerRow
                      key={customer.id || customer.uid}
                      customer={customer}
                      onClick={() => setSelectedCustomerId(customer.id)}
                      isDark={isDark}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {!loading && filteredCustomers.length > 0 && (
            <TablePaginationFooter
              totalItems={filteredCustomers.length}
              currentPage={safeCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalPages={totalPages}
              onPrevious={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              onNext={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              theme={theme}
            />
          )}
        </div>
      </main>

      <CustomerDrawer
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomerId(null)}
        customer={selectedCustomer}
        isDark={isDark}
      />
    </div>
  );
}
