import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faLocationDot,
  faRoute,
  faShieldAlt,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";

const warehouses = [
  {
    name: "Divisoria Warehouse",
    map: "https://www.google.com/maps?q=14.600025,120.969801&output=embed",
    address: "Unit 615, 619 Asuncion St, San Nicolas, Manila, 1000",
    hours: "Mon-Sat, 8:00 AM-6:00 PM",
    services: ["Cargo intake", "Sorting", "Route consolidation"],
    contact: "Lean",
    phone: "09757427941",
  },
  {
    name: "Odiongan Warehouse",
    map: "https://www.google.com/maps?q=12.4106667,121.9907778&output=embed",
    address: "Poctoy, Odiongan, Romblon, 5505",
    hours: "Mon-Sat, 8:00 AM-5:00 PM",
    services: ["Receiving", "Local dispatch", "Customer release"],
    contact: "Rose",
    phone: "09125453219",
  },
];

export default function WarehousesSection() {
  return (
    <section
      id="warehouses"
      className="atlas-section-enter atlas-section-4 scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:p-8"
    >
      <div className="mb-7 grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-700">
            Warehouse Coverage
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            Connected hubs for cleaner handoffs.
          </h2>
        </div>
        <p className="text-base leading-8 text-slate-600">
          Atlas uses coordinated hub coverage to keep cargo visible, organized,
          and ready for scheduled dispatch or customer release.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-5">
          {warehouses.map((warehouse, index) => (
            <WarehouseCard
              key={warehouse.name}
              warehouse={warehouse}
              index={index}
            />
          ))}
        </div>

        <div className="atlas-motion-card overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-950 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="relative min-h-[460px] p-5 sm:p-6 lg:min-h-full">
            <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:38px_38px]" />
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">
                Hub Network
              </p>
              <h3 className="mt-2 text-2xl font-black">
                Manila to Romblon corridor
              </h3>
            </div>

            <div className="relative mt-9 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="absolute left-[16%] right-[16%] top-[3.25rem] h-1 rounded-full bg-gradient-to-r from-blue-300 via-cyan-200 to-emerald-300" />
              <div className="relative grid grid-cols-3 gap-3">
                <MapHub label="Manila" detail="Intake hub" />
                <MapHub label="Sea Lane" detail="Transit" muted />
                <MapHub label="Romblon" detail="Release hub" />
              </div>
            </div>

            <div className="relative mt-4 rounded-[1.5rem] border border-white/10 bg-slate-900 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Active Routes
              </p>
              <div className="mt-4 grid gap-3">
                <RoutePill from="Manila" to="Romblon" tone="blue" />
                <RoutePill from="Romblon" to="Manila" tone="emerald" />
              </div>
            </div>

            <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
              <NetworkStat label="Hubs" value="2" />
              <NetworkStat label="Routes" value="2 lanes" />
              <NetworkStat label="Care" value="Verified" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WarehouseCard({ warehouse, index }) {
  return (
    <article
      className="atlas-motion-card atlas-stagger overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50"
      style={{ "--atlas-delay": `${index * 90}ms` }}
    >
      <div className="grid md:grid-cols-[0.88fr_1.12fr]">
        <iframe
          title={warehouse.name}
          src={warehouse.map}
          className="h-56 w-full border-0 md:h-full"
          loading="lazy"
        />

        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
                Warehouse
              </p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">
                {warehouse.name}
              </h3>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
              <FontAwesomeIcon icon={faWarehouse} />
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            <Info icon={faLocationDot} label="Address" value={warehouse.address} />
            <Info icon={faClock} label="Hours" value={warehouse.hours} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {warehouse.services.map((service) => (
              <span
                key={service}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600"
              >
                {service}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function Info({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex gap-3">
        <FontAwesomeIcon icon={icon} className="mt-1 text-blue-600" />
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            {label}
          </p>
          <p className="mt-1 break-words text-sm font-black leading-6 text-slate-950">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function MapHub({ label, detail, muted = false }) {
  return (
    <div className="relative z-10 grid min-w-0 justify-items-center gap-3 text-center">
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-xl sm:h-16 sm:w-16 sm:rounded-3xl ${
          muted
            ? "border-white/20 bg-slate-900 text-slate-300"
            : "border-blue-200 bg-white text-blue-700"
        }`}
      >
        <FontAwesomeIcon icon={muted ? faShieldAlt : faWarehouse} />
      </span>
      <div className="min-w-0">
        <p className="mx-auto w-fit rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-white sm:px-3 sm:text-xs">
          {label}
        </p>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">
          {detail}
        </p>
      </div>
    </div>
  );
}

function RoutePill({ from, to, tone }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
      : "border-blue-300/30 bg-blue-400/10 text-blue-100";

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${toneClass}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-950">
          <FontAwesomeIcon icon={faRoute} className="text-xs" />
        </span>
        <p className="truncate text-sm font-black">
          {from} <span className="text-white/50">-&gt;</span> {to}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest">
        Active
      </span>
    </div>
  );
}

function NetworkStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}
