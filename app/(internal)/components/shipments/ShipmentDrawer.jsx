import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruck,
  faCheckCircle,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import StatusBadge from "../ui/StatusBadge";

export default function ShipmentDrawer({ isOpen, onClose, data }) {
  if (!data) return null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <aside
        className={`
          fixed top-0 right-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-800 z-50 shadow-2xl transform transition-transform duration-300
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex justify-between items-start">
            <div>
              <h2 className="text-xl font-mono text-white font-bold">
                {data.tracking}
              </h2>
              <div className="flex gap-2 mt-2">
                <StatusBadge status={data.status} />
                <span className="text-xs text-slate-500 py-1">
                  {data.route}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <FontAwesomeIcon icon={faTimes} size="lg" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  Trip ID
                </div>
                <div className="text-slate-200 font-mono font-medium">
                  {data.trip || "—"}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                  Driver/Owner
                </div>
                <div className="text-slate-200 font-medium truncate">
                  {data.owner}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <FontAwesomeIcon icon={faTruck} className="text-blue-500" />
                Shipment Progress
              </h3>
              <div className="space-y-6 relative pl-2">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-800"></div>
                {[
                  "RECEIVED",
                  "LOADED",
                  "IN_TRANSIT",
                  "ARRIVED_PORT",
                  "DELIVERED",
                ].map((step, idx) => {
                  const isDone = idx * 25 <= data.progress;
                  return (
                    <div
                      key={step}
                      className="relative flex gap-4 items-center"
                    >
                      <div
                        className={`
                        relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px]
                        ${
                          isDone
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-slate-900 border-slate-700 text-slate-600"
                        }
                      `}
                      >
                        {isDone && <FontAwesomeIcon icon={faCheckCircle} />}
                      </div>
                      <div
                        className={`text-xs font-bold ${
                          isDone ? "text-slate-200" : "text-slate-600"
                        }`}
                      >
                        {step.replace("_", " ")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex flex-col gap-3">
            <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-900/20 transition-all">
              Send Manual SMS
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
