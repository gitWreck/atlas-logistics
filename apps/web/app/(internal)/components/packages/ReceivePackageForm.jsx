"use client";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faPlus,
  faTrash,
  faPaperPlane,
  faTimes, // Added for the close button visual
} from "@fortawesome/free-solid-svg-icons";
import { createPackage } from "@/app/utility/FirebaseFunctions";

export default function ReceivePackageForm({ isOpen, onClose, onSuccess }) {
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

  if (!isOpen) return null;

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
      // 1. Prepare Payload
      const payload = {
        sender,
        recipient,
        items,
      };

      const result = await createPackage(payload);

      const { shipmentId, packageIds } = result.data;

      alert(`Success! Created ${packageIds} packages.`);

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

  const handleClose = () => {
    setRecipient({
      name: "",
      phone: "",
      address: "",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Container - WIDER and SCROLLABLE */}
      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* HEADER (Sticky) */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <FontAwesomeIcon icon={faBoxOpen} className="text-blue-500" />
            </div>
            Receive New Order
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* SCROLLABLE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form id="receive-form" onSubmit={handleSubmit} className="space-y-8">
            {/* ROW 1: SENDER & RECIPIENT */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Sender Column */}
              <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
                  Sender Details
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Sender Name"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-2.5 text-white text-sm transition-all"
                    value={sender.name}
                    onChange={(e) =>
                      setSender({ ...sender, name: e.target.value })
                    }
                    required
                  />
                  <input
                    type="text"
                    placeholder="Sender Phone"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-2.5 text-white text-sm transition-all"
                    value={sender.phone}
                    onChange={(e) =>
                      setSender({ ...sender, phone: e.target.value })
                    }
                    required
                  />
                  <input
                    type="text"
                    placeholder="Sender Address"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-2.5 text-white text-sm transition-all"
                    value={sender.address}
                    onChange={(e) =>
                      setSender({ ...sender, address: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* Recipient Column */}
              <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                  Recipient Details
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Recipient Name"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-4 py-2.5 text-white text-sm transition-all"
                    value={recipient.name}
                    onChange={(e) =>
                      setRecipient({ ...recipient, name: e.target.value })
                    }
                    required
                  />
                  <input
                    type="text"
                    placeholder="Recipient Phone"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-4 py-2.5 text-white text-sm transition-all"
                    value={recipient.phone}
                    onChange={(e) =>
                      setRecipient({ ...recipient, phone: e.target.value })
                    }
                    required
                  />
                  <input
                    type="text"
                    placeholder="Recipient Address"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-4 py-2.5 text-white text-sm transition-all"
                    value={recipient.address}
                    onChange={(e) =>
                      setRecipient({ ...recipient, address: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            {/* ROW 2: ITEMS LIST */}
            <div className="pt-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                  Package Items{" "}
                  <span className="text-slate-600 ml-2 text-xs">
                    Total: {items.length}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-400 hover:text-blue-300 px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                >
                  <FontAwesomeIcon icon={faPlus} /> Add Another Box
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex gap-4 items-center p-3 bg-slate-950 rounded-lg border border-slate-800 animate-in slide-in-from-left-2 duration-300 group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-slate-500 font-mono text-xs border border-slate-800">
                      {idx + 1}
                    </div>

                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Description (e.g. Clothes, Electronics)"
                        className="w-full bg-transparent border-0 border-b border-slate-800 focus:border-blue-500 focus:ring-0 px-0 py-2 text-white text-sm placeholder:text-slate-600"
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(idx, "description", e.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="w-32 relative">
                      <input
                        type="number"
                        placeholder="0"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm text-right pr-8"
                        value={item.weight}
                        onChange={(e) =>
                          handleItemChange(idx, "weight", e.target.value)
                        }
                        required
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold pointer-events-none">
                        KG
                      </span>
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-all"
                        title="Remove item"
                      >
                        <FontAwesomeIcon icon={faTrash} className="text-sm" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* FOOTER (Sticky) */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl">
          <button
            type="submit"
            form="receive-form" // Connects to form ID
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>
    </div>
  );
}
