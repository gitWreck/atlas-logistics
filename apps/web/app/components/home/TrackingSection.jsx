"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBox,
  faBoxOpen,
  faCamera,
  faCheckCircle,
  faClock,
  faExpand,
  faMagnifyingGlass,
  faReceipt,
  faTruckFast,
  faTruckRampBox,
} from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";

const previewShipment = {
  id: "ATL-240812-SHP",
  status: "In Transit",
  updatedAt: "Updated May 13, 8:30 PM",
  originCode: "DIV",
  destinationCode: "ODI",
  origin: "Divisoria",
  destination: "Odiongan",
  totals: {
    totalItems: 15,
    loaded: 8,
  },
};

const milestones = [
  {
    val: 0,
    label: "Received",
    icon: faBoxOpen,
    color: "text-cyan-600",
    border: "border-cyan-500",
    bg: "bg-cyan-500",
  },
  {
    val: 33,
    label: "In Transit",
    icon: faTruckFast,
    color: "text-blue-600",
    border: "border-blue-500",
    bg: "bg-blue-500",
  },
  {
    val: 66,
    label: "Out for Delivery",
    icon: faTruckRampBox,
    color: "text-purple-600",
    border: "border-purple-500",
    bg: "bg-purple-500",
  },
  {
    val: 100,
    label: "Delivered",
    icon: faCheckCircle,
    color: "text-emerald-600",
    border: "border-emerald-500",
    bg: "bg-emerald-500",
  },
];

const currentProgress = 33;

