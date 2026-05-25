"use client";

import React from "react";
import EditUserModal from "../admin/EditUserModal";

export default function CustomerEditModal({
  isOpen,
  onClose,
  onSuccess,
  customer,
  isDark = false,
}) {
  return (
    <EditUserModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      user={customer}
      isDark={isDark}
      title="Edit Customer"
      allowedRoles={["customer"]}
    />
  );
}
