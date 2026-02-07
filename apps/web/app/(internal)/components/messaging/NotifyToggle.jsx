// A reusable checkbox for "Silent" vs "Notify" toggles
export default function NotifyToggle({
  checked,
  onChange,
  color = "emerald", // options: "emerald", "amber"
  labelOff = "Silent Update",
}) {
  // Define color styles based on the 'color' prop
  const styles = {
    emerald: {
      input: "text-blue-600 focus:ring-blue-500", // Blue check
      text: "text-emerald-500", // Green text
    },
    amber: {
      input: "text-amber-600 focus:ring-amber-500", // Amber check
      text: "text-amber-500", // Amber text
    },
  };

  const activeStyle = styles[color] || styles.emerald;

  return (
    <label className="flex items-center gap-2 cursor-pointer group select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`w-3 h-3 rounded border-slate-600 bg-slate-900 focus:ring-offset-slate-900 ${activeStyle.input}`}
      />
      <span
        className={`text-[10px] font-bold uppercase transition-colors ${
          checked ? activeStyle.text : "text-slate-600"
        }`}
      >
        {checked ? "Notify Customers" : labelOff}
      </span>
    </label>
  );
}
