"use client";
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen, faArrowRight } from "@fortawesome/free-solid-svg-icons";
import RouteSection from "./RouteSection";
import ItemSection from "./ItemSection";
import InputGroup from "./InputGroup";

const INITIAL_CONTACT = {
  name: "",
  phone: "",
  unit: "",
  street: "",
  barangay: "",
  city: "",
  province: "",
};

export default function ReceivePackageForm({ profile, onNext, initialData }) {
  // Use initialData if the user clicked "Back" from Step 2
  const [routeInfo, setRouteInfo] = useState(
    initialData?.routeInfo || {
      origin: "",
      originCode: "",
      destination: "",
      destinationCode: "",
    },
  );
  const [sender, setSender] = useState(
    initialData?.sender || { ...INITIAL_CONTACT },
  );
  const [recipient, setRecipient] = useState(
    initialData?.recipient || { ...INITIAL_CONTACT },
  );
  const [items, setItems] = useState(
    initialData?.items || [
      {
        description: "",
        weight: "",
        declaredValue: "",
        packagingType: "Box",
        isFragile: false,
        isPerishable: false,
      },
    ],
  );
  const [remarks, setRemarks] = useState(initialData?.remarks || "");

  // --- Logic Helpers ---
  useEffect(() => {
    if (profile?.warehouseName && !routeInfo.origin) {
      handleWarehouseChange("origin", profile.warehouseName);
    }
  }, [profile, routeInfo.origin]);

  const handleWarehouseChange = (type, value) => {
    const { WAREHOUSES } = require("@/app/utility/WarehouseData");
    const selected = WAREHOUSES.find((w) => w.name === value);

    // 1. Update Route Info (Standard)
    setRouteInfo((prev) => ({
      ...prev,
      [type]: value,
      [`${type}Code`]: selected?.code || "",
    }));

    // 2. Auto-fill Contact Address if warehouse has data
    if (selected?.city && selected?.province) {
      if (type === "origin") {
        setSender((prev) => ({
          ...prev,
          city: selected.city,
          province: selected.province,
        }));
      } else if (type === "destination") {
        setRecipient((prev) => ({
          ...prev,
          city: selected.city,
          province: selected.province,
        }));
      }
    }
  };

  const handleNext = (e) => {
    e.preventDefault();

    // Validation Logic
    if (!routeInfo.originCode || !routeInfo.destinationCode)
      return alert("Select Warehouses.");
    if (routeInfo.originCode === routeInfo.destinationCode)
      return alert("Origin and Destination cannot be the same.");
    if (items.some((it) => !it.description || !it.quantity))
      return alert("Please fill in all item details.");

    // "Emit" the data to the Unified Modal state
    onNext({
      routeInfo,
      sender,
      recipient,
      items,
      remarks,
    });
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-left duration-300 overflow-hidden">
      {/* Scrollable Form Area */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <form id="step1-form" onSubmit={handleNext} className="space-y-8">
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
            onAdd={() =>
              setItems([
                ...items,
                { description: "", weight: "", packagingType: "Box" },
              ])
            }
            onRemove={(idx) => setItems(items.filter((_, i) => i !== idx))}
            onChange={(idx, field, val) => {
              const newItems = [...items];
              newItems[idx][field] = val;
              setItems(newItems);
            }}
            onToggleTag={(idx, tag) => {
              const newItems = [...items];
              newItems[idx][tag] = !newItems[idx][tag];
              setItems(newItems);
            }}
          />

          <textarea
            placeholder="Additional Remarks..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm resize-none"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
          />
        </form>
      </div>

      {/* Footer Navigation */}
      <div className="p-6 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl">
        <button
          type="submit"
          form="step1-form"
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex justify-center items-center gap-2"
        >
          <span>Continue to Trip Selection</span>
          <FontAwesomeIcon icon={faArrowRight} />
        </button>
      </div>
    </div>
  );
}
