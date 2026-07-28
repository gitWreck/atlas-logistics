"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPrint,
  faCheckCircle,
  faClipboardList,
  faUser,
  faLocationDot,
  faRoute,
  faLock,
  faLink,
  faFileLines,
  faShieldHalved,
  faShield,
  faCube,
  faBoxesStacked,
  faClipboardCheck,
  faWarehouse,
  faCircleInfo,
  faTriangleExclamation,
  faIdBadge,
  faScaleBalanced,
  faMagnifyingGlass,
  faTruckRampBox,
  faGlobe,
  faTruck,
  faBoxOpen,
} from "@fortawesome/free-solid-svg-icons";
import { auth } from "@/lib/firebase";
import { fetchPrintApi } from "@/lib/printFetch";
import { onAuthStateChanged } from "firebase/auth";
import QRCode from "react-qr-code";
import Image from "next/image";

const MANIFEST_NAVY = "#0B2A5B";

const PrintSheet = ({ children }) => (
  <div
    className="
    bg-white text-slate-900
    w-[215.9mm] min-h-[279.4mm]
    mx-auto my-8
    p-[12mm]
    shadow-2xl border border-gray-300
    print:shadow-none print:w-full print:h-full print:m-0 print:p-0 print:border-none print:rounded-none
    overflow-hidden relative
    flex flex-col
  "
  >
    {children}
  </div>
);

function formatManifestDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatRouteDisplay(route) {
  const raw = String(route || "").trim();
  if (!raw) return "—";
  return raw.replace(/\s*->\s*/g, " → ");
}

function deriveSealId(tripNumber) {
  const normalized = String(tripNumber || "").trim();
  if (!normalized) return "—";
  if (normalized.startsWith("TRIP-HUB-")) {
    return normalized.replace("TRIP-HUB-", "ATL-DL-");
  }
  if (normalized.startsWith("TRIP-")) {
    return normalized.replace("TRIP-", "ATL-DL-");
  }
  return `ATL-DL-${normalized}`;
}

function formatDestinationDisplay(group) {
  const name = String(group?.destination || "—").trim();
  const route = String(group?.routeCode || "").trim();
  const parts = route.split(/\s*(?:->|→)\s*/);
  const code = parts[1]?.trim() || "";
  if (code && !name.includes(`(${code})`)) {
    return `${name} (${code})`;
  }
  return name;
}

const ManifestPanelHeader = ({ children }) => (
  <div
    className="text-white text-center text-[10px] font-bold uppercase tracking-[0.12em] py-2"
    style={{ backgroundColor: MANIFEST_NAVY }}
  >
    {children}
  </div>
);

const SummaryCell = ({ icon, label, value }) => (
  <div className="border border-slate-200 p-2.5 min-h-[62px] bg-white">
    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
      <FontAwesomeIcon icon={icon} className="text-[10px] w-3.5" />
      <span>{label}</span>
    </div>
    <div
      className="text-[11px] font-bold leading-snug break-words"
      style={{ color: MANIFEST_NAVY }}
    >
      {value || "—"}
    </div>
  </div>
);

const StatusRow = ({ label, value, valueClass = "", icon, iconClass = "" }) => (
  <div className="flex items-center justify-between gap-2 border-b border-slate-200 last:border-b-0 px-3 py-2 min-h-[38px]">
    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
      {label}
    </span>
    <div className="flex items-center gap-1.5 shrink-0">
      <span
        className={`text-[10px] font-bold uppercase tracking-tight ${valueClass}`}
        style={!valueClass ? { color: MANIFEST_NAVY } : undefined}
      >
        {value}
      </span>
      {icon && (
        <FontAwesomeIcon icon={icon} className={`text-[12px] ${iconClass}`} />
      )}
    </div>
  </div>
);

const OverviewCell = ({ icon, label, value }) => (
  <div className="flex items-center gap-4 px-5 py-4 border-r border-slate-200 last:border-r-0 bg-white">
    <FontAwesomeIcon
      icon={icon}
      className="text-[28px] shrink-0"
      style={{ color: MANIFEST_NAVY }}
    />
    <div className="min-w-0">
      <div
        className="text-[9px] font-bold uppercase tracking-wide mb-1"
        style={{ color: MANIFEST_NAVY }}
      >
        {label}
      </div>
      <div
        className="text-[26px] font-black leading-none"
        style={{ color: MANIFEST_NAVY }}
      >
        {value ?? "—"}
      </div>
    </div>
  </div>
);

