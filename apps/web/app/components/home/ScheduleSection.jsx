const schedulePairs = [
  { departure: "Tuesday", arrival: "Thursday" },
  { departure: "Wednesday", arrival: "Friday" },
  { departure: "Thursday", arrival: "Saturday" },
  { departure: "Saturday", arrival: "Monday" },
];

export default function ScheduleSection() {
  return (
    <section
      id="schedule"
      className="atlas-section-enter atlas-section-3 rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:p-7 lg:p-8"
    >
      <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-widest text-blue-700">
            Truck Schedule
          </p>
          <h2 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">
            Divisoria schedule
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Plan warehouse drop-offs around the current Divisoria to Tablas
            movement schedule.
          </p>
        </div>

        <div className="rounded-xl border border-blue-100 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Schedule Contacts
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Contact name="Lean" phone="09757427941" />
            <Contact name="Rose" phone="09125453219" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-slate-200 pb-3 text-xs font-black uppercase tracking-widest text-slate-500">
          <span>Departure Divisoria</span>
          <span className="h-px w-8 bg-blue-200" />
          <span className="text-right">Arrival Tablas</span>
        </div>

        <div className="mt-4 grid gap-3">
          {schedulePairs.map((schedule) => (
            <ScheduleRow key={schedule.departure} schedule={schedule} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact({ name, phone }) {
  return (
    <div>
      <p className="font-extrabold text-slate-950">{name}</p>
      <p className="text-sm font-semibold text-slate-600">{phone}</p>
    </div>
  );
}

function ScheduleRow({ schedule }) {
  return (
    <div className="atlas-motion-card grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
          Depart
        </p>
        <p className="mt-1 text-lg font-black text-slate-950">
          {schedule.departure}
        </p>
      </div>

      <div className="flex items-center gap-2 text-blue-700">
        <span className="h-2 w-2 rounded-full bg-blue-700" />
        <span className="h-px w-8 bg-blue-300 sm:w-16" />
        <span className="h-2 w-2 rounded-full bg-blue-700" />
      </div>

      <div className="text-right">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
          Arrive
        </p>
        <p className="mt-1 text-lg font-black text-slate-950">
          {schedule.arrival}
        </p>
      </div>
    </div>
  );
}
