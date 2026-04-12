"use client";
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faFilter,
  faBarcode,
  faCircleNotch,
} from "@fortawesome/free-solid-svg-icons";

export default function PackagesTable({ refreshTrigger }) {
  const [packages, setPackages] = useState([]);
  const [filteredPackages, setFilteredPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // 1. Fetch Data
  const fetchPackages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/manager/packages/list"); // Ensure this API endpoint exists
      const data = await res.json();
      setPackages(data.packages || []);
      setFilteredPackages(data.packages || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Filter Logic
  useEffect(() => {
    let result = packages;

    // A. Apply Status Filter
    if (statusFilter !== "ALL") {
      result = result.filter((pkg) => pkg.status === statusFilter);
    }

    // B. Apply Search (Tracking # or Description)
    if (searchTerm.trim() !== "") {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(
        (pkg) =>
          pkg.packageId.toLowerCase().includes(lowerTerm) ||
          (pkg.description &&
            pkg.description.toLowerCase().includes(lowerTerm)) ||
          (pkg.shipmentId && pkg.shipmentId.toLowerCase().includes(lowerTerm)),
      );
    }

    setFilteredPackages(result);
  }, [searchTerm, statusFilter, packages]);

  // Refetch on parent trigger
  useEffect(() => {
    fetchPackages();
  }, [refreshTrigger]);

  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden shadow-xl">
      {/* Header with Search & Filter Controls */}
      <div className="px-6 py-4 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-950/30">
        <h3 className="font-bold text-white whitespace-nowrap">
          Recent Packages
        </h3>

        <div className="flex gap-2 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 md:w-64">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
            />
            <input
              type="text"
              placeholder="Search ID or Desc..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div className="relative w-36">
            <FontAwesomeIcon
              icon={faFilter}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
            />
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-blue-500 focus:outline-none appearance-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="RECEIVED">Received</option>
              <option value="LOADED">Loaded</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-950 text-slate-500 uppercase font-semibold text-xs sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3">Tracking ID</th>
              <th className="px-6 py-3">Content</th>
              <th className="px-6 py-3">Location</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-500">
                  <FontAwesomeIcon icon={faCircleNotch} spin /> Loading
                  packages...
                </td>
              </tr>
            ) : filteredPackages.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-500">
                  No packages found matching your filters.
                </td>
              </tr>
            ) : (
              filteredPackages.map((pkg) => (
                <tr
                  key={pkg.packageId}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="font-mono text-blue-400 font-bold">
                      {pkg.packageId}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      Shipment: {pkg.shipmentId}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-white font-medium">
                      {pkg.description}
                    </div>
                    <div className="text-xs text-slate-500">
                      {pkg.weight}kg • Box {pkg.sequence} of {pkg.totalSequence}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-300">{pkg.currentLocation}</div>
                    {pkg.currentTripId && (
                      <div className="text-xs text-amber-500">
                        Trip: {pkg.currentTripId}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={pkg.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded flex items-center gap-2 ml-auto transition-colors">
                      <FontAwesomeIcon icon={faBarcode} /> Print
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Helper Component for Status Colors
function StatusBadge({ status }) {
  const styles = {
    RECEIVED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    LOADED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    IN_TRANSIT: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    DELIVERED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    DEFAULT: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  const styleClass = styles[status] || styles.DEFAULT;

  return (
    <span
      className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold border ${styleClass}`}
    >
      {status?.replace(/_/g, " ")}
    </span>
  );
}
