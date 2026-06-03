import DriverSelectInput from "./DriverSelectInput";
import TruckSelectInput from "./TruckSelectInput";

export default function VehicleDetails({
  formData,
  setFormData,
  isDark = false,
  required = false,
}) {
  return (
    <div
      className={`space-y-4 pt-2 border-t ${
        isDark ? "border-slate-800" : "border-slate-200"
      }`}
    >
      <DriverSelectInput
        value={formData.driverName}
        onChange={(text) =>
          setFormData((prev) => ({ ...prev, driverName: text }))
        }
        onSelectId={(id) => setFormData((prev) => ({ ...prev, driverId: id }))}
        isDark={isDark}
        required={required}
      />

      <TruckSelectInput
        value={formData.truckPlateNumber}
        onChange={(val) =>
          setFormData((prev) => ({ ...prev, truckPlateNumber: val }))
        }
        onSelectId={(id) => setFormData((prev) => ({ ...prev, truckId: id }))}
        isDark={isDark}
        required={required}
      />

      <div className="space-y-1">
        <label
          className={`text-xs font-bold uppercase ${
            isDark ? "text-slate-400" : "text-slate-600"
          }`}
        >
          Truck Helper
        </label>
        <input
          className={`w-full border rounded-lg p-2 outline-none ${
            isDark
              ? "bg-slate-950 border-slate-700 text-white"
              : "bg-white border-slate-300 text-slate-900"
          }`}
          placeholder="Optional Name"
          value={formData.helperName}
          onChange={(e) =>
            setFormData({ ...formData, helperName: e.target.value })
          }
        />
      </div>

      {/* <div className="space-y-1">
        <label className="text-xs font-bold text-slate-400 uppercase">
          Truck Plate #
        </label>
        <input
          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white outline-none uppercase"
          placeholder="e.g. ABC-1234"
          value={formData.truckPlateNumber}
          onChange={(e) =>
            setFormData({ ...formData, truckPlateNumber: e.target.value })
          }
        />
      </div> */}
    </div>
  );
}
