import ShipmentLabel from "../ShipmentLabel";
import StatusBadge from "../../ui/StatusBadge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faQrcode,
  faEllipsisV,
  faWineGlass,
  faSnowflake,
} from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";
import PackageActionModal from "./PackageActionModal";

// --- SUB-COMPONENT: DESKTOP TABLE ROW ---
export default function PackageTableRow({
  pkg,
  idx,
  shipmentData,
  isDark = false,
}) {
  const [showQR, setShowQR] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);

  return (
    <>
      <tr
        className={`transition-colors group ${isDark ? "hover:bg-slate-800/50" : "hover:bg-slate-50"}`}
      >
        <td className="p-4 text-center">
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded border text-xs font-mono font-bold transition-colors ${
              isDark
                ? "bg-slate-800 border-slate-700 text-slate-500 group-hover:bg-slate-700 group-hover:text-white"
                : "bg-slate-100 border-slate-200 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-900"
            }`}
          >
            {pkg.sequence || idx + 1}
          </span>
        </td>

        <td className="p-4">
          <div
            className={`font-medium text-sm ${isDark ? "text-slate-200" : "text-slate-900"}`}
          >
            {pkg.description || "No Description"}
          </div>
          <div
            className={`text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}
          >
            {pkg.packagingType || "Package"} •{" "}
            {pkg.quantity ? `${pkg.quantity} qty` : "N/A"}
          </div>
          {(pkg.isFragile || pkg.isPerishable) && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
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
        </td>

        <td className="p-4">
          <div className="font-mono text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded w-fit border border-amber-500/20">
            {pkg.trackingNumber}
          </div>
        </td>

        <td className="p-4">
          <StatusBadge status={pkg.status} size="xs" isDark={isDark} />
        </td>

        <td className="p-4 text-right gap-1 flex justify-end">
          <button
            onClick={() => setShowQR(!showQR)}
            className={`w-8 h-8 rounded inline-flex items-center justify-center transition-all ${
              showQR
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
                : isDark
                  ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700"
                  : "bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-slate-900 border border-slate-300"
            }`}
            title="Toggle QR Code"
          >
            <FontAwesomeIcon icon={faQrcode} />
          </button>
          <button
            onClick={() => setShowActionModal(true)} // Change this from setShowQR
            className={`w-8 h-8 rounded inline-flex items-center justify-center transition-all ${
              showQR
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
                : isDark
                  ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700"
                  : "bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-slate-900 border border-slate-300"
            }`}
            title="Action"
          >
            <FontAwesomeIcon icon={faEllipsisV} />
          </button>
        </td>
      </tr>

      {showQR && (
        <tr
          className={`animate-in fade-in zoom-in-95 duration-200 ${isDark ? "bg-slate-900/50" : "bg-slate-50"}`}
        >
          <td colSpan="5" className="p-4">
            <div
              className={`flex items-center gap-6 border rounded-xl p-4 max-w-lg mx-auto shadow-inner ${
                isDark
                  ? "bg-slate-950 border-slate-800"
                  : "bg-white border-slate-200"
              }`}
            >
              <ShipmentLabel
                shipment={shipmentData}
                packages={pkg}
                index={idx}
              />
            </div>
          </td>
        </tr>
      )}
      {/* Add the Modal Component at the end of the row/card */}
      {showActionModal && (
        <PackageActionModal
          pkg={pkg}
          shipmentId={shipmentData.id}
          onClose={() => setShowActionModal(false)}
          isDark={isDark}
        />
      )}
    </>
  );
}
