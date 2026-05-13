import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBoxOpen,
  faClock,
  faLocationDot,
  faRoute,
  faShieldAlt,
  faTruckFast,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";

const trustItems = [
  {
    label: "Fast Delivery",
    detail: "Scheduled lane departures",
    icon: faTruckFast,
  },
  {
    label: "Real-time Tracking",
    detail: "Milestone updates from hub to door",
    icon: faRoute,
  },
  {
    label: "Secure Handling",
    detail: "Warehouse-verified cargo movement",
    icon: faShieldAlt,
  },
];

const timeline = [
  { label: "Received", place: "Divisoria Hub", active: true },
  { label: "In Transit", place: "Southbound Route", active: true },
  { label: "Arriving", place: "Tablas Hub", active: false },
];

export default function HeroSection() {
  return (
    <section className="atlas-section-enter atlas-section-1 relative overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,0.12),transparent_32%),radial-gradient(circle_at_84%_10%,rgba(14,165,233,0.14),transparent_28%),linear-gradient(135deg,rgba(248,250,252,0.98),rgba(241,245,249,0.78))]" />
      <div className="atlas-hero-glow absolute right-6 top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative grid gap-10 px-5 py-8 sm:px-7 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-10 lg:py-12 xl:px-12">
        <div>
          {/* <div className="atlas-logo-enter mb-7 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white/80 px-3 py-2 shadow-sm backdrop-blur">
            <img
              src="/atlas-logo-white.png"
              alt="Atlas Transport Corporation"
              className="h-10 w-10 object-contain"
            />
            <span className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
              Premium Cargo Logistics
            </span>
          </div> */}

          <h1 className="max-w-4xl text-4xl font-black leading-[1.02] text-slate-950 sm:text-5xl lg:text-6xl">
            Move shipments with confidence from pickup to delivery.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            Atlas Transport coordinates cargo, warehouse handoffs, delivery
            schedules, and shipment visibility in one polished logistics
            experience.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#tracking"
              className="atlas-button-rise inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300"
            >
              Track Shipment
              <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </a>
            <a
              href="#pickup"
              className="atlas-button-rise inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white/80 px-6 py-4 text-sm font-black text-slate-950 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              Schedule Pickup
              <FontAwesomeIcon
                icon={faClock}
                className="text-xs text-blue-600"
              />
            </a>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            {trustItems.map((item, index) => (
              <TrustItem key={item.label} item={item} index={index} />
            ))}
          </div>
        </div>

        <div className="relative min-h-[520px] lg:min-h-[610px]">
          <div className="atlas-float absolute left-0 top-2 w-full max-w-md rounded-[1.75rem] border border-white/80 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.16)] backdrop-blur sm:left-6 lg:left-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Live shipment
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  AT-20260513-SHP
                </h2>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                On time
              </span>
            </div>

            <div className="mt-6 grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <IconBubble icon={faWarehouse} />
              <div>
                <p className="text-sm font-black text-slate-950">
                  Divisoria Hub
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  Cargo verified and sealed
                </p>
              </div>
              <FontAwesomeIcon icon={faArrowRight} className="text-slate-400" />
            </div>

            <div className="mt-5 space-y-4">
              {timeline.map((item) => (
                <TimelineItem key={item.label} item={item} />
              ))}
            </div>
          </div>

          <div className="atlas-float-slow absolute bottom-0 right-0 w-[94%] rounded-[2rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_28px_80px_rgba(15,23,42,0.28)] sm:w-[82%] lg:w-[78%]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">
                  Route Control
                </p>
                <p className="mt-2 text-xl font-black">Manila to Romblon</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-blue-200">
                <FontAwesomeIcon icon={faTruckFast} />
              </div>
            </div>

            <div className="relative mt-7 rounded-3xl border border-white/10 bg-white/5 px-4 pb-5 pt-4">
              <div className="absolute left-[25%] right-[25%] top-10 h-px bg-gradient-to-r from-blue-300 via-cyan-200 to-emerald-300" />
              <div className="relative grid grid-cols-3 gap-2">
                <MapPoint label="MNL" icon={faLocationDot} active />
                <MapPoint label="HUB" icon={faBoxOpen} active />
                <MapPoint label="RMB" icon={faWarehouse} />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Metric label="ETA" value="Thu, 28 May 2026" />
              <Metric label="Status" value="In Transit" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function IconBubble({ icon }) {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
      <FontAwesomeIcon icon={icon} />
    </span>
  );
}

function TrustItem({ item, index }) {
  return (
    <div
      className="atlas-motion-card atlas-stagger rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur"
      style={{ "--atlas-delay": `${index * 80}ms` }}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        <FontAwesomeIcon icon={item.icon} />
      </div>
      <p className="text-sm font-black text-slate-950">{item.label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</p>
    </div>
  );
}

function TimelineItem({ item }) {
  return (
    <div className="flex gap-3">
      <span
        className={`mt-1 h-3 w-3 rounded-full ${
          item.active
            ? "bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.16)]"
            : "bg-slate-300"
        }`}
      />
      <div>
        <p className="text-sm font-black text-slate-950">{item.label}</p>
        <p className="text-xs font-semibold text-slate-500">{item.place}</p>
      </div>
    </div>
  );
}

function MapPoint({ label, icon, active = false }) {
  return (
    <div className="relative z-10 grid min-w-0 justify-items-center gap-2 text-center">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-2xl border shadow-lg ${
          active
            ? "border-blue-200 bg-blue-400 text-slate-950"
            : "border-white/15 bg-white/10 text-white"
        }`}
      >
        <FontAwesomeIcon icon={icon} />
      </span>
      <span className="text-xs font-black tracking-widest text-slate-300">
        {label}
      </span>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black leading-5 text-white">
        {value}
      </p>
    </div>
  );
}
