export default function HeroSection() {
  return (
    <section className="atlas-section-enter atlas-section-1 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="p-6 lg:p-10">
        <div className="flex max-w-4xl flex-col">
          <img
            src="/atlas-logo-white.png"
            alt="Atlas Logo"
            className="atlas-logo-enter mb-6 h-24 w-24 object-contain sm:h-32 sm:w-32"
          />
          <p className="mb-3 text-sm font-extrabold uppercase tracking-widest text-blue-700">
            Manila to Romblon Logistics
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Ship cargo with clear tracking, schedules, and pickup support.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            Atlas helps customers move cargo through coordinated warehouse
            handling, scheduled truck departures, and simple shipment status
            updates.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href="#tracking"
              className="inline-flex justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-slate-800"
            >
              Track Shipment
            </a>
            <a
              href="#pickup"
              className="inline-flex justify-center rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-extrabold text-blue-700 transition hover:bg-blue-100"
            >
              Request Pickup
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoRow label="Business Phone" value="+63 912 545 3219" />
          <InfoRow label="Customer Support" value="support@atlastransport.ph" />
          <InfoRow label="General Email" value="info@atlastransport.ph" />
        </div>
      </div>
    </section>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="atlas-motion-card rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-words text-base font-extrabold text-slate-950">
        {value}
      </p>
    </div>
  );
}
