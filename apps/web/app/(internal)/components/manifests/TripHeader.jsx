import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPen,
  faBan,
  faFilePdf,
  faLock,
  faScroll,
  faUnlock,
} from "@fortawesome/free-solid-svg-icons";
import { ActionButton } from "../ui/ActionButton";
import StatusBadge from "../ui/StatusBadge";
import { generateTripManifest } from "@/app/utility/FirebaseFunctions";
import { runAction } from "@/app/utility/utilities";
import StatusButton from "../ui/StatusButton";

export default function TripHeader({
  trip,
  onDriverClick,
  onDisableClick,
  onAction,
}) {
  const [lockStatus, setLockStatus] = useState("IDLE");

  const isLocked = trip?.manifestLocked;
  const isCertified = !!trip?.certificate;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex flex-wrap justify-between items-center mb-4">
        {/* INFO SECTION */}
        <div>
          <h2 className="text-xl font-mono font-bold text-white">
            {trip?.tripId}
          </h2>
          <div className="flex gap-3 text-xs text-slate-400 mt-1 items-center">
            {/* DRIVER */}
            <div className="flex items-center gap-2 bg-slate-800/50 pl-2 pr-1 py-1 rounded">
              <span>
                Driver:{" "}
                {trip?.driverName ? (
                  <b className="text-white">{trip?.driverName}</b>
                ) : (
                  <StatusBadge status={"UNASSIGNED"} />
                )}
              </span>
              <button
                onClick={onDriverClick}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <FontAwesomeIcon icon={faPen} size="xs" />
              </button>
            </div>

            <span>•</span>

            {/* STATUS */}
            <div className="flex items-center gap-2 bg-slate-800/50 pl-2 pr-1 py-1 rounded">
              <span>
                Status:{" "}
                <b className="text-slate-200">
                  <StatusBadge status={trip?.status} />
                </b>
              </span>
              <button
                onClick={onDisableClick}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                disabled={
                  trip?.active !== false &&
                  trip?.status !== "CANCELLED" &&
                  trip?.status !== "COMPLETED"
                    ? false
                    : true
                }
              >
                <FontAwesomeIcon icon={faBan} size="xs" />
              </button>
            </div>
          </div>
        </div>

        {/* PDF LINKS */}
        <div className="flex gap-2">
          {trip?.manifest?.pdfUrl && (
            <a
              href={trip.manifest.pdfUrl}
              target="_blank"
              className="text-xs text-blue-400 hover:underline flex items-center gap-1"
            >
              <FontAwesomeIcon icon={faFilePdf} /> Manifest
            </a>
          )}
          {trip?.certificate?.pdfUrl && (
            <a
              href={trip.certificate.pdfUrl}
              target="_blank"
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              <FontAwesomeIcon icon={faFilePdf} /> Certificate
            </a>
          )}
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex gap-3 pt-4 border-t border-slate-800">
        {/* 2. Use the Universal runAction here */}
        <StatusButton
          status={lockStatus}
          label="Lock Manifest"
          icon={faLock}
          idleColor="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30"
          disabled={isLocked}
          onClick={() =>
            runAction(
              setLockStatus, // Pass the LOCK state setter
              () =>
                generateTripManifest({
                  tripDocId: trip?.tripId, // Ensure correct ID field
                }),
              () => onRefresh && onRefresh(), // Refresh parent on success
            )
          }
        />
        <ActionButton
          label="Certificate"
          icon={faScroll}
          color="emerald"
          disabled={!isLocked || isCertified}
          onClick={() => onAction("generateTripCertificate")}
        />
        <ActionButton
          label="Reopen"
          icon={faUnlock}
          color="red"
          disabled={!isCertified}
          onClick={() => onAction("reopenTrip")}
        />
      </div>
    </div>
  );
}
