import React from "react";
import { useAuth } from "../../../contexts/AuthContext";
import ScanInfoAuditScreen from "./ScanInfoAuditScreen";

/**
 * Read-only Scan Info modal (Step 4.2b).
 * @deprecated name kept for scan.js import compatibility
 */
export default function ShipmentInfoModal(props) {
  const { profile } = useAuth();
  const role = String(profile?.role || "").toLowerCase();
  const showManagerAudit = role === "admin" || role === "manager";

  return (
    <ScanInfoAuditScreen {...props} showManagerAudit={showManagerAudit} />
  );
}
