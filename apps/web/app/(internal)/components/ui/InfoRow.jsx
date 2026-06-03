export default function InfoRow({ label, value }) {
  return (
    <div className="flex gap-3 py-1">
      <div className="w-36 shrink-0 font-semibold text-slate-600">{label}</div>
      <div className="text-slate-900">{value || "-"}</div>
    </div>
  );
}
