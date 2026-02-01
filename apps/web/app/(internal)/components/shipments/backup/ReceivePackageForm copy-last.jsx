"use client";
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faPlus,
  faTrash,
  faPaperPlane,
  faWineGlass,
  faSnowflake,
} from "@fortawesome/free-solid-svg-icons";
import { createShipmentWithPackages } from "@/app/utility/FirebaseFunctions";
import AddressInputGroup from "../AddressInputGroup";

const INITIAL_CONTACT = {
  name: "",
  phone: "",
  unit: "",
  street: "",
  barangay: "",
  city: "",
  province: "",
  code: "", // This is the crucial Origin/Dest code
};

const PACKAGING_TYPES = ["Box", "Sack", "Crate", "Bundle", "Roll", "Envelope"];

export default function ReceivePackageForm({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);

  // Updated State Structure
  const [sender, setSender] = useState({ ...INITIAL_CONTACT });
  const [recipient, setRecipient] = useState({ ...INITIAL_CONTACT });

  // const [items, setItems] = useState([{ weight: "", description: "" }]);

  const [items, setItems] = useState([
    {
      // quantity: 1, // Default 1
      description: "",
      weight: "",

      // New Fields
      declaredValue: "",
      packagingType: "Box",
      isFragile: false,
      isPerishable: false,

      // Hidden Fields (Ready for logic, hidden from display)
      length: "",
      width: "",
      height: "",
    },
  ]);
  const [remarks, setRemarks] = useState("");

  if (!isOpen) return null;

  const toggleItemTag = (index, tag) => {
    const newItems = [...items];
    newItems[index][tag] = !newItems[index][tag];
    setItems(newItems);
  };

  const handleAddItem = () =>
    setItems([...items, { weight: "", description: "" }]);

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation: Ensure Codes are present
    if (!sender.code || !recipient.code) {
      alert(
        "Please select a valid City/Province to generate the Location Code.",
      );
      return;
    }

    setLoading(true);

    try {
      // 2. EXPLODE ITEMS (Handle Quantity Multiplier)
      // If user enters Qty: 3, we create 3 identical objects in the array
      const finalItems = [];

      items.forEach((item) => {
        const qty = parseInt(item.quantity) || 1;
        for (let i = 0; i < qty; i++) {
          finalItems.push({
            description: item.description,
            weight: item.weight,
            packagingType: item.packagingType,

            // New Fields
            declaredValue: item.declaredValue,
            isFragile: item.isFragile,
            isPerishable: item.isPerishable,

            // Dimensions (Hidden but present)
            length: item.length,
            width: item.width,
            height: item.height,
          });
        }
      });

      // 3. Construct Payload with "details" object
      const payload = {
        sender: {
          name: sender.name,
          phone: sender.phone,
          // PASS GRANULAR DETAILS SO BACKEND CAN QUERY THEM
          details: {
            unit: sender.unit,
            street: sender.street,
            barangay: sender.barangay,
            city: sender.city,
            province: sender.province,
          },
        },
        recipient: {
          name: recipient.name,
          phone: recipient.phone,
          details: {
            unit: recipient.unit,
            street: recipient.street,
            barangay: recipient.barangay,
            city: recipient.city,
            province: recipient.province,
          },
        },

        // Codes (Root Level)
        origin: sender.city,
        originCode: sender.code,
        destination: recipient.city,
        destinationCode: recipient.code,

        // Pass the exploded array
        items: finalItems,
        remarks,
      };
      // Call Backend
      const result = await createShipmentWithPackages(payload);
      const { shipmentId } = result.data;

      alert(`Success! Created ${shipmentId} packages.`);
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSender({ ...INITIAL_CONTACT });
    setRecipient({ ...INITIAL_CONTACT });
    setItems([{ weight: "", description: "" }]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* HEADER */}
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

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form id="receive-form" onSubmit={handleSubmit} className="space-y-8">
            {/* ROW 1: ADDRESSES (Now Clean & Reusable) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <AddressInputGroup
                label="Sender"
                values={sender}
                onChange={setSender}
                color="blue"
              />
              <AddressInputGroup
                label="Recipient"
                values={recipient}
                onChange={setRecipient}
                color="emerald"
              />
            </div>

            {/* ROW 2: ITEMS LIST */}
            <div className="pt-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                  Package Items
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-400 px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <FontAwesomeIcon icon={faPlus} /> Add Box
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 rounded-xl border border-slate-800 p-4 animate-in slide-in-from-left-2 duration-300 shadow-sm"
                  >
                    {/* --- TOP ROW: PHYSICAL DETAILS --- */}
                    <div className="flex gap-4 items-start">
                      {/* Index Badge */}
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 text-slate-500 font-mono text-xs border border-slate-800 mt-6">
                        {idx + 1}
                      </div>

                      {/* Packaging Type */}
                      <div className="w-32">
                        <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block pl-1">
                          Type
                        </label>
                        <select
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none transition-colors"
                          value={item.packagingType}
                          onChange={(e) =>
                            handleItemChange(
                              idx,
                              "packagingType",
                              e.target.value,
                            )
                          }
                        >
                          {PACKAGING_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Description */}
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block pl-1">
                          Description
                        </label>
                        <input
                          type="text"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none placeholder:text-slate-600 transition-colors"
                          value={item.description}
                          onChange={(e) =>
                            handleItemChange(idx, "description", e.target.value)
                          }
                          required
                          placeholder="e.g. Nike Shoes"
                        />
                      </div>

                      {/* Weight */}
                      <div className="w-24 relative">
                        <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block pl-1">
                          Weight
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm text-right pr-8 focus:border-blue-500 outline-none transition-colors"
                          value={item.weight}
                          onChange={(e) =>
                            handleItemChange(idx, "weight", e.target.value)
                          }
                          required
                        />
                        <span className="absolute right-3 top-[29px] text-slate-500 text-xs font-bold pointer-events-none">
                          KG
                        </span>
                      </div>

                      {/* Remove Button */}
                      {items.length > 1 && (
                        <div className="mt-6">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="w-9 h-9 flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                            title="Remove Item"
                          >
                            <FontAwesomeIcon
                              icon={faTrash}
                              className="text-sm"
                            />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* --- BOTTOM ROW: HANDLING & VALUE --- */}
                    <div className="flex gap-4 mt-3 pl-12 items-end">
                      {/* Declared Value */}
                      <div className="w-40 relative">
                        <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block pl-1">
                          Declared Value
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">
                            ₱
                          </span>
                          <input
                            type="number"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-white text-sm focus:border-emerald-500 outline-none placeholder:text-slate-600 transition-colors"
                            value={item.declaredValue}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "declaredValue",
                                e.target.value,
                              )
                            }
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {/* Handling Tags */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleItemTag(idx, "isFragile")}
                          className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all ${
                            item.isFragile
                              ? "bg-amber-500/10 border-amber-500 text-amber-500"
                              : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                          }`}
                        >
                          <FontAwesomeIcon icon={faWineGlass} />
                          Fragile
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleItemTag(idx, "isPerishable")}
                          className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all ${
                            item.isPerishable
                              ? "bg-cyan-500/10 border-cyan-500 text-cyan-500"
                              : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                          }`}
                        >
                          <FontAwesomeIcon icon={faSnowflake} />
                          Perishable
                        </button>
                      </div>

                      {/* HIDDEN DIMENSIONS (Logic remains, but inputs are invisible) */}
                      <div className="hidden">
                        <input
                          value={item.length}
                          onChange={(e) =>
                            handleItemChange(idx, "length", e.target.value)
                          }
                        />
                        <input
                          value={item.width}
                          onChange={(e) =>
                            handleItemChange(idx, "width", e.target.value)
                          }
                        />
                        <input
                          value={item.height}
                          onChange={(e) =>
                            handleItemChange(idx, "height", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <textarea
                placeholder="Remarks"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm resize-none"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
            </div>
          </form>
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl">
          <button
            type="submit"
            form="receive-form"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              "Processing..."
            ) : (
              <>
                <FontAwesomeIcon icon={faPaperPlane} /> Create Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
