import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDay,
  faClock,
  faLocationArrow,
  faRoute,
  faTruckFast,
} from "@fortawesome/free-solid-svg-icons";

const schedulePairs = [
  {
    origin: "Divisoria Warehouse",
    destination: "Odiongan Hub",
    departure: "Tuesday",
    eta: "Thursday",
    status: "Loading",
    accent: "blue",
  },
  {
    origin: "Divisoria Warehouse",
    destination: "Tablas Route",
    departure: "Wednesday",
    eta: "Friday",
    status: "Scheduled",
    accent: "emerald",
  },
  {
    origin: "Manila Consolidation",
    destination: "Romblon Sorting",
    departure: "Thursday",
    eta: "Saturday",
    status: "Manifest Ready",
    accent: "amber",
  },
  {
    origin: "Divisoria Warehouse",
    destination: "Odiongan Hub",
    departure: "Saturday",
    eta: "Monday",
    status: "Open Capacity",
    accent: "slate",
  },
];

export default function ScheduleSection() {
  return (
    <section
      id="schedule"
      className="atlas-section-enter atlas-section-3 scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:p-8"
    >
      <div className="mb-7 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-700">
            Delivery Schedules
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            Upcoming trips, easy to scan.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            Plan drop-offs around active truck departures, projected arrival
            windows, and route capacity across the Manila to Romblon lane.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
              <FontAwesomeIcon icon={faCalendarDay} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Dispatch Desk
              </p>
              <p className="font-black text-slate-950">4 weekly departures</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {schedulePairs.map((schedule, index) => (
          <ScheduleCard
            key={`${schedule.departure}-${schedule.eta}`}
            schedule={schedule}
            index={index}
          />
        ))}
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Contact name="Lean" role="Manila schedule" phone="09757427941" />
          <Contact name="Rose" role="Romblon receiving" phone="09125453219" />
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Route status
            </p>
            <p className="mt-2 text-base font-black text-slate-950">
              Normal operations
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Contact({ name, role, phone }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {role}
      </p>
      <p className="mt-2 font-extrabold text-slate-950">{name}</p>
      <p className="text-sm font-semibold text-slate-600">{phone}</p>
    </div>
  );
}

function ScheduleCard({ schedule, index }) {
  const accentClasses = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <article
      className="atlas-motion-card atlas-stagger rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4"
      style={{ "--atlas-delay": `${index * 75}ms` }}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`rounded-full border px-3 py-1 text-xs font-black ${accentClasses[schedule.accent]}`}
        >
          {schedule.status}
        </span>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
          <FontAwesomeIcon icon={faTruckFast} />
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <RouteLine icon={faLocationArrow} label="Origin" value={schedule.origin} />
        <RouteLine icon={faRoute} label="Destination" value={schedule.destination} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4">
        <DateBlock label="Depart" value={schedule.departure} />
        <DateBlock label="ETA" value={schedule.eta} />
      </div>
    </article>
  );
}

function RouteLine({ icon, label, value }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs text-blue-700 shadow-sm">
        <FontAwesomeIcon icon={icon} />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-sm font-black leading-5 text-slate-950">
          {value}
        </p>
      </div>
    </div>
  );
}

function DateBlock({ label, value }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">
        <FontAwesomeIcon icon={faClock} />
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}
