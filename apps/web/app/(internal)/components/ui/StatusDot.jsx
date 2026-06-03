export default function StatusDot({
  status,
  isDelayed = false,
  animateActive = true,
}) {
  const normalizedStatus = String(status || "").toUpperCase();
  let color = "bg-blue-500";
  let animate = false;

  if (["COMPLETED", "DELIVERED"].includes(normalizedStatus)) {
    color = "bg-emerald-500";
  }

  if (normalizedStatus === "CREATED") color = "bg-slate-600";

  if (normalizedStatus === "IN_TRANSIT") {
    color = "bg-blue-500";
    animate = true;
  }

  if (isDelayed) {
    color = "bg-amber-500";
    animate = true;
  } else if (
    animateActive &&
    normalizedStatus &&
    !["CREATED", "COMPLETED", "DELIVERED"].includes(normalizedStatus)
  ) {
    animate = true;
  }

  return (
    <div className="relative flex items-center justify-center w-3 h-3 flex-shrink-0">
      {animate && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`}
        />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </div>
  );
}
