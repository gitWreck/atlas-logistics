export default function Home() {
  return (
    <main className="relative min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-5 sm:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-cyan-200/40 blur-xl"
      />
      <div className="relative mx-auto grid max-w-5xl gap-5">
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.08)] sm:p-10">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
            Atlas Transport Corporation
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
            Reliable logistics that keep business moving
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-700 sm:text-lg">
            Reliable land transportation and logistics services serving Romblon
            and key delivery routes from Manila.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              className="inline-flex items-center justify-center rounded-md border border-blue-700 bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
              href="tel:+639125453219"
            >
              Call Us
            </a>
            <a
              className="inline-flex items-center justify-center rounded-md border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-800 transition hover:bg-blue-50"
              href="mailto:info@atlastransport.ph"
            >
              Email Us
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 shadow-[0_10px_25px_rgba(15,23,42,0.04)] sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">
            Business Information
          </h2>
          <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <p className="m-0 grid gap-1">
              <strong className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Legal Business Name
              </strong>
              <span className="text-base leading-7 text-slate-900">
                Atlas Transport Corporation
              </span>
            </p>
            <p className="m-0 grid gap-1">
              <strong className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Registered Office
              </strong>
              <span className="text-base leading-7 text-slate-900">
                Poctoy, Odiongan, Romblon, Philippines
              </span>
            </p>
            <p className="m-0 grid gap-1">
              <strong className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Business Phone
              </strong>
              <span className="text-base leading-7 text-slate-900">
                +63 912 545 3219
              </span>
            </p>
            <p className="m-0 grid gap-1">
              <strong className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Email
              </strong>
              <span className="text-base leading-7 text-slate-900">
                info@atlastransport.ph
              </span>
            </p>
            <p className="m-0 grid gap-1">
              <strong className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Customer Support
              </strong>
              <span className="text-base leading-7 text-slate-900">
                support@atlastransport.ph
              </span>
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_25px_rgba(15,23,42,0.04)] sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">
            About Us
          </h2>
          <p className="mt-3 max-w-4xl text-base leading-8 text-slate-700 sm:text-[17px]">
            Atlas Transport Corporation is a Philippine logistics and land
            transportation company focused on dependable cargo handling,
            shipment movement, and delivery coordination. Our operations support
            customers requiring organized transport solutions between Manila and
            Romblon.
          </p>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-[0_10px_25px_rgba(15,23,42,0.04)] sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">
            Services
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-base leading-8 text-slate-800">
            <li>Land transportation services</li>
            <li>Logistics coordination</li>
            <li>Cargo movement and routing</li>
            <li>Shipment support and delivery assistance</li>
          </ul>
        </section>

        <footer className="px-1 pt-1 text-sm text-slate-500">
          © 2026 Atlas Transport Corporation. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
