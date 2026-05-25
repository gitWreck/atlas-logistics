"use client";

import React from "react";
import AddUserModal from "../admin/AddUserModal";

export default function CustomerAddModal({
  isOpen,
  onClose,
  onSuccess,
  isDark = false,
}) {
  return (
    <AddUserModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      isDark={isDark}
      initialRole="customer"
      allowedRoles={["customer"]}
      title="Add Customer"
    />
  );
}
