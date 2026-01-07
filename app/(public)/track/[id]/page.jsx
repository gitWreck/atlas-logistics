import { getMockShipment } from "@/lib/mock-data";
import { notFound } from "next/navigation";

export default async function TrackingResultPage({ params }) {
  const { id } = await params;
  const data = await getMockShipment(id);

  if (!data) return notFound();

  // Logic: Is it delayed?
  const isDelayed = data.delayReason && !data.delayCleared;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center py-10">
      {/* 1. BRAND HEADER */}
      <div className="w-full max-w-xl mb-8 flex items-center justify-center">
        <h2 className="text-2xl font-bold text-brand-blue tracking-tight">
          ATLAS <span className="text-brand-navy">LOGISTICS</span>
        </h2>
      </div>

      {/* 2. MAIN CARD */}
      <div className="w-full max-w-xl bg-card rounded-2xl shadow-xl border border-muted/20 p-8 animate-fadeIn">
        {/* Tracking Number & Status */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-muted text-xs font-bold uppercase tracking-widest">
              Tracking Number
            </p>
            <h1 className="text-4xl font-black text-brand-navy mt-1">
              {data.id}
            </h1>
          </div>

          {/* Status Badge using your Brand Colors */}
          <div
            className={`px-4 py-2 rounded-lg text-sm font-bold border shadow-sm
            ${
              isDelayed
                ? "bg-brand-yellow/20 text-yellow-700 border-brand-yellow"
                : "bg-brand-lime/20 text-lime-800 border-brand-lime"
            }`}
          >
            {isDelayed ? `⚠ ${data.delayReason}` : data.status}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-3 w-full bg-muted/20 rounded-full overflow-hidden mb-8">
          <div
            className={`h-full transition-all duration-1000 ease-out ${
              isDelayed ? "bg-brand-yellow" : "bg-brand-blue"
            }`}
            style={{ width: data.status === "DELIVERED" ? "100%" : "65%" }}
          />
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-6 pt-6 border-t border-muted/20">
          <div>
            <p className="text-xs text-muted uppercase font-semibold">Origin</p>
            <p className="text-lg font-medium text-foreground">{data.origin}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted uppercase font-semibold">
              Destination
            </p>
            <p className="text-lg font-medium text-foreground">
              {data.destination}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
