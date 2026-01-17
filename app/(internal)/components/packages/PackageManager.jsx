"use client";
import { useState } from "react";
import ReceivePackageForm from "./ReceivePackageForm";
import PackagesTable from "./PackagesTable";
import { faSync, faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function ManagerDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // When form submits successfully, increment key to reload table
  const handleSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <h1 className="font-bold text-white tracking-wide text-lg">
            Manager Operations
          </h1>
          {loading && (
            <FontAwesomeIcon
              icon={faSync}
              spin
              className="text-slate-500 text-xs"
            />
          )}
        </div>

        <div className="flex flex-1 w-full md:w-auto gap-3 justify-end">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* 1. The Input Form */}
      {/* <ReceivePackageForm onSuccess={handleSuccess} /> */}

      {/* 2. The Data View */}
      <PackagesTable refreshTrigger={refreshKey} />

      <ReceivePackageForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
