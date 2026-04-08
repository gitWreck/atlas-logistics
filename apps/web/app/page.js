export default function AtlasLandingPage() {
  const schedule = [
    { departure: 'Tuesday', arrival: 'Thursday' },
    { departure: 'Wednesday', arrival: 'Friday' },
    { departure: 'Thursday', arrival: 'Saturday' },
    { departure: 'Saturday', arrival: 'Monday' },
  ];

  const services = [
    'Land transportation services',
    'Logistics coordination',
    'Cargo movement and routing',
    'Shipment support and delivery assistance',
  ];

  const highlights = [
    'Fast & Easy Shipping',
    'Manila to Romblon cargo movement',
    'Organized warehouse coordination',
    'Reliable business and customer support',
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-[290px] flex-col justify-between border-r border-slate-200 bg-white px-6 py-8">
          <div>
            <div className="flex items-center gap-4">
              <img
                src="/atlas-logo.png"
                alt="Atlas Logo"
                className="h-14 w-14 rounded-full object-contain"
              />
              <div>
                <p className="text-sm font-semibold tracking-[0.30em] text-slate-700">ATLAS</p>
                <h2 className="text-2xl font-bold leading-tight text-slate-900">
                  Fast & Easy Shipping
                </h2>
              </div>
            </div>

            <div className="mt-12 space-y-3">
              <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-5 py-4 text-white shadow-lg">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">Main</p>
                <p className="mt-1 text-xl font-bold">Landing Page</p>
              </div>

              {highlights.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-medium text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Contact
            </p>
            <p className="mt-3 text-lg font-bold text-slate-900">+63 912 545 3219</p>
            <p className="mt-2 text-sm text-slate-600">support@atlastransport.ph</p>
            <p className="text-sm text-slate-600">info@atlastransport.ph</p>
          </div>
        </aside>

        <main className="flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex items-center justify-between px-6 py-5 lg:px-10">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.20em] text-slate-500">
                  Atlas Transport Corporation
                </p>
                <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950 lg:text-4xl">
                  Reliable logistics that keep business moving
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-600 lg:text-base">
                  Dependable cargo handling, warehouse coordination, and shipment movement
                  across our service routes.
                </p>
              </div>

              <div className="hidden md:flex items-center gap-3">
                <a
                  href="tel:+639125453219"
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700"
                >
                  Call Us
                </a>
                <a
                  href="mailto:info@atlastransport.ph"
                  className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Email Us
                </a>
              </div>
            </div>
          </header>

          <div className="p-6 lg:p-10">
            <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm lg:p-10">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
                  Atlas Transport Corporation
                </p>
                <h2 className="mt-3 text-4xl font-black leading-tight text-slate-950 lg:text-6xl">
                  Fast & Easy Shipping
                </h2>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 lg:text-lg">
                  Atlas Transport Corporation is a Philippine logistics and land transportation company focused on dependable cargo handling, shipment movement, and delivery coordination across our service routes.
                </p>

                <div className="mt-8 max-w-3xl rounded-[24px] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Track Your Shipment
                  </p>
                  <div className="mt-3 flex flex-col gap-3 md:flex-row">
                    <input
                      type="text"
                      placeholder="Enter Tracking Number (e.g. AT-240601-DIVTAB)"
                      className="h-12 flex-1 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500"
                    />
                    <button className="h-12 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white shadow hover:bg-slate-800">
                      Track Shipment
                    </button>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-4">
                  <a
                    href="tel:+639125453219"
                    className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700"
                  >
                    Call Now
                  </a>
                  <a
                    href="#book-now"
                    className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Book Now
                  </a>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-900 via-blue-950 to-blue-700 p-7 text-white shadow-sm lg:p-10">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">
                  Company Overview
                </p>
                <div className="mt-5 flex items-center gap-4">
                  <img
                    src="/atlas-logo.png"
                    alt="Atlas Logo"
                    className="h-20 w-20 rounded-full bg-white/10 object-contain p-1"
                  />
                  <div>
                    <h3 className="text-2xl font-bold">Atlas Transport Corporation</h3>
                    <p className="text-sm text-blue-100">Fast & Easy Shipping</p>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.20em] text-blue-100">Business Phone</p>
                    <p className="mt-2 text-lg font-bold">+63 912 545 3219</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-xs uppercase tracking-[0.20em] text-blue-100">Customer Support</p>
                    <p className="mt-2 text-sm font-semibold break-all">support@atlastransport.ph</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4 sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.20em] text-blue-100">Email</p>
                    <p className="mt-2 text-sm font-semibold break-all">info@atlastransport.ph</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-3">
              <div className="rounded-[28px] border border-blue-100 bg-blue-50 p-7 shadow-sm lg:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-700">
                      Truck Schedule
                    </p>
                    <h3 className="mt-2 text-3xl font-black text-slate-950">Divisoria Schedule</h3>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Bookings & Updates</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">Lean / Rose</p>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-white p-6 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Departure Divisoria
                    </p>
                    <ul className="mt-4 space-y-3 text-lg font-semibold text-slate-900">
                      {schedule.map((row) => (
                        <li key={row.departure}>• {row.departure}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl bg-white p-6 shadow-sm">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Arrival in Tablas
                    </p>
                    <ul className="mt-4 space-y-3 text-lg font-semibold text-slate-900">
                      {schedule.map((row) => (
                        <li key={row.arrival}>• {row.arrival}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Services
                </p>
                <h3 className="mt-2 text-3xl font-black text-slate-950">What We Do</h3>
                <ul className="mt-6 space-y-4">
                  {services.map((service) => (
                    <li key={service} className="rounded-2xl bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700">
                      {service}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm lg:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Warehouse Information
                </p>
                <h3 className="mt-2 text-3xl font-black text-slate-950">Divisoria Warehouse</h3>
                <div className="mt-6 space-y-4 text-slate-700">
                  <div className="rounded-2xl bg-slate-50 p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Address</p>
                    <p className="mt-2 text-base font-medium">
                      619 Asuncion St, Binondo, Manila, Metro Manila, Philippines
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Contact Person</p>
                      <p className="mt-2 text-base font-semibold">Lean Mangaoil</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Phone Number</p>
                      <p className="mt-2 text-base font-semibold">09757427941</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm lg:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Warehouse Information
                </p>
                <h3 className="mt-2 text-3xl font-black text-slate-950">Odiongan Warehouse</h3>
                <div className="mt-6 space-y-4 text-slate-700">
                  <div className="rounded-2xl bg-slate-50 p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Address</p>
                    <p className="mt-2 text-base font-medium">
                      Poctoy, Poctoy, Odiongan, Romblon, 5505
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Contact Person</p>
                      <p className="mt-2 text-base font-semibold">Roselyn Merculesio Hindap</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Phone Number</p>
                      <p className="mt-2 text-base font-semibold">09125453219</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm lg:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                About Us
              </p>
              <h3 className="mt-2 text-3xl font-black text-slate-950">Built for reliable cargo coordination</h3>
              <p className="mt-5 max-w-5xl text-base leading-8 text-slate-600 lg:text-lg">
                Atlas Transport Corporation is a Philippine logistics and land transportation company focused on dependable cargo handling, shipment movement, and delivery coordination across our service routes.
              </p>
            </section>

            <section id="book-now" className="mt-6 rounded-[28px] border border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-700 p-7 text-white shadow-sm lg:p-8">
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-100">
                    Book Now
                  </p>
                  <h3 className="mt-2 text-3xl font-black lg:text-4xl">
                    Ready to ship with Atlas?
                  </h3>
                  <p className="mt-4 max-w-2xl text-base leading-8 text-blue-50 lg:text-lg">
                    Contact our team for bookings, shipment coordination, and warehouse updates.
                    Our Divisoria and Odiongan contacts are ready to assist with delivery planning.
                  </p>
                </div>

                <div className="rounded-[24px] bg-white p-5 text-slate-900 shadow-lg">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Booking Contacts
                  </p>
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-500">Divisoria Warehouse</p>
                      <p className="mt-1 text-lg font-bold">Lean Mangaoil</p>
                      <p className="text-sm text-slate-700">09757427941</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-500">Odiongan Warehouse</p>
                      <p className="mt-1 text-lg font-bold">Roselyn Merculesio Hindap</p>
                      <p className="text-sm text-slate-700">09125453219</p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <a
                      href="tel:+639125453219"
                      className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700"
                    >
                      Call Business Line
                    </a>
                    <a
                      href="mailto:support@atlastransport.ph"
                      className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Email Support
                    </a>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
