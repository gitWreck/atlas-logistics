"use client";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faPlus,
  faTrash,
  faPaperPlane,
} from "@fortawesome/free-solid-svg-icons";

export default function ReceivePackageForm({ onSuccess }) {
  const [loading, setLoading] = useState(false);

  // Form State
  const [sender, setSender] = useState({ name: "", phone: "", address: "" });
  const [recipient, setRecipient] = useState({
    name: "",
    phone: "",
    address: "",
  });

  // Items Array (Start with 1 empty box)
  const [items, setItems] = useState([{ weight: "", description: "" }]);

  const handleAddItem = () => {
    setItems([...items, { weight: "", description: "" }]);
  };

  const handleRemoveItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
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
      const res = await fetch("/api/manager/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender,
          recipient,
          items,
          createdBy: "manager_uid_here",
        }),
      });

      if (!res.ok) throw new Error("Failed to create order");

      const data = await res.json();
      alert(`Success! Order ID: ${data.orderId}`);

      // Reset Form
      setSender({ name: "", phone: "", address: "" });
      setRecipient({ name: "", phone: "", address: "" });
      setItems([{ weight: "", description: "" }]);

      if (onSuccess) onSuccess(); // Refresh table
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <FontAwesomeIcon icon={faBoxOpen} className="text-blue-500" />
        Receive New Order
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ROW 1: SENDER & RECIPIENT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sender Column */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase">
              Sender Details
            </h3>
            <input
              type="text"
              placeholder="Sender Name"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm"
              value={sender.name}
              onChange={(e) => setSender({ ...sender, name: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Sender Phone"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm"
              value={sender.phone}
              onChange={(e) => setSender({ ...sender, phone: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Sender Address"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm"
              value={sender.address}
              onChange={(e) =>
                setSender({ ...sender, address: e.target.value })
              }
              required
            />
          </div>

          {/* Recipient Column */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase">
              Recipient Details
            </h3>
            <input
              type="text"
              placeholder="Recipient Name"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm"
              value={recipient.name}
              onChange={(e) =>
                setRecipient({ ...recipient, name: e.target.value })
              }
              required
            />
            <input
              type="text"
              placeholder="Recipient Phone"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm"
              value={recipient.phone}
              onChange={(e) =>
                setRecipient({ ...recipient, phone: e.target.value })
              }
              required
            />
            <input
              type="text"
              placeholder="Recipient Address"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm"
              value={recipient.address}
              onChange={(e) =>
                setRecipient({ ...recipient, address: e.target.value })
              }
              required
            />
          </div>
        </div>

        {/* ROW 2: ITEMS LIST */}
        <div className="pt-4 border-t border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase">
              Package Items ({items.length})
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-3 py-1.5 rounded transition-colors"
            >
              <FontAwesomeIcon icon={faPlus} /> Add Box
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex gap-3 items-start animate-in slide-in-from-left-2 duration-300"
              >
                <span className="text-slate-600 font-mono text-sm pt-2">
                  #{idx + 1}
                </span>
                <input
                  type="text"
                  placeholder="Description (e.g. Clothes)"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm"
                  value={item.description}
                  onChange={(e) =>
                    handleItemChange(idx, "description", e.target.value)
                  }
                  required
                />
                <input
                  type="number"
                  placeholder="Kg"
                  className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm"
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
                    className="text-slate-500 hover:text-red-400 pt-2 px-2"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors flex justify-center items-center gap-2"
          >
            {loading ? (
              "Processing..."
            ) : (
              <>
                <FontAwesomeIcon icon={faPaperPlane} /> Create Order & Print
                Labels
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
