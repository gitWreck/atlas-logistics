"use client";
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faPlus,
  faTrash,
  faPaperPlane,
  faWineGlass,
  faSnowflake,
  faWarehouse, // Added
  faRoute, // Added
} from "@fortawesome/free-solid-svg-icons";
import { createShipment } from "@/app/utility/FirebaseFunctions";
import InputGroup from "./ReceivePackageForm/InputGroup";
import { BASIC_PACKAGING_TYPES, INITIAL_CONTACT } from "./shipmentHelpers";
import { useOperationalSettings } from "@/app/utility/useOperationalSettings";

export default function ReceivePackageForm({
  profile,
  isOpen,
  onClose,
  onSuccess,
  isDark = false,
}) {
  const [loading, setLoading] = useState(false);
  const { settings } = useOperationalSettings();
  const warehouses = settings.warehouses;
  const phLocations = settings.phLocations;
  console.log("ReceivePackageForm profile:", profile); // Debugging line

  // --- 1. NEW STATE FOR ROUTE/WAREHOUSE ---
  const [routeInfo, setRouteInfo] = useState({
    origin: "",
    originCode: "",
    destination: "",
    destinationCode: "",
  });

  const [sender, setSender] = useState({ ...INITIAL_CONTACT });
  const [recipient, setRecipient] = useState({ ...INITIAL_CONTACT });

  const [items, setItems] = useState([
    {
      description: "",
      weight: "",
      declaredValue: "",
      packagingType: "Box",
      isFragile: false,
      isPerishable: false,
      length: "",
      width: "",
      height: "",
    },
  ]);
  const [remarks, setRemarks] = useState("");

  // --- 2. WAREHOUSE HANDLER ---
  const handleWarehouseChange = (type, value) => {
    const selected = warehouses.find((w) => w.name === value);
    const code = selected ? selected.code : "";

    if (type === "origin") {
      setRouteInfo((prev) => ({ ...prev, origin: value, originCode: code }));
    } else {
      setRouteInfo((prev) => ({
        ...prev,
        destination: value,
        destinationCode: code,
      }));
    }
  };

  useEffect(() => {
    // If we have a profile, and the origin is currently empty, auto-fill it
    if (profile?.warehouseName && !routeInfo.origin) {
      // Reuse your existing handler or set state directly
      handleWarehouseChange("origin", profile.warehouseName);
    }
  }, [profile, routeInfo.origin]);

  // --- Item Handlers (Unchanged) ---
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

    // Validation: Ensure Warehouses are selected
    if (!routeInfo.originCode || !routeInfo.destinationCode) {
      alert("Please select Origin and Destination Warehouses.");
      return;
    }

    if (routeInfo.originCode === routeInfo.destinationCode) {
      alert("Origin and Destination cannot be the same.");
      return;
    }

    setLoading(true);

    try {
      // Explode Items logic (Unchanged)
      const finalItems = [];
      items.forEach((item) => {
        const qty = parseInt(item.quantity) || 1;
        for (let i = 0; i < qty; i++) {
          finalItems.push({
            description: item.description,
            weight: item.weight,
            packagingType: item.packagingType,
            declaredValue: item.declaredValue,
            isFragile: item.isFragile,
            isPerishable: item.isPerishable,
            length: item.length,
            width: item.width,
            height: item.height,
          });
        }
      });

      // Construct Payload
      const payload = {
        sender: {
          name: sender.name,
          phone: sender.phone,
          address: {
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
          address: {
            unit: recipient.unit,
            street: recipient.street,
            barangay: recipient.barangay,
            city: recipient.city,
            province: recipient.province,
          },
        },

        origin: routeInfo.origin,
        originCode: routeInfo.originCode,
        destination: routeInfo.destination,
        destinationCode: routeInfo.destinationCode,

        items: finalItems,
        remarks,
        notifySms: true,
        notifyPush: true,
        notificationChannels: {
          sms: true,
          email: true,
          push: true,
        },
      };

      const result = await createShipment(payload);
      const shipmentId = result.data?.shipmentId || result.data?.data?.shipmentId;

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
    setRouteInfo({
      origin: "",
      originCode: "",
      destination: "",
      destinationCode: "",
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`fixed inset-0 backdrop-blur-sm ${isDark ? "bg-slate-950/80" : "bg-black/40"}`}
        onClick={handleClose}
      />

      <div
        className={`relative w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}
      >
        {/* HEADER */}
        <div
          className={`flex items-center justify-between p-6 border-b rounded-t-2xl ${isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}
        >
          <h2
            className={`text-xl font-bold flex items-center gap-3 ${isDark ? "text-white" : "text-slate-900"}`}
          >
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <FontAwesomeIcon icon={faBoxOpen} className="text-blue-500" />
            </div>
            Receive New Order
          </h2>
          <button
            onClick={handleClose}
            className={
              isDark
                ? "text-slate-500 hover:text-white transition-colors"
                : "text-slate-500 hover:text-slate-900 transition-colors"
            }
          >
            ✕
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form id="receive-form" onSubmit={handleSubmit} className="space-y-8">
            {/* --- 4. NEW: ROUTE / WAREHOUSE SELECTION (ON TOP) --- */}
            <div
              className={`p-4 rounded-xl border ${isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200"}`}
            >
              <h3
                className={`text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${isDark ? "text-slate-400" : "text-slate-600"}`}
              >
                <FontAwesomeIcon icon={faRoute} /> Shipment Route
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ORIGIN WAREHOUSE */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label
                      className={`text-xs font-bold uppercase ${isDark ? "text-blue-400" : "text-blue-600"}`}
                    >
                      Origin Warehouse
                    </label>
                    {routeInfo.originCode && (
                      <span
                        className={`text-[10px] font-mono px-1.5 rounded ${isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-500/20 text-blue-600"}`}
                      >
                        {routeInfo.originCode}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <FontAwesomeIcon
                      icon={faWarehouse}
                      className="absolute left-3 top-2.5 text-slate-500 text-xs"
                    />
                    <select
                      className={`w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:border-blue-500 outline-none appearance-none cursor-pointer ${isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"}`}
                      value={routeInfo.origin}
                      // defaultValue={profile?.warehouseName || ""} // Default to user's warehouse if available
                      onChange={(e) =>
                        handleWarehouseChange("origin", e.target.value)
                      }
                      required
                    >
                      <option value="">Select Origin...</option>
                      {warehouses.map((w) => (
                        <option key={w.code} value={w.name}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* DESTINATION WAREHOUSE */}
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label
                      className={`text-xs font-bold uppercase ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
                    >
                      Destination Warehouse
                    </label>
                    {routeInfo.destinationCode && (
                      <span
                        className={`text-[10px] font-mono px-1.5 rounded ${isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-500/20 text-emerald-600"}`}
                      >
                        {routeInfo.destinationCode}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <FontAwesomeIcon
                      icon={faWarehouse}
                      className="absolute left-3 top-2.5 text-slate-500 text-xs"
                    />
                    <select
                      className={`w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:border-emerald-500 outline-none appearance-none cursor-pointer ${isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"}`}
                      value={routeInfo.destination}
                      onChange={(e) =>
                        handleWarehouseChange("destination", e.target.value)
                      }
                      required
                    >
                      <option value="">Select Destination...</option>
                      {warehouses.filter(
                        (w) => w.code !== routeInfo.originCode,
                      ).map((w) => (
                        <option key={w.code} value={w.name}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 2: ADDRESSES (Contact Info) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <InputGroup
                label="Sender Contact"
                values={sender}
                onChange={setSender}
                color="blue"
                isDark={isDark}
                phLocations={phLocations}
              />
              <InputGroup
                label="Recipient Contact"
                values={recipient}
                onChange={setRecipient}
                color="emerald"
                isDark={isDark}
                phLocations={phLocations}
              />
            </div>

            {/* ROW 3: ITEMS LIST (Unchanged) */}
            <div className="pt-2">
              <div className="flex justify-between items-center mb-4">
                <h3
                  className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-600"}`}
                >
                  Package Items
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className={`text-xs border px-4 py-2 rounded-lg flex items-center gap-2 ${isDark ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-blue-400" : "bg-slate-200 hover:bg-slate-300 border-slate-300 text-blue-600"}`}
                >
                  <FontAwesomeIcon icon={faPlus} /> Add Box
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-4 animate-in slide-in-from-left-2 duration-300 shadow-sm ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"}`}
                  >
                    {/* TOP ROW: PHYSICAL DETAILS */}
                    <div className="flex gap-4 items-start">
                      {/* Index Badge */}
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-lg font-mono text-xs border mt-6 ${isDark ? "bg-slate-900 text-slate-500 border-slate-800" : "bg-white text-slate-600 border-slate-300"}`}
                      >
                        {idx + 1}
                      </div>

                      {/* Packaging Type */}
                      <div className="w-32">
                        <label
                          className={`text-[10px] uppercase font-bold mb-1 block pl-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                        >
                          Type
                        </label>
                        <select
                          className={`w-full border rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors ${isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"}`}
                          value={item.packagingType}
                          onChange={(e) =>
                            handleItemChange(
                              idx,
                              "packagingType",
                              e.target.value,
                            )
                          }
                        >
                          {BASIC_PACKAGING_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Description */}
                      <div className="flex-1">
                        <label
                          className={`text-[10px] uppercase font-bold mb-1 block pl-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                        >
                          Description
                        </label>
                        <input
                          type="text"
                          className={`w-full border rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors ${isDark ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-600" : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-500"}`}
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
                        <label
                          className={`text-[10px] uppercase font-bold mb-1 block pl-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                        >
                          Weight
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          className={`w-full border rounded-lg px-3 py-2 text-sm text-right pr-8 focus:border-blue-500 outline-none transition-colors ${isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"}`}
                          value={item.weight}
                          onChange={(e) =>
                            handleItemChange(idx, "weight", e.target.value)
                          }
                          required
                        />
                        <span
                          className={`absolute right-3 top-[29px] text-xs font-bold pointer-events-none ${isDark ? "text-slate-500" : "text-slate-500"}`}
                        >
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

                    {/* BOTTOM ROW: HANDLING & VALUE */}
                    <div className="flex gap-4 mt-3 pl-12 items-end">
                      {/* Declared Value */}
                      <div className="w-40 relative">
                        <label
                          className={`text-[10px] uppercase font-bold mb-1 block pl-1 ${isDark ? "text-slate-500" : "text-slate-600"}`}
                        >
                          Declared Value
                        </label>
                        <div className="relative">
                          <span
                            className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold ${isDark ? "text-slate-500" : "text-slate-600"}`}
                          >
                            ₱
                          </span>
                          <input
                            type="number"
                            className={`w-full border rounded-lg pl-7 pr-3 py-2 text-sm focus:border-emerald-500 outline-none transition-colors ${isDark ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-600" : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-500"}`}
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
                              : isDark
                                ? "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                                : "bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800"
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
                              : isDark
                                ? "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                                : "bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-800"
                          }`}
                        >
                          <FontAwesomeIcon icon={faSnowflake} />
                          Perishable
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <textarea
                placeholder="Remarks"
                className={`w-full border rounded-lg px-4 py-2.5 text-sm resize-none ${isDark ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-500"}`}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
            </div>
          </form>
        </div>

        {/* FOOTER */}
        <div
          className={`p-6 border-t rounded-b-2xl ${isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}
        >
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
