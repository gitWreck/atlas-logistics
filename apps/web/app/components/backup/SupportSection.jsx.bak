export default function SupportSection() {
  return (
    <section className="atlas-section-enter atlas-section-3 grid gap-5 rounded-2xl bg-slate-950 p-5 text-white sm:p-7 lg:grid-cols-[1.2fr_0.8fr_1fr] lg:p-8">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-widest text-blue-300">
          Atlas Support
        </p>
        <h2 className="mt-2 text-2xl font-black sm:text-3xl">
          Need help with your shipment?
        </h2>
      </div>

      <SupportItem label="Business Phone" value="+63 912 545 3219" />

      <div className="grid gap-4">
        <SupportItem label="Customer Support" value="support@atlastransport.ph" />
        <SupportItem label="General Email" value="info@atlastransport.ph" />
      </div>
    </section>
  );
}

function SupportItem({ label, value }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-blue-300">
        {label}
      </p>
      <p className="mt-2 break-words text-base font-extrabold text-white">
        {value}
      </p>
    </div>
  );
}
