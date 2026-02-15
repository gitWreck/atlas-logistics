"use client";
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faArrowRight,
  faCamera,
  faTrash,
  faImage,
} from "@fortawesome/free-solid-svg-icons";
import RouteSection from "./RouteSection";
import ItemSection from "./ItemSection";
import InputGroup from "./InputGroup";
import { useAlert } from "@/app/context/AlertContext";

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
  const { showAlert, showConfirm } = useAlert();

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

  // 1. NEW STATE FOR IMAGES
  // We use initialData.imageFiles if coming back from Step 2, else empty
  const [imageFiles, setImageFiles] = useState(initialData?.imageFiles || []);
  const [previews, setPreviews] = useState(initialData?.previews || []);

  // --- Logic Helpers ---
  useEffect(() => {
    if (profile?.warehouseName && !routeInfo.origin) {
      handleWarehouseChange("origin", profile.warehouseName);
    }
  }, [profile, routeInfo.origin]);

  // 2. NEW: HANDLE IMAGE SELECTION
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);

    // Limits
    const MAX_FILES = 3;
    const MAX_SIZE_MB = 10;

    if (imageFiles.length + files.length > MAX_FILES) {
      return showAlert(
        "error",
        "Limit Reached",
        `You can only upload up to ${MAX_FILES} photos.`,
      );
    }

    const validFiles = [];
    const newPreviews = [];

    files.forEach((file) => {
      // Size Check
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        showAlert(
          "error",
          "File Too Large",
          `${file.name} exceeds ${MAX_SIZE_MB}MB.`,
        );
        return;
      }
      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    });

    setImageFiles((prev) => [...prev, ...validFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  // 3. NEW: REMOVE IMAGE
  const removeImage = (index) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

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
      return showAlert("error", "Route Error", "Select Warehouses.");
    if (routeInfo.originCode === routeInfo.destinationCode)
      return showAlert(
        "error",
        "Route Error",
        "Origin and Destination cannot be the same.",
      );
    if (items.some((it) => !it.description || !it.quantity))
      return showAlert(
        "error",
        "Item Error",
        "Please fill in all item details.",
      );

    // "Emit" the data to the Unified Modal state
    onNext({
      routeInfo,
      sender,
      recipient,
      items,
      remarks,
      imageFiles, // <--- PASS FILES TO PARENT
      previews, // <--- Pass previews to keep state if they click Back
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

          {/* --- 4. NEW: IMAGE UPLOAD SECTION --- */}
          <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Shipment Photos (Optional)
              </h3>
              <span className="text-[10px] text-slate-500">
                {imageFiles.length}/3
              </span>
            </div>

            <div className="flex gap-4 items-start">
              {/* Upload Button */}
              {imageFiles.length < 3 && (
                <label className="w-24 h-24 flex flex-col items-center justify-center bg-slate-900 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-blue-500 hover:text-blue-500 transition-colors text-slate-500">
                  <FontAwesomeIcon icon={faCamera} className="text-xl mb-1" />
                  <span className="text-[10px] font-bold">Add Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </label>
              )}

              {/* Previews */}
              {previews.map((src, idx) => (
                <div
                  key={idx}
                  className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-700 group"
                >
                  <img
                    src={src}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 bg-red-600/80 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 italic">
              Max 3 images. 10MB limit per file.
            </p>
          </div>

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
