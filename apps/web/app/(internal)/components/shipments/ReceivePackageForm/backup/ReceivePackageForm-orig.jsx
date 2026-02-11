"use client";
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen, faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import { createShipmentWithPackages } from "@/app/utility/FirebaseFunctions";
import { WAREHOUSES } from "@/app/utility/WarehouseData";
import InputGroup from "../InputGroup";
import RouteSection from "../RouteSection";
import ItemSection from "../ItemSection";

const INITIAL_CONTACT = {
  name: "",
  phone: "",
  unit: "",
  street: "",
  barangay: "",
  city: "",
  province: "",
};

export default function ReceivePackageForm({
  profile,
  isOpen,
  onClose,
  onSuccess,
}) {
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState({
    origin: "",
    originCode: "",
    destination: "",
    destinationCode: "",
  });
  const [sender, setSender] = useState({ ...INITIAL_CONTACT });
  const [recipient, setRecipient] = useState({ ...INITIAL_CONTACT });
  const [remarks, setRemarks] = useState("");
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

  const handleWarehouseChange = (type, value) => {
    const selected = WAREHOUSES.find((w) => w.name === value);
    const code = selected ? selected.code : "";
    setRouteInfo((prev) => ({
      ...prev,
      [type]: value,
      [`${type}Code`]: code,
    }));
  };

  useEffect(() => {
    if (profile?.warehouseName && !routeInfo.origin) {
      handleWarehouseChange("origin", profile.warehouseName);
    }
  }, [profile, routeInfo.origin]);

  const toggleItemTag = (idx, tag) => {
    const newItems = [...items];
    newItems[idx][tag] = !newItems[idx][tag];
    setItems(newItems);
  };
  const handleAddItem = () =>
    setItems([...items, { weight: "", description: "", packagingType: "Box" }]);
  const handleRemoveItem = (idx) => setItems(items.filter((_, i) => i !== idx));
  const handleItemChange = (idx, field, value) => {
    const newItems = [...items];
    newItems[idx][field] = value;
    setItems(newItems);
  };

  const handleClose = () => {
    setSender({ ...INITIAL_CONTACT });
    setRecipient({ ...INITIAL_CONTACT });
    setItems([
      { description: "", weight: "", declaredValue: "", packagingType: "Box" },
    ]);
    setRouteInfo({
      origin: "",
      originCode: "",
      destination: "",
      destinationCode: "",
    });
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!routeInfo.originCode || !routeInfo.destinationCode)
      return alert("Please select Origin and Destination Warehouses.");
    if (routeInfo.originCode === routeInfo.destinationCode)
      return alert("Origin and Destination cannot be the same.");

    setLoading(true);
    try {
      const finalItems = [];
      items.forEach((item) => {
        const qty = parseInt(item.quantity) || 1;
        for (let i = 0; i < qty; i++) {
          finalItems.push({ ...item });
        }
      });

      const payload = {
        sender: {
          name: sender.name,
          phone: sender.phone,
          details: { ...sender },
        },
        recipient: {
          name: recipient.name,
          phone: recipient.phone,
          details: { ...recipient },
        },
        origin: routeInfo.origin,
        originCode: routeInfo.originCode,
        destination: routeInfo.destination,
        destinationCode: routeInfo.destinationCode,
        items: finalItems,
        remarks,
      };

      const result = await createShipmentWithPackages(payload);
      alert(`Success! Created ${result.data.shipmentId} packages.`);
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
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

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form id="receive-form" onSubmit={handleSubmit} className="space-y-8">
            <RouteSection
              routeInfo={routeInfo}
              onWarehouseChange={handleWarehouseChange}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <InputGroup
                label="Sender Contact"
                values={sender}
                onChange={setSender}
                color="blue"
              />
              <InputGroup
                label="Recipient Contact"
                values={recipient}
                onChange={setRecipient}
                color="emerald"
              />
            </div>

            <ItemSection
              items={items}
              onAdd={handleAddItem}
              onRemove={handleRemoveItem}
              onChange={handleItemChange}
              onToggleTag={toggleItemTag}
            />

            <textarea
              placeholder="Remarks"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm resize-none"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
            />
          </form>
        </div>

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
