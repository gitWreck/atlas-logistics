"use client";

import { useState } from "react";

const navItems = [
  { href: "#tracking", label: "Tracking" },
  { href: "#schedule", label: "Schedule" },
  { href: "#warehouses", label: "Warehouses" },
  { href: "#pickup", label: "Book Pickup" },
];

export default function HomeNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="atlas-nav-enter sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <a href="#" className="flex min-w-0 items-center gap-3">
          <img
            src="/atlas-logo-white.png"
            alt="Atlas Transport Corporation"
            className="h-10 w-10 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-slate-950 sm:text-base">
              Atlas Transport Corporation
            </p>
            <p className="text-xs font-semibold text-slate-500">
              Fast & Easy Shipping
            </p>
          </div>
        </a>

        <div className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              {item.label}
            </a>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="inline-flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 md:hidden"
        >
          <span
            className={`h-0.5 w-5 rounded-full bg-current transition ${
              open ? "translate-y-2 rotate-45" : ""
            }`}
          />
          <span
            className={`h-0.5 w-5 rounded-full bg-current transition ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`h-0.5 w-5 rounded-full bg-current transition ${
              open ? "-translate-y-2 -rotate-45" : ""
            }`}
          />
        </button>
      </nav>

      {open ? (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="mx-auto grid max-w-7xl gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