export default function TrackingSection() {
  const router = useRouter();
  const [trackingNumber, setTrackingNumber] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    const value = trackingNumber.trim();
    if (!value) return;

    router.push(`/track/${encodeURIComponent(value)}`);
  };

  return (
    <section
      id="tracking"
      className="atlas-section-enter atlas-section-2 scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:p-8"
    >
      <div className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-700">
            Shipment Tracking
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            A tracking desk that feels instant.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
            Enter the tracking number from your invoice or receipt and open a
            shipment status page built around clear milestones.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <MiniStat label="Search response" value="< 1 sec" />
            <MiniStat label="Visible milestones" value="4 stages" />
          </div>
        </div>

        <div className="atlas-motion-card rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-5">
          <div className="overflow-hidden rounded-[1.35rem] border border-white bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-5 text-center">
              <img
                src="/atlas-logo1.png"
                alt=""
                className="mx-auto h-14 w-14 rounded-xl object-cover"
              />
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-slate-950">
                  Atlas Tracking
                </p>
                <p className="mt-1 font-mono text-xs font-semibold text-slate-500">
                  Sample: {previewShipment.id}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5">
              <div className="relative">
                <label className="sr-only" htmlFor="home-tracking-number">
                  Tracking number
                </label>
                <input
                  id="home-tracking-number"
                  type="text"
                  value={trackingNumber}
                  onChange={(event) => setTrackingNumber(event.target.value)}
                  placeholder="Enter Tracking Number"
                  className="h-14 w-full rounded-2xl border border-slate-300 bg-white pl-4 pr-14 text-center font-mono text-base font-black uppercase text-slate-950 outline-none transition placeholder:font-sans placeholder:font-semibold placeholder:normal-case placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="atlas-button-rise absolute bottom-2 right-2 top-2 inline-flex aspect-square items-center justify-center rounded-xl bg-blue-600 text-white transition hover:-translate-y-0.5 hover:bg-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  aria-label="Track shipment"
                >
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                </button>
              </div>
            </form>

            <div className="grid gap-4 border-y border-slate-200 bg-slate-50 px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase text-slate-500">
                  Current Status
                </p>
                <StatusBadge status={previewShipment.status} />
                <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <FontAwesomeIcon icon={faClock} className="text-slate-400" />
                  {previewShipment.updatedAt}
                </p>
              </div>

              <div className="border-t border-slate-200 pt-4 sm:border-0 sm:pt-0 sm:text-right">
                <p className="mb-1 text-[10px] font-bold uppercase text-slate-500">
                  Route
                </p>
                <p className="flex items-center gap-2 font-mono text-xl font-bold text-slate-950 sm:justify-end">
                  <span>{previewShipment.originCode}</span>
                  <span className="text-slate-400">-&gt;</span>
                  <span>{previewShipment.destinationCode}</span>
                </p>
                <p className="mt-0.5 max-w-56 text-xs font-mono text-slate-500">
                  {previewShipment.origin} -&gt; {previewShipment.destination}
                </p>
              </div>
            </div>

            <div className="bg-white px-5 py-9 sm:px-8">
              <div className="relative mx-auto max-w-xl">
                <div className="absolute left-0 top-5 h-1 w-full rounded-full bg-slate-200" />
                <div
                  className="absolute left-0 top-5 h-1 rounded-full bg-blue-600 transition-all duration-1000"
                  style={{ width: `${currentProgress}%` }}
                />

                <div className="relative z-10 flex justify-between">
                  {milestones.map((step, index) => (
                    <Milestone
                      key={step.label}
                      step={step}
                      index={index}
                      progress={currentProgress}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200 bg-white">
              <ProofRow
                title="Proof of Receipt"
                count="2"
                icon={faBox}
                active
              />
              <div className="mx-5 h-px bg-slate-200" />
              <ProofRow
                title="Proof of Delivery"
                count="Pending"
                icon={faCamera}
              />
            </div>

            <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 bg-slate-50">
              <StatBox
                label="Total Items"
                value={previewShipment.totals.totalItems}
              />
              <StatBox
                label="Loaded"
                value={previewShipment.totals.loaded}
                color="text-blue-700"
              />
              <StatBox
                label="Pending"
                value={
                  previewShipment.totals.totalItems -
                  previewShipment.totals.loaded
                }
                color="text-slate-600"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusBadge({ status }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-blue-700">
      <FontAwesomeIcon icon={faTruckFast} className="text-xs" />
      <span>{status}</span>
    </span>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function Milestone({ step, index, progress }) {
  const isPast = step.val < progress;
  const isActive = step.val === progress;

  let dotStyle = "border-slate-300 bg-white text-slate-400";

  if (isActive) {
    dotStyle = `${step.border} bg-white ${step.color} shadow-[0_0_0_4px_rgba(59,130,246,0.10)]`;
  } else if (isPast) {
    dotStyle = "border-blue-600 bg-white text-blue-600";
  }

  return (
    <div
      className="atlas-stagger relative flex w-10 shrink-0 flex-col items-center"
      style={{ "--atlas-delay": `${index * 75}ms` }}
    >
      <div className="relative flex h-10 w-10 items-center justify-center">
        {isActive ? (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-30 ${step.bg}`}
          />
        ) : null}
        <div
          className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500 ${dotStyle}`}
        >
          <FontAwesomeIcon icon={step.icon} className="text-sm" />
        </div>
      </div>
      <p
        className={`absolute top-12 w-24 text-center text-[10px] font-bold uppercase tracking-wider ${
          isActive
            ? "text-slate-950"
            : isPast
              ? "text-blue-700"
              : "text-slate-500"
        }`}
      >
        {step.label}
      </p>
    </div>
  );
}

function ProofRow({ title, count, icon, active = false }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            active ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          <FontAwesomeIcon icon={icon} className="text-xs" />
        </span>
        <p className="truncate text-xs font-bold uppercase text-slate-600">
          {title} <span className="text-slate-400">({count})</span>
        </p>
      </div>

      {active ? (
        <div className="flex shrink-0 gap-2">
          {[1, 2].map((item) => (
            <span
              key={item}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-400"
            >
              <FontAwesomeIcon
                icon={item === 1 ? faReceipt : faExpand}
                className="text-xs"
              />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatBox({ label, value, color = "text-slate-950" }) {
  return (
    <div className="p-4 text-center transition hover:bg-white">
      <p className="mb-1 text-[9px] font-bold uppercase text-slate-500">
        {label}
      </p>
      <p className={`font-mono text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
