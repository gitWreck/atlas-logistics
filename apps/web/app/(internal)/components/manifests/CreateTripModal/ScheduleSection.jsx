import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays } from "@fortawesome/free-solid-svg-icons";

export default function ScheduleSection({ formData, setFormData, isDark = false }) {
  return (
    <div
      className={`p-3 rounded-lg border grid grid-cols-2 gap-4 ${
        isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"
      }`}
    >
      <div>
        <label
          className={`text-[10px] font-bold uppercase flex items-center gap-2 mb-2 ${
            isDark ? "text-slate-400" : "text-slate-600"
          }`}
        >
          <FontAwesomeIcon icon={faCalendarDays} /> Departure
        </label>
        <input
          type="datetime-local"
          required
          className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 ${
            isDark
              ? "bg-slate-900 border-slate-700 text-white [color-scheme:dark]"
              : "bg-white border-slate-300 text-slate-900 [color-scheme:light]"
          }`}
          value={formData.scheduledDeparture}
          onChange={(e) =>
            setFormData((p) => ({ ...p, scheduledDeparture: e.target.value }))
          }
        />
      </div>
      <div>
        <label
          className={`text-[10px] font-bold uppercase flex items-center gap-2 mb-2 ${
            isDark ? "text-slate-400" : "text-slate-600"
          }`}
        >
          <FontAwesomeIcon icon={faCalendarDays} /> Est. Arrival
        </label>
        <input
          type="datetime-local"
          required
          className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-emerald-500 ${
            isDark
              ? "bg-slate-900 border-slate-700 text-white [color-scheme:dark]"
              : "bg-white border-slate-300 text-slate-900 [color-scheme:light]"
          }`}
          value={formData.estimatedArrival}
          min={formData.scheduledDeparture}
          onChange={(e) =>
            setFormData((p) => ({ ...p, estimatedArrival: e.target.value }))
          }
        />
      </div>
    </div>
  );
}