const DestinationSummaryCell = ({
  icon,
  label,
  value,
  valueClass = "",
  trailing,
}) => (
  <div className="flex items-center gap-3 px-3 py-3 border-r border-slate-200 last:border-r-0 bg-white min-w-0">
    <FontAwesomeIcon
      icon={icon}
      className="text-[22px] shrink-0"
      style={{ color: MANIFEST_NAVY }}
    />
    <div className="min-w-0 flex-1">
      <div className="text-[8px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div
        className={`text-[11px] font-bold leading-tight truncate ${valueClass}`}
        style={!valueClass ? { color: MANIFEST_NAVY } : undefined}
      >
        {value}
      </div>
    </div>
    {trailing}
  </div>
);

const DeliveryDestinationCard = ({ group, isCompleted = false }) => {
  const items = group.items || [];
  const shipmentCount = items.length;
  const packageTotal = items.reduce(
    (acc, it) => acc + (Number(it.packageCount) || 0),
    0,
  );
  const destinationDisplay = formatDestinationDisplay(group);

  return (
    <div className="border border-slate-300 rounded-sm overflow-hidden break-inside-avoid">
      <div className="grid grid-cols-4 border-b border-slate-200">
        <DestinationSummaryCell
          icon={faLocationDot}
          label="Destination"
          value={destinationDisplay}
        />
        <DestinationSummaryCell
          icon={faCube}
          label="Total Shipments"
          value={shipmentCount}
        />
        <DestinationSummaryCell
          icon={faBoxesStacked}
          label="Total Packages"
          value={packageTotal}
        />
        <DestinationSummaryCell
          icon={faClipboardCheck}
          label="Manifest Status"
          value={isCompleted ? "COMPLETED & VERIFIED" : "IN PROGRESS"}
          valueClass={isCompleted ? "text-emerald-600" : "text-amber-600"}
          trailing={
            isCompleted ? (
              <FontAwesomeIcon
                icon={faCheckCircle}
                className="text-emerald-600 text-[14px] shrink-0"
              />
            ) : null
          }
        />
      </div>

      <table className="w-full text-left">
        <thead style={{ backgroundColor: MANIFEST_NAVY }}>
          <tr>
            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-wide text-white w-[38%]">
              Tracking Number
            </th>
            <th className="px-4 py-2 text-[9px] font-bold uppercase tracking-wide text-white">
              Packages (Breakdown)
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {items.map((item, i) => (
            <tr key={`${item.shipmentId}-${i}`}>
              <td className="px-4 py-2.5 align-top border-r border-slate-200">
                <div
                  className="text-[10px] font-bold leading-snug"
                  style={{ color: MANIFEST_NAVY }}
                >
                  {item.shipmentId}
                </div>
                {item.receiverName && (
                  <span className="block text-[8px] text-slate-400 font-semibold mt-0.5">
                    Receiver: {item.receiverName}
                  </span>
                )}
                {(item.failedCount > 0 || item.returnedCount > 0) && (
                  <span className="block text-[8px] text-slate-400 font-semibold mt-0.5">
                    {item.deliveredCount > 0
                      ? `${item.deliveredCount} delivered`
                      : ""}
                    {item.failedCount > 0
                      ? ` · ${item.failedCount} failed`
                      : ""}
                    {item.returnedCount > 0
                      ? ` · ${item.returnedCount} returned`
                      : ""}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 align-top">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    {item.descriptionBreakdown?.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {item.descriptionBreakdown.map((line, idx) => (
                          <div
                            key={idx}
                            className="text-[10px] leading-snug"
                            style={{ color: MANIFEST_NAVY }}
                          >
                            {line.desc}: {line.count}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className="text-[10px] leading-snug"
                        style={{ color: MANIFEST_NAVY }}
                      >
                        {item.packageCount || 0} package
                        {item.packageCount === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                  <div
                    className="text-[10px] font-bold shrink-0 whitespace-nowrap"
                    style={{ color: MANIFEST_NAVY }}
                  >
                    Total: {item.packageCount || 0}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const LegalCard = ({
  borderClass = "border-slate-300",
  titleClass = "text-[#0B2A5B]",
  icon,
  iconWrapClass = "bg-[#0B2A5B] text-white",
  title,
  children,
}) => (
  <div
    className={`border ${borderClass} rounded-md bg-white p-3.5 flex flex-col gap-2.5 h-full break-inside-avoid`}
  >
    <div className="flex items-center gap-2">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${iconWrapClass}`}
      >
        <FontAwesomeIcon icon={icon} className="text-[11px]" />
      </div>
      <h4
        className={`text-[10px] font-black uppercase tracking-wide leading-tight ${titleClass}`}
      >
        {title}
      </h4>
    </div>
    <div
      className="text-[8.5px] leading-[1.45] flex-1 flex flex-col"
      style={{ color: MANIFEST_NAVY }}
    >
      {children}
    </div>
  </div>
);

const LegalCheckItem = ({ children, tone = "red" }) => {
  const toneClass =
    tone === "green" ? "bg-emerald-700 text-white" : "bg-red-600 text-white";
  return (
    <li className="flex items-start gap-2">
      <span
        className={`mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${toneClass}`}
      >
        <FontAwesomeIcon icon={faCheckCircle} className="text-[8px]" />
      </span>
      <span>{children}</span>
    </li>
  );
};

const AccessConditionItem = ({ icon, children }) => (
  <li className="flex items-start gap-2">
    <FontAwesomeIcon
      icon={icon}
      className="text-[11px] mt-0.5 shrink-0"
      style={{ color: MANIFEST_NAVY }}
    />
    <span>{children}</span>
  </li>
);

const CustodyAckColumn = ({ icon, titleLines }) => (
  <div className="px-4 py-4 border-r border-slate-200 last:border-r-0 bg-white min-h-[110px] flex flex-col">
    <div className="flex items-center gap-2 mb-4">
      <FontAwesomeIcon
        icon={icon}
        className="text-[16px] shrink-0"
        style={{ color: MANIFEST_NAVY }}
      />
      <div
        className="text-[10px] font-black uppercase leading-tight"
        style={{ color: MANIFEST_NAVY }}
      >
        {titleLines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
    <div className="border-b border-slate-400 mt-auto mb-3 h-6" />
    <div className="flex items-end gap-2">
      <span
        className="text-[9px] font-bold uppercase shrink-0"
        style={{ color: MANIFEST_NAVY }}
      >
        Date:
      </span>
      <div className="flex-1 border-b border-slate-400 h-4" />
    </div>
  </div>
);

function DeliveryManifestContent() {
  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId");
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [printedAt, setPrintedAt] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => setAuthReady(true));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !tripId) return;

    fetchPrintApi(`/api/trips/${tripId}/print-delivery-manifest`)
      .then((data) => {
        setManifest(data);
        setPrintedAt(new Date().toISOString());
      })
      .catch((err) => setError(err.message));
  }, [authReady, tripId]);

  if (!tripId) return <p className="p-8 text-center">Missing tripId</p>;
  if (error) return <p className="p-8 text-center text-red-600">{error}</p>;
  if (!manifest) return <p className="p-8 text-center animate-pulse">Loading...</p>;

  const totals = manifest.totals || {};
  const destinations = manifest.destinations || [];
  const isCompleted =
    String(manifest.status || "")
      .toUpperCase()
      .includes("COMPLETED") ||
    (manifest.stamps || []).includes("COMPLETED");
  const completedDisplay = formatManifestDateTime(manifest.sealedAt);
  const printedDisplay = formatManifestDateTime(printedAt);
  const routeDisplay = formatRouteDisplay(manifest.route);
  const sealId = deriveSealId(manifest.tripNumber);
  const hashDisplay = String(manifest.manifestHash || "—");
  const verifyBase = "https://atlastransport.ph/verify/";

  return (
    <PrintSheet>
      {/* HEADER */}
      <div className="grid grid-cols-[104px_minmax(0,1fr)_148px] gap-6 items-start mb-7">
        <div className="flex flex-col items-center text-center">
          <div className="w-[78px] h-[78px] relative">
            <Image
              src="/atlas-logo.png"
              alt="Atlas Transport Corporation"
              width={78}
              height={78}
              className="object-contain"
            />
          </div>
          <div className="mt-2 text-[#0B2A5B] font-black text-[14px] tracking-[0.12em] leading-none uppercase">
            Atlas
          </div>
          <div className="mt-1 text-[#0B2A5B] text-[7px] font-bold tracking-[0.22em] uppercase leading-[1.35]">
            Transport
            <br />
            Corporation
          </div>
        </div>

        <div className="min-w-0 pr-1">
          <h1 className="text-[#0B2A5B] font-black text-[18px] leading-none uppercase tracking-[0.01em]">
            Atlas Verified &amp; Sealed
          </h1>
          <h2 className="text-[#0B2A5B] font-black text-[14px] leading-none uppercase tracking-[0.01em] mt-2">
            Delivery Manifest &amp; Completion Record
          </h2>
          <p className="text-[#4A6FA5] text-[10px] mt-3 leading-[1.45]">
            Operational Delivery Manifest • Chain-of-Custody Completion Record •
            Digitally Verified Delivery Document
          </p>
          <p className="text-[#0B2A5B] text-[10px] mt-3 leading-[1.55] max-w-[440px]">
            This Delivery Manifest is an official completion record within the{" "}
            <strong>Atlas Logistics Platform</strong>. It is digitally generated,
            system verified, and locked upon delivery completion. It serves as
            the primary operational delivery record for this trip and supports
            verification, cargo integrity review, operational auditing, and
            delivery traceability throughout active logistics operations.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2.5">
          <div className="text-right leading-tight">
            <div className="text-[6.5px] font-bold uppercase tracking-[0.14em] text-[#4A6FA5]">
              Date &amp; Time Generated
            </div>
            <div className="text-[10px] font-bold text-[#0B2A5B] mt-1">
              {completedDisplay}
            </div>
          </div>

          <div className="border border-[#0B2A5B] rounded-sm overflow-hidden bg-white">
            <div className="bg-[#0B2A5B] text-white text-center text-[7.5px] font-bold uppercase tracking-[0.16em] py-1.5">
              Scan to Verify
            </div>
            <div className="px-2.5 pt-2 pb-2.5 flex flex-col items-center">
              <p className="text-[6.5px] text-[#5B6B7C] text-center leading-[1.35] mb-2 px-0.5">
                Scan to verify this delivery manifest and view verification
                details.
              </p>
              <div className="w-[100px] h-[100px] bg-white flex items-center justify-center">
                <QRCode
                  value={manifest.verifyUrl}
                  size={100}
                  level="M"
                  style={{
                    height: "auto",
                    maxWidth: "100%",
                    width: "100%",
                  }}
                />
              </div>
              <div className="w-full mt-2 text-center">
                <div className="text-[6px] font-bold uppercase tracking-[0.14em] text-[#4A6FA5]">
                  Verification URL
                </div>
                <div className="text-[6.5px] text-[#1D4ED8] break-all leading-tight mt-0.5">
                  {verifyBase}
                </div>
                <div className="text-[8px] font-black text-[#0B2A5B] uppercase tracking-tight mt-1 break-all leading-tight">
                  {manifest.tripNumber || manifest.tripId}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr className="border-t-2 border-slate-900/10 mb-5" />

      {/* SUMMARY + STATUS + HASH */}
      <div className="grid grid-cols-[1.2fr_1fr_0.82fr] gap-3 mb-6 break-inside-avoid">
        <div className="border border-slate-300 rounded-sm overflow-hidden bg-white">
          <ManifestPanelHeader>Delivery Summary</ManifestPanelHeader>
          <div className="grid grid-cols-3">
            <SummaryCell
              icon={faClipboardList}
              label="Trip ID"
              value={manifest.tripNumber || manifest.tripId}
            />
            <SummaryCell
              icon={faUser}
              label="Completed By"
              value={manifest.completedByName || "—"}
            />
            <SummaryCell
              icon={faWarehouse}
              label="Delivery Hub"
              value={manifest.destination}
            />
            <SummaryCell
              icon={faLocationDot}
              label="Origin"
              value={manifest.origin}
            />
            <SummaryCell icon={faRoute} label="Route" value={routeDisplay} />
            <SummaryCell
              icon={faBoxOpen}
              label="Shipping Ref"
              value={manifest.shippingManifestReference || "—"}
            />
            <SummaryCell
              icon={faLock}
              label="Completed At"
              value={completedDisplay}
            />
            <SummaryCell
              icon={faFileLines}
              label="Manifest Version"
              value={manifest.version || "DELIVERY-V1.0"}
            />
            <SummaryCell
              icon={faPrint}
              label="Printed At"
              value={printedDisplay}
            />
          </div>
        </div>

        <div className="border border-slate-300 rounded-sm overflow-hidden bg-white">
          <ManifestPanelHeader>
            Manifest Status &amp; Verification
          </ManifestPanelHeader>
          <div className="bg-white">
            <StatusRow
              label="Manifest Status"
              value={isCompleted ? "COMPLETED & VERIFIED" : "IN PROGRESS"}
              valueClass="text-emerald-600"
              icon={faCheckCircle}
              iconClass="text-emerald-600"
            />
            <StatusRow
              label="Delivery Status"
              value={isCompleted ? "DELIVERY COMPLETE" : "OPEN"}
              valueClass="text-emerald-600"
              icon={faLock}
              iconClass="text-blue-600"
            />
            <StatusRow
              label="Chain-of-Custody"
              value={isCompleted ? "CLOSED" : "ACTIVE"}
              valueClass="text-emerald-600"
              icon={faLink}
              iconClass="text-emerald-600"
            />
            <StatusRow
              label="Audit Status"
              value={isCompleted ? "DIGITALLY LOGGED" : "NOT LOGGED"}
              valueClass="text-violet-600"
              icon={faFileLines}
              iconClass="text-violet-600"
            />
            <StatusRow
              label="Verification Method"
              value={
                isCompleted && manifest.manifestHash
                  ? "QR + HASH VERIFIED"
                  : "UNVERIFIED"
              }
              icon={faShieldHalved}
              iconClass="text-blue-600"
            />
            <StatusRow label="Seal ID" value={sealId} />
          </div>
        </div>

        <div className="border border-slate-300 rounded-sm overflow-hidden bg-white">
          <ManifestPanelHeader>Manifest Hash (SHA-256)</ManifestPanelHeader>
          <div className="p-3 flex flex-col gap-2.5 min-h-[190px]">
            <div className="text-[9px] font-mono text-slate-600 leading-normal break-all bg-slate-50 border border-slate-200 rounded p-2.5">
              {hashDisplay}
            </div>
            <div className="flex items-start gap-2.5 border border-slate-200 rounded p-2.5 bg-white">
              <FontAwesomeIcon
                icon={faShield}
                className="text-[26px] text-blue-600 shrink-0 mt-0.5"
              />
              <p className="text-[9px] text-slate-600 leading-normal">
                This delivery manifest is digitally logged, hash-verified, and
                integrity-checked within the Atlas Logistics Platform.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* DELIVERY OVERVIEW */}
      <div className="border border-slate-300 rounded-sm overflow-hidden mb-6 break-inside-avoid">
        <ManifestPanelHeader>Delivery Overview</ManifestPanelHeader>
        <div className="grid grid-cols-3">
          <OverviewCell
            icon={faBoxesStacked}
            label="Packages Received"
            value={totals.totalPackagesReceived}
          />
          <OverviewCell
            icon={faCheckCircle}
            label="Total Delivered"
            value={totals.totalDelivered}
          />
          <OverviewCell
            icon={faClipboardCheck}
            label="POD Captured"
            value={
              totals.podPercent
                ? `${totals.podCaptured ?? 0} (${totals.podPercent})`
                : totals.podCaptured
            }
          />
        </div>
        <div className="grid grid-cols-3 border-t border-slate-200">
          <OverviewCell
            icon={faTriangleExclamation}
            label="Failed Delivery"
            value={totals.totalFailedDelivery}
          />
          <OverviewCell
            icon={faWarehouse}
            label="Returned to Warehouse"
            value={totals.totalReturnedToWarehouse}
          />
          <OverviewCell
            icon={faLocationDot}
            label="Delivery Hub"
            value={manifest.destination}
          />
        </div>
      </div>

      {/* PACKAGES BY DESTINATION */}
      <div className="mb-8 break-inside-avoid">
        <div className="space-y-4">
          {destinations.length > 0 ? (
            destinations.map((group, idx) => (
              <DeliveryDestinationCard
                key={`${group.destination}-${idx}`}
                group={group}
                isCompleted={isCompleted}
              />
            ))
          ) : (
            <p className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg p-4 text-center">
              No delivered package details recorded for this trip.
            </p>
          )}
        </div>
      </div>

      {/* LEGAL / PROTOCOL CARDS */}
      <div className="break-inside-avoid mb-3">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <LegalCard icon={faLock} title="Verified Delivery Protocol">
            <p className="mb-3 text-[11px]">
              Upon delivery completion and manifest lock, this trip enters
              verified delivery completion status. Delivery outcomes, POD
              capture, returns, and failed attempts are recorded as the final
              operational delivery ledger for this transport operation.
            </p>
            <div
              className="mt-auto text-center text-white text-[9px] font-bold uppercase tracking-wide py-1.5 px-2 rounded"
              style={{ backgroundColor: MANIFEST_NAVY }}
            >
              {routeDisplay || "Designated Atlas Warehouse"} — Atlas Logistics
            </div>
          </LegalCard>

          <LegalCard
            icon={faShieldHalved}
            title="Authorized Completion Conditions"
          >
            <p className="mb-2">
              Delivery completion records may only be finalized under the
              following authorized conditions:
            </p>
            <ul className="space-y-1.5">
              <AccessConditionItem icon={faWarehouse}>
                Arrival and receiving at the designated Atlas delivery hub
              </AccessConditionItem>
              <AccessConditionItem icon={faUser}>
                Delivery operations conducted by authorized Atlas personnel
              </AccessConditionItem>
              <AccessConditionItem icon={faIdBadge}>
                POD capture and delivery verification through Atlas procedures
              </AccessConditionItem>
              <AccessConditionItem icon={faTriangleExclamation}>
                Exception handling for failed delivery or warehouse return
                workflows
              </AccessConditionItem>
            </ul>
          </LegalCard>

          <LegalCard icon={faCircleInfo} title="Important Notice">
            <p>
              Operational delivery handling, POD capture, returns, and
              verification activities must follow authorized Atlas shipment
              verification and receiving procedures.
            </p>
          </LegalCard>
        </div>

        <div className="grid grid-cols-[0.9fr_1.1fr] gap-3 mb-3">
          <LegalCard
            borderClass="border-red-500"
            titleClass="text-red-600"
            icon={faTriangleExclamation}
            iconWrapClass="bg-red-600 text-white"
            title="Unauthorized Activity May Result In"
          >
            <p className="mb-2">
              Any unauthorized alteration of delivery outcomes, POD records, or
              completion data prior to authorized verification procedures may
              trigger{" "}
              <strong>
                shipment integrity review and operational audit procedures.
              </strong>
            </p>
            <ul className="space-y-1.5">
              <LegalCheckItem tone="red">
                Operational investigation and audit escalation
              </LegalCheckItem>
              <LegalCheckItem tone="red">
                Incident reporting and verification logging
              </LegalCheckItem>
              <LegalCheckItem tone="red">
                Shipment integrity review procedures
              </LegalCheckItem>
              <LegalCheckItem tone="red">
                Internal operational and compliance review procedures
              </LegalCheckItem>
            </ul>
          </LegalCard>

          <LegalCard
            borderClass="border-emerald-700"
            titleClass="text-emerald-800"
            icon={faScaleBalanced}
            iconWrapClass="bg-emerald-700 text-white"
            title="Audit & Verification Records"
          >
            <p className="mb-2">
              Atlas maintains digitally logged operational verification and
              delivery audit records associated with this transport operation.
            </p>
            <p className="font-bold mb-1.5">These records support:</p>
            <ul className="space-y-1.5 mb-2">
              <LegalCheckItem tone="green">
                Delivery outcome traceability
              </LegalCheckItem>
              <LegalCheckItem tone="green">POD integrity review</LegalCheckItem>
              <LegalCheckItem tone="green">
                Operational verification
              </LegalCheckItem>
              <LegalCheckItem tone="green">
                Chain-of-custody completion tracking
              </LegalCheckItem>
              <LegalCheckItem tone="green">
                Audit and compliance review procedures
              </LegalCheckItem>
            </ul>
            <p>
              All records may be used for operational, administrative,
              compliance, and legal review purposes where applicable.
            </p>
          </LegalCard>
        </div>

        <div className="border border-slate-300 rounded-md px-3.5 py-3 mb-3 flex items-start gap-3 bg-white">
          <div
            className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
            style={{ borderColor: MANIFEST_NAVY, color: MANIFEST_NAVY }}
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} className="text-[13px]" />
          </div>
          <p
            className="text-[8.5px] leading-[1.5]"
            style={{ color: MANIFEST_NAVY }}
          >
            <strong>AUDIT NOTICE:</strong> This document supports delivery
            verification, warehouse processing, transport reconciliation, and
            operational audit procedures during active logistics operations.
            Verification may be performed through the official QR verification
            system or associated manifest reference number. Delivery outcomes,
            POD capture, inspection, and verification activities should occur
            only through authorized operational or inspection procedures.
          </p>
        </div>

        <div className="border border-slate-300 rounded-sm overflow-hidden">
          <div
            className="text-white text-center text-[10px] font-bold uppercase tracking-[0.12em] py-2"
            style={{ backgroundColor: MANIFEST_NAVY }}
          >
            Operational Custody Acknowledgement
          </div>
          <div className="grid grid-cols-3">
            <CustodyAckColumn icon={faTruck} titleLines={["Driver"]} />
            <CustodyAckColumn
              icon={faWarehouse}
              titleLines={["Dispatching", "Warehouse Manager"]}
            />
            <CustodyAckColumn
              icon={faTruckRampBox}
              titleLines={["Receiving", "Warehouse Manager"]}
            />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-auto pt-4 break-inside-avoid">
        <div className="border border-slate-300 rounded-sm overflow-hidden">
          <div className="px-4 py-3 grid grid-cols-[auto_1fr_auto] gap-5 items-center">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-10 h-10 relative shrink-0">
                <Image
                  src="/atlas-logo.png"
                  alt="Atlas Transport Corporation"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <div
                className="text-[8px] font-black uppercase leading-[1.25] tracking-[0.06em]"
                style={{ color: MANIFEST_NAVY }}
              >
                Atlas
                <br />
                Transport
                <br />
                Corporation
              </div>
            </div>

            <div className="min-w-0" style={{ color: MANIFEST_NAVY }}>
              <div className="text-[11px] font-black uppercase tracking-wide leading-tight">
                Atlas Transport Corporation
              </div>
              <div className="text-[9px] mt-0.5 leading-tight">
                Atlas Logistics Platform
              </div>
              <div className="text-[8.5px] leading-tight">
                Digital Cargo Verification &amp; Chain-of-Custody System
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[8px]">
                <span className="inline-flex items-center gap-1">
                  <FontAwesomeIcon icon={faGlobe} className="text-[9px]" />
                  atlastransport.ph
                </span>
                <span className="inline-flex items-center gap-1">
                  <FontAwesomeIcon
                    icon={faLocationDot}
                    className="text-[9px]"
                  />
                  Odiongan, Romblon, Philippines
                </span>
              </div>
            </div>

            <div
              className="flex items-center gap-2.5 rounded-md px-3 py-2.5 max-w-[210px] shrink-0"
              style={{ backgroundColor: MANIFEST_NAVY }}
            >
              <FontAwesomeIcon
                icon={faShieldHalved}
                className="text-white text-[18px] shrink-0"
              />
              <div className="text-white text-[7.5px] font-bold uppercase leading-[1.35] tracking-wide">
                For Operational Verification, Audit, and Transport Control
                Purposes Only
              </div>
            </div>
          </div>

          <div
            className="text-white text-center text-[7.5px] font-bold uppercase tracking-[0.12em] py-1.5 px-3"
            style={{ backgroundColor: MANIFEST_NAVY }}
          >
            System Generated • Digitally Logged • QR Verified •
            Chain-of-Custody Protected
          </div>
        </div>
      </div>
    </PrintSheet>
  );
}

export default function DeliveryManifestPrintPage() {
  return (
    <div className="min-h-screen bg-slate-100 pb-10 print:bg-white print:pb-0 flex flex-col items-center">
      <style jsx global>{`
        @media print {
          @page {
            size: Letter;
            margin: 12mm;
          }
          body {
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 p-4 print:hidden shadow-lg mb-8 w-full">
        <div className="max-w-5xl mx-auto flex items-center justify-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
          >
            <FontAwesomeIcon icon={faPrint} />
            Print Manifest
          </button>
        </div>
      </div>

      <Suspense fallback={<p className="p-8 text-center">Loading...</p>}>
        <DeliveryManifestContent />
      </Suspense>
    </div>
  );
}
