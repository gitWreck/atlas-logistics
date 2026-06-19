import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faQrcode,
  faBoxOpen,
  faWineGlass,
  faSnowflake,
  faEllipsisV,
  faPen,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../../ui/StatusBadge";
import PackageActionModal from "./PackageActionModal";
import PieceStatusOverrideModal from "./PieceStatusOverrideModal";
import ShipmentLabel from "../ShipmentLabel";
import { useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { canOverridePieceStatus } from "@/app/utility/roleAccess";

// --- SUB-COMPONENT: MOBILE CARD ROW ---
export default function PackageMobileCard({
  pkg,
  idx,
  shipmentData,
  isDark = false,
  onRefresh,
  profile = null,
}) {
  const { profile: authProfile } = useAuth();
  const effectiveProfile = profile || authProfile;
  const showPieceStatusOverride = canOverridePieceStatus(effectiveProfile);

  const [showQR, setShowQR] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  return (
    <div
      className={`p-4 space-y-3 transition-colors ${
        isDark
          ? "bg-slate-900/50 hover:bg-slate-800/30"
          : "bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex gap-3 items-center">
          <span
            className={`inline-flex items-center justify-center w-8 h-8 rounded border text-xs font-mono font-bold ${
              isDark
                ? "bg-slate-800 border-slate-700 text-slate-400"
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}
          >
            {pkg.sequence || idx + 1}
          </span>
          <div className="font-mono text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded w-fit border border-amber-500/20">
            {pkg.packageId}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowActionModal(true)}
            className={`w-8 h-8 rounded inline-flex items-center justify-center transition-all ${
              isDark
                ? "bg-slate-800 text-slate-400 border border-slate-700"
                : "bg-slate-200 text-slate-600 border border-slate-300"
            }`}
            title="Piece actions"
          >
            <FontAwesomeIcon icon={faEllipsisV} />
          </button>

          <button
            onClick={() => setShowQR(!showQR)}
          className={`w-8 h-8 rounded inline-flex items-center justify-center transition-all ${
            showQR
              ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
              : isDark
                ? "bg-slate-800 text-slate-400 border border-slate-700"
                : "bg-slate-200 text-slate-600 border border-slate-300"
          }`}
        >
          <FontAwesomeIcon icon={faQrcode} />
          </button>
        </div>
      </div>

      <div className="pl-11">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`min-w-0 flex-1 truncate font-medium text-sm ${isDark ? "text-slate-200" : "text-slate-900"}`}
            title={pkg.description || "No Description"}
          >
            {pkg.description || "No Description"}
          </span>

          <span
            className={`inline-flex shrink-0 items-center gap-1.5 text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}
          >
            <FontAwesomeIcon
              icon={faBoxOpen}
              className={isDark ? "text-slate-600" : "text-slate-500"}
            />
            {pkg.packagingType || "Package"}
          </span>

          <span
            className={`shrink-0 text-xs ${isDark ? "text-slate-700" : "text-slate-400"}`}
          >
            |
          </span>

          <span
            className={`shrink-0 text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}
          >
            {pkg.weight ? `${pkg.weight}kg` : "N/A"}
          </span>

          <span className="shrink-0 flex items-center gap-1.5">
            <StatusBadge status={pkg.status} size="xs" isDark={isDark} />
            {showPieceStatusOverride && (
              <button
                type="button"
                onClick={() => setShowStatusModal(true)}
                className={`w-7 h-7 rounded inline-flex items-center justify-center ${
                  isDark
                    ? "bg-slate-800 text-slate-400 border border-slate-700"
                    : "bg-slate-200 text-slate-600 border border-slate-300"
                }`}
                title="Change piece status"
              >
                <FontAwesomeIcon icon={faPen} className="text-[10px]" />
              </button>
            )}
          </span>
        </div>

        {(pkg.isFragile || pkg.isPerishable) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {pkg.isFragile && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isDark
                    ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                    : "bg-amber-50 border border-amber-200 text-amber-700"
                }`}
              >
                <FontAwesomeIcon icon={faWineGlass} className="text-[8px]" />{" "}
                Fragile
              </span>
            )}
            {pkg.isPerishable && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isDark
                    ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
                    : "bg-cyan-50 border border-cyan-200 text-cyan-700"
                }`}
              >
                <FontAwesomeIcon icon={faSnowflake} className="text-[8px]" />{" "}
                Perishable
              </span>
            )}
          </div>
        )}

      </div>

      {showQR && (
        <div
          className={`mt-4 pt-4 border-t animate-in fade-in zoom-in-95 duration-200 ${isDark ? "border-slate-800" : "border-slate-200"}`}
        >
          <div
            className={`border rounded-xl p-4 flex justify-center shadow-inner ${
              isDark
                ? "bg-slate-950 border-slate-800"
                : "bg-white border-slate-200"
            }`}
          >
            {/* Scale down label slightly on mobile if needed via CSS in ShipmentLabel */}
            <ShipmentLabel shipment={shipmentData} packages={pkg} index={idx} />
          </div>
        </div>
      )}
      {/* Add the Modal Component at the end of the row/card */}
      {showStatusModal && (
        <PieceStatusOverrideModal
          pkg={pkg}
          shipmentId={shipmentData.id}
          onClose={() => setShowStatusModal(false)}
          isDark={isDark}
          onRefresh={onRefresh}
        />
      )}

      {showActionModal && (
        <PackageActionModal
          pkg={pkg}
          shipmentId={shipmentData.id}
          onClose={() => setShowActionModal(false)}
          isDark={isDark}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
