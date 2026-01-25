"use client";
import { useState } from "react";
import ReceivePackageForm from "../components/shipments/ReceivePackageForm";
import PackagesTable from "../components/packages/PackagesTable";

export default function ManagerDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  // When form submits successfully, increment key to reload table
  const handleSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Manager Operations</h1>

      {/* 1. The Input Form */}
      <ReceivePackageForm onSuccess={handleSuccess} />

      {/* 2. The Data View */}
      <PackagesTable refreshTrigger={refreshKey} />
    </div>
  );
}
