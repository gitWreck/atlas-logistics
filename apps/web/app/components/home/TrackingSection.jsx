"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function TrackingSection() {
  const router = useRouter();
  const [trackingNumber, setTrackingNumber] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    const value = trackingNumber.trim();
    if (!value) return;

    router.push(`/track/${encodeURIComponent(value)}`);
  };

  return (
    <section
      id="tracking"
      className="atlas-section-enter atlas-section-2 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 lg:p-8"
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-widest text-blue-700">
            Shipment Tracking
          </p>
          <h2 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">
            Check shipment status
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Enter the tracking number from your invoice or receipt. Press Enter
            or click Track to open the shipment status page.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-3 sm:grid-cols-[1fr_auto]"
        >
          <input
            type="text"
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
            placeholder="Enter your tracking number"
            className="h-14 w-full rounded-xl border border-slate-300 bg-white px-4 font-mono text-base font-bold uppercase text-slate-950 outline-none transition placeholder:font-sans placeholder:font-semibold placeholder:normal-case placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            autoComplete="off"
          />
          <button
            type="submit"
            className="h-14 rounded-xl bg-slate-950 px-6 text-sm font-extrabold text-white transition hover:bg-slate-800"
          >
            Track
          </button>
        </form>
      </div>
    </section>
  );
}
