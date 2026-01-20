"use client";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faPlus,
  faTrash,
  faPaperPlane,
  faCircleNotch,
} from "@fortawesome/free-solid-svg-icons";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/config/firebase"; // Your client-side config

export default function ReceivePackageForm({ onSuccess }) {
  const [loading, setLoading] = useState(false);

  // Form State
  const [sender, setSender] = useState({ name: "", phone: "", address: "" });
  const [recipient, setRecipient] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const [routeInfo, setRouteInfo] = useState({
    origin: "MNL",
    destination: "CEB",
  });

  // Items Array
  const [items, setItems] = useState([{ weight: "", desc: "" }]);

  const handleAddItem = () => {
    setItems([...items, { weight: "", desc: "" }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Prepare Payload
      const payload = {
        sender,
        recipient,
        origin: routeInfo.origin,
        destination: routeInfo.destination,
        items,
      };

      // 2. Call Cloud Function v2
      const createShipment = httpsCallable(
        functions,
        "createShipmentWithPackages"
      );
      const result = await createShipment(payload);

      const { shipmentId, packageIds } = result.data;

      alert(
        `Success! Created Shipment: ${shipmentId} with ${packageIds.length} packages.`
      );

      // 3. Reset Form
      setSender({ name: "", phone: "", address: "" });
      setRecipient({ name: "", phone: "", address: "" });
      setItems([{ weight: "", desc: "" }]);

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to create shipment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <FontAwesomeIcon icon={faBoxOpen} className="text-blue-500" />
        Receive New Shipment
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ROW 1: Route Info (Critical for ID generation) */}
        <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-slate-950/50 rounded-lg border border-slate-800">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">
              Origin Hub
            </label>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm mt-1"
              value={routeInfo.origin}
              onChange={(e) =>
                setRouteInfo({ ...routeInfo, origin: e.target.value })
              }
            >
              <option value="MNL">Manila (MNL)</option>
              <option value="DVO">Davao (DVO)</option>
              <option value="CEB">Cebu (CEB)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">
              Destination Hub
            </label>
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white text-sm mt-1"
              value={routeInfo.destination}
              onChange={(e) =>
                setRouteInfo({ ...routeInfo, destination: e.target.value })
              }
            >
              <option value="CEB">Cebu (CEB)</option>
              <option value="MNL">Manila (MNL)</option>
              <option value="ODI">Odiongan (ODI)</option>
            </select>
          </div>
        </div>

        {/* ROW 2: SENDER & RECIPIENT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase">
              Sender
            </h3>
            <input
              type="text"
              placeholder="Name"
              className="input-field"
              value={sender.name}
              onChange={(e) => setSender({ ...sender, name: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Phone"
              className="input-field"
              value={sender.phone}
              onChange={(e) => setSender({ ...sender, phone: e.target.value })}
              required
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase">
              Recipient
            </h3>
            <input
              type="text"
              placeholder="Name"
              className="input-field"
              value={recipient.name}
              onChange={(e) =>
                setRecipient({ ...recipient, name: e.target.value })
              }
              required
            />
            <input
              type="text"
              placeholder="Phone"
              className="input-field"
              value={recipient.phone}
              onChange={(e) =>
                setRecipient({ ...recipient, phone: e.target.value })
              }
              required
            />
          </div>
        </div>

        {/* ROW 3: ITEMS */}
        <div className="pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase">
              Items ({items.length})
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="text-xs bg-slate-800 text-blue-400 px-3 py-1.5 rounded hover:bg-slate-700"
            >
              <FontAwesomeIcon icon={faPlus} /> Add
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-3 items-center">
                <span className="text-slate-600 font-mono text-sm w-6 text-center">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  placeholder="Description (e.g. Clothes)"
                  className="flex-1 input-field"
                  value={item.desc}
                  onChange={(e) =>
                    handleItemChange(idx, "desc", e.target.value)
                  }
                  required
                />
                <input
                  type="number"
                  placeholder="Kg"
                  className="w-24 input-field"
                  value={item.weight}
                  onChange={(e) =>
                    handleItemChange(idx, "weight", e.target.value)
                  }
                  required
                />

                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="text-slate-500 hover:text-red-400 px-2"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 transition-all"
        >
          {loading ? (
            <FontAwesomeIcon icon={faCircleNotch} spin />
          ) : (
            <FontAwesomeIcon icon={faPaperPlane} />
          )}
          {loading ? "Creating..." : "Create Shipment"}
        </button>
      </form>

      {/* Quick CSS for inputs */}
      <style jsx>{`
        .input-field {
          width: 100%;
          background-color: #020617; /* slate-950 */
          border: 1px solid #334155; /* slate-700 */
          border-radius: 0.5rem;
          padding: 0.5rem 1rem;
          color: white;
          font-size: 0.875rem;
        }
        .input-field:focus {
          outline: none;
          border-color: #3b82f6; /* blue-500 */
        }
      `}</style>
    </div>
  );
}
