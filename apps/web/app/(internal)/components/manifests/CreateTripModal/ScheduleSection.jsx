import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays } from "@fortawesome/free-solid-svg-icons";

export default function ScheduleSection({ formData, setFormData }) {
  return (
    <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 grid grid-cols-2 gap-4">
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 mb-2">
          <FontAwesomeIcon icon={faCalendarDays} /> Departure
        </label>
        <input
          type="datetime-local"
          required
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white outline-none focus:border-blue-500 [color-scheme:dark]"
          value={formData.scheduledDeparture}
          onChange={(e) =>
            setFormData((p) => ({ ...p, scheduledDeparture: e.target.value }))
          }
        />
      </div>
      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 mb-2">
          <FontAwesomeIcon icon={faCalendarDays} /> Est. Arrival
        </label>
        <input
          type="datetime-local"
          required
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white outline-none focus:border-emerald-500 [color-scheme:dark]"
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
