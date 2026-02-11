import DriverSelectInput from "../DriverSelectInput";
import TruckSelectInput from "../TruckSelectInput";

export default function VehicleDetails({ formData, setFormData }) {
  return (
    <div className="space-y-4 pt-2 border-t border-slate-800">
      <DriverSelectInput
        value={formData.driverName}
        onChange={(text) =>
          setFormData((prev) => ({ ...prev, driverName: text }))
        }
        onSelectId={(id) => setFormData((prev) => ({ ...prev, driverId: id }))}
      />

      <TruckSelectInput
        value={formData.truckPlateNumber}
        onChange={(val) =>
          setFormData((prev) => ({ ...prev, truckPlateNumber: val }))
        }
        onSelectId={(id) => setFormData((prev) => ({ ...prev, truckId: id }))}
      />

      <div className="space-y-1">
        <label className="text-xs font-bold text-slate-400 uppercase">
          Truck Helper
        </label>
        <input
          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white outline-none"
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
