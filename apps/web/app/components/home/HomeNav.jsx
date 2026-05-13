"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faCalendarDay,
  faMagnifyingGlass,
  faTruckPickup,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";

const navItems = [
  { href: "#tracking", label: "Tracking", icon: faMagnifyingGlass },
  { href: "#schedule", label: "Schedule", icon: faCalendarDay },
  { href: "#warehouses", label: "Warehouses", icon: faWarehouse },
  { href: "#pickup", label: "Pickup", icon: faTruckPickup },
];

export default function HomeNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="atlas-nav-enter sticky top-0 z-40 px-3 py-3 sm:px-4">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-[1.35rem] border border-white/70 bg-white/90 px-3 py-3 shadow-[0_16px_50px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:px-4 lg:px-5">
        <a
          href="#"
          className="group flex min-w-0 items-center gap-3 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-100"
          aria-label="Atlas Transport home"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm transition group-hover:-translate-y-0.5">
            <img
              src="/atlas-logo-white.png"
              alt=""
              className="h-10 w-10 object-contain"
            />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-black text-slate-950 sm:text-base">
                Atlas Transport
              </p>
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 sm:inline-flex">
                Active
              </span>
            </div>
            <p className="truncate text-xs font-semibold text-slate-500">
              Premium logistics platform
            </p>
          </div>
        </a>

        <div className="hidden items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50/80 p-1 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-slate-950 hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <FontAwesomeIcon icon={item.icon} className="text-xs text-blue-600" />
              {item.label}
            </a>
          ))}
        </div>

        <a
          href="#tracking"
          className="atlas-button-rise hidden items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300 lg:inline-flex"
        >
          Track Shipment
          <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
        </a>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="home-mobile-menu"
          className="inline-flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100 md:hidden"
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
        <div id="home-mobile-menu" className="mx-auto mt-2 max-w-7xl md:hidden">
          <div className="grid gap-1 rounded-[1.35rem] border border-white/70 bg-white/90 p-2 shadow-[0_16px_50px_rgba(15,23,42,0.10)] backdrop-blur-xl">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <FontAwesomeIcon icon={item.icon} className="text-xs" />
                </span>
                {item.label}
              </a>
            ))}
            <a
              href="#tracking"
              onClick={() => setOpen(false)}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white focus:outline-none focus:ring-4 focus:ring-slate-300"
            >
              Track Shipment
              <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
