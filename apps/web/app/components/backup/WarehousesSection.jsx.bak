const warehouses = [
  {
    name: "Divisoria Warehouse",
    map: "https://www.google.com/maps?q=14.600025,120.969801&output=embed",
    address: "Unit 615, 619 Asuncion St, San Nicolas, Manila, 1000",
    contact: "Lean",
    phone: "09757427941",
  },
  {
    name: "Odiongan Warehouse",
    map: "https://www.google.com/maps?q=12.4106667,121.9907778&output=embed",
    address: "Poctoy, Odiongan, Romblon, 5505",
    contact: "Rose",
    phone: "09125453219",
  },
];

export default function WarehousesSection() {
  return (
    <section
      id="warehouses"
      className="atlas-section-enter atlas-section-4 grid gap-5 lg:grid-cols-2"
    >
      {warehouses.map((warehouse) => (
        <WarehouseCard key={warehouse.name} warehouse={warehouse} />
      ))}
    </section>
  );
}

function WarehouseCard({ warehouse }) {
  return (
    <article className="atlas-motion-card rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <p className="text-sm font-extrabold uppercase tracking-widest text-blue-700">
        Warehouse
      </p>
      <h2 className="mt-2 text-3xl font-black text-slate-950">
        {warehouse.name}
      </h2>

      <iframe
        title={warehouse.name}
        src={warehouse.map}
        className="mt-5 h-56 w-full rounded-xl border-0"
        loading="lazy"
      />

      <div className="mt-5 grid gap-3">
        <Info label="Address" value={warehouse.address} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Contact Person" value={warehouse.contact} />
          <Info label="Phone Number" value={warehouse.phone} />
        </div>
      </div>
    </article>
  );
}

function Info({ label, value }) {
  return (
    <div className="atlas-motion-card rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-words text-base font-extrabold leading-7 text-slate-950">
        {value}
      </p>
    </div>
  );
}
