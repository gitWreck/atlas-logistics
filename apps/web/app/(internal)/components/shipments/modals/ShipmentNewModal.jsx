import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faTruckFast,
  faExclamationTriangle,
  faCircleNotch,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";

const ShipmentNewModal = ({ isOpen, onClose, onSave }) => {
  const [step, setStep] = useState("FORM"); // FORM | CONFIRM | LOADING | SUCCESS
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    origin: "",
    destination: "",
    totalItems: 1,
    remarks: "",
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (!formData.origin || !formData.destination || formData.totalItems <= 0) {
      setError("Please fill in all required fields correctly.");
      return;
    }
    setError("");
    setStep("CONFIRM");
  };

  const handleSubmit = async () => {
    setStep("LOADING");
    setLoading(true);
    try {
      await onSave({
        customerName: formData.customerName,
        customerPhoneNumber: formData.customerPhoneNumber,
        origin: formData.origin,
        destination: formData.destination,
        totalItems: Number(formData.totalItems),
        remarks: formData.remarks,
      });
      setStep("SUCCESS");
    } catch (err) {
      console.error("Failed to create shipment:", err);
      setError("Failed to create shipment. Try again.");
      setStep("FORM");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep("FORM");
    setError("");
    setFormData({
      origin: "",
      destination: "",
      totalItems: 1,
      remarks: "",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />
      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <h3 className="text-white font-bold flex items-center gap-2">
            <FontAwesomeIcon icon={faTruckFast} className="text-red-500" />
            New Shipment
          </h3>
          <button
            onClick={handleClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Step 1: Form */}
        {step === "FORM" && (
          <form onSubmit={handleNext} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Customer Name
              </label>
              <input
                name="customerName"
                type="text"
                placeholder="Customer Name"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-red-500 focus:outline-none"
                value={formData.customerName}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Customer Phone Number
              </label>
              <input
                name="customerPhoneNumber"
                type="number"
                placeholder="Customer Phone Number"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-red-500 focus:outline-none"
                value={formData.customerPhoneNumber}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Origin
              </label>
              <input
                name="origin"
                type="text"
                placeholder="City / Location"
                className="uppercase w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-red-500 focus:outline-none"
                value={formData.origin}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Destination
              </label>
              <input
                name="destination"
                type="text"
                placeholder="City / Location"
                className="uppercase w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-red-500 focus:outline-none"
                value={formData.destination}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Total Items
              </label>
              <input
                name="totalItems"
                type="number"
                min={1}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-red-500 focus:outline-none"
                value={formData.totalItems}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Remarks (Optional)
              </label>
              <textarea
                name="remarks"
                rows={3}
                placeholder="Any notes or instructions..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:border-red-500 focus:outline-none"
                value={formData.remarks}
                onChange={handleChange}
              />
            </div>
            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 p-2 rounded border border-red-500/20">
                {error}
              </p>
            )}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Review Details
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Confirm */}
        {step === "CONFIRM" && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
              <FontAwesomeIcon icon={faExclamationTriangle} size="lg" />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">Are you sure?</h4>
            <p className="text-slate-400 text-sm mb-6">
              You are about to create a new shipment from{" "}
              <strong className="text-white">{formData.origin}</strong> to{" "}
              <strong className="text-white">{formData.destination}</strong>{" "}
              with <strong className="text-white">{formData.totalItems}</strong>{" "}
              items.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("FORM")}
                className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-medium transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white hover:bg-red-500 font-bold transition-colors"
              >
                Confirm Create
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Loading */}
        {step === "LOADING" && (
          <div className="p-12 text-center">
            <FontAwesomeIcon
              icon={faCircleNotch}
              spin
              className="text-4xl text-red-500 mb-4"
            />
            <h4 className="text-lg font-bold text-white">
              Creating Shipment...
            </h4>
            <p className="text-slate-500 text-sm mt-2">
              Connecting to Firestore...
            </p>
          </div>
        )}

        {/* Step 4: Success */}
        {step === "SUCCESS" && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
              <FontAwesomeIcon icon={faCheckCircle} size="2x" />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">Success!</h4>
            <p className="text-slate-400 text-sm mb-6">
              The shipment has been successfully created.
            </p>
            <button
              onClick={handleClose}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-bold transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShipmentNewModal;
