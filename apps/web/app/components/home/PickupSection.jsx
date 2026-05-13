import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBoxOpen,
  faClipboardCheck,
  faExclamationTriangle,
  faLocationDot,
  faTruckPickup,
} from "@fortawesome/free-solid-svg-icons";

const pickupSteps = [
  {
    title: "Book a pickup",
    detail: "Share your preferred collection window and shipment route.",
    icon: faClipboardCheck,
  },
  {
    title: "Prepare your shipment",
    detail: "Pack, label, and keep items ready for driver verification.",
    icon: faBoxOpen,
  },
  {
    title: "Driver collects the package",
    detail: "Atlas coordinates pickup and moves the cargo into the hub flow.",
    icon: faTruckPickup,
  },
];

const pickupWindows = ["Morning", "Afternoon", "Next available"];
const checklist = ["Pickup address", "Package count", "Special handling notes"];

export default function PickupSection() {
  return (
    <section
      id="pickup"
      className="atlas-section-enter atlas-section-2 scroll-mt-24 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"
    >
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative bg-slate-950 p-5 text-white sm:p-7 lg:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(59,130,246,0.22),transparent_30%),linear-gradient(135deg,rgba(15,23,42,1),rgba(30,41,59,1))]" />
          <div className="relative">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-200">
              Pickup Request
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              Schedule pickup in three clear steps.
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-300">
              Request collection, prepare your cargo, and let Atlas coordinate
              the movement into the right warehouse and route schedule.
            </p>

            <div className="mt-7 grid gap-4">
              {pickupSteps.map((step, index) => (
                <PickupStep key={step.title} step={step} index={index} />
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7 lg:p-8">
          <div className="atlas-motion-card rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
                    Pickup Planner
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    Maintenance
                  </span>
                </div>
                <h3 className="mt-2 text-2xl font-black text-slate-950">
                  Pickup requests are temporarily paused.
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                  The planner is being updated. Customers can still contact
                  Atlas support for manual pickup coordination.
                </p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 shadow-sm">
                <FontAwesomeIcon icon={faExclamationTriangle} />
              </span>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-800">
                Under maintenance
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-700">
                Online pickup booking is unavailable while we improve the
                request flow. Please use support for urgent pickup needs.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <InfoPanel
                icon={faLocationDot}
                label="Preferred lanes"
                value="Metro Manila pickup to Romblon release"
              />
              <InfoPanel
                icon={faTruckPickup}
                label="Collection status"
                value="Coordinated by dispatch support"
              />
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Pickup windows
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {pickupWindows.map((window) => (
                  <span
                    key={window}
                    className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700"
                  >
                    {window}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {checklist.map((item, index) => (
                <ChecklistItem key={item} item={item} index={index} />
              ))}
            </div>

            <button
              type="button"
              disabled
              className="mt-6 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-slate-300 px-6 py-4 text-sm font-black text-slate-500 sm:w-auto"
            >
              Request Pickup Unavailable
              <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function PickupStep({ step, index }) {
  return (
    <div
      className="atlas-stagger flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
      style={{ "--atlas-delay": `${index * 80}ms` }}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-950">
        <FontAwesomeIcon icon={step.icon} />
      </span>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-blue-200">
          Step {index + 1}
        </p>
        <h3 className="mt-1 font-black text-white">{step.title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-300">{step.detail}</p>
      </div>
    </div>
  );
}

function InfoPanel({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <FontAwesomeIcon icon={icon} className="text-blue-700" />
      <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black leading-6 text-slate-950">{value}</p>
    </div>
  );
}

function ChecklistItem({ item, index }) {
  return (
    <div
      className="atlas-stagger flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      style={{ "--atlas-delay": `${index * 70}ms` }}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-xs text-emerald-700">
        <FontAwesomeIcon icon={faClipboardCheck} />
      </span>
      <span className="text-sm font-black text-slate-950">{item}</span>
    </div>
  );
}
