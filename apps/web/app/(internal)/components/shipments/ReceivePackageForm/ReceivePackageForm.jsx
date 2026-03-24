"use client";
import { useEffect, useRef, useState } from "react";
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
export default function ReceivePackageForm({
  // key,
  profile,
  onNext,
  initialData,
  isPickupMode,
  isDark = false,
  user,
}) {
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
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

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

  // 1. Safer Stop Function
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  // 2. Safer Start Function
  const startCamera = async () => {
    // Force stop any existing streams first
    stopCamera();
    setIsCameraOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Prefers back camera
      });

      // Delay slightly to ensure the modal DOM exists
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera error:", err);
      setIsCameraOpen(false);

      // Specific error handling
      if (err.name === "NotReadableError") {
        alert(
          "Camera is currently in use by another application. Please close other apps/tabs and try again.",
        );
      } else if (err.name === "NotAllowedError") {
        alert(
          "Camera permission denied. Please allow camera access in your browser settings.",
        );
      } else {
        alert(`Error starting camera: ${err.message}`);
      }
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Match dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to File
      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], `capture_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        // Reuse existing handler by mocking an event
        const pseudoEvent = { target: { files: [file] } };
        handleImageSelect(pseudoEvent);

        stopCamera();
      }, "image/jpeg");
    }
  };

  useEffect(() => {
    // This runs when the component unmounts or modal closes
    return () => {
      stopCamera();
    };
  }, []);

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
    // if (selected?.city && selected?.province) {
    //   if (type === "origin") {
    //     setSender((prev) => ({
    //       ...prev,
    //       city: selected.city,
    //       province: selected.province,
    //     }));
    //   } else if (type === "destination") {
    //     setRecipient((prev) => ({
    //       ...prev,
    //       city: selected.city,
    //       province: selected.province,
    //     }));
    //   }
    // }
  };

  const handleNext = (e) => {
    e.preventDefault();

    // 1. Origin is always required
    if (!routeInfo.originCode) {
      return showAlert("error", "Route Error", "Origin Hub is required.");
    }

    // 2. Destination is required ONLY if it's NOT a pickup
    if (!isPickupMode && !routeInfo.destinationCode) {
      return showAlert("error", "Route Error", "Select Destination Warehouse.");
    }

    // 3. If they DO select a destination, it can't be the same as origin
    if (
      routeInfo.destinationCode &&
      routeInfo.originCode === routeInfo.destinationCode
    ) {
      return showAlert(
        "error",
        "Route Error",
        "Origin and Destination cannot be the same.",
      );
    }

    // 4. Validate Items
    if (items.some((it) => !it.description || !it.quantity)) {
      return showAlert(
        "error",
        "Item Error",
        "Please fill in all item details.",
      );
    }

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
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        <form
          id="step1-form"
          onSubmit={handleNext}
          className="space-y-6 sm:space-y-8 pb-20 sm:pb-0"
        >
          <RouteSection
            routeInfo={routeInfo}
            onWarehouseChange={handleWarehouseChange}
            isPickupMode={isPickupMode}
            isDark={isDark}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
            <InputGroup
              label="Sender Contact"
              values={sender}
              onChange={setSender}
              color="blue"
              isDark={isDark}
              user={user}
            />
            <InputGroup
              label="Recipient Contact"
              values={recipient}
              onChange={setRecipient}
              color="emerald"
              isDark={isDark}
              user={user}
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
            isDark={isDark}
          />

          {/* --- IMAGE UPLOAD SECTION --- */}
          <div
            className={`p-4 rounded-xl border space-y-3 ${isDark ? "bg-slate-950/50 border-slate-800/50" : "bg-slate-50 border-slate-200"}`}
          >
            <div className="flex justify-between items-center">
              <h3
                className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-600"}`}
              >
                Shipment Photos
              </h3>
              <span
                className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-500"}`}
              >
                {imageFiles.length}/3
              </span>
            </div>
            <div className="flex gap-4 items-start overflow-x-auto pb-2 sm:pb-0 custom-scrollbar">
              {/* BUTTON GROUP: Show if less than 3 images */}
              {imageFiles.length <= 5 && (
                <div className="flex gap-3 shrink-0">
                  {/* 1. UPLOAD FILE BUTTON */}
                  <label
                    className={`w-20 h-20 sm:w-24 sm:h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-colors ${isDark ? "bg-slate-900 border-slate-700 hover:border-blue-500 hover:text-blue-500 text-slate-500" : "bg-white border-slate-300 hover:border-blue-500 hover:text-blue-600 text-slate-600"}`}
                  >
                    <FontAwesomeIcon icon={faImage} className="text-xl mb-1" />
                    <span className="text-[9px] sm:text-[10px] font-bold">
                      Upload
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </label>

                  {/* 2. CAMERA BUTTON */}
                  <button
                    type="button"
                    onClick={startCamera}
                    className={`w-20 h-20 sm:w-24 sm:h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-colors ${isDark ? "bg-slate-900 border-slate-700 hover:border-emerald-500 hover:text-emerald-500 text-slate-500" : "bg-white border-slate-300 hover:border-emerald-500 hover:text-emerald-600 text-slate-600"}`}
                  >
                    <FontAwesomeIcon icon={faCamera} className="text-xl mb-1" />
                    <span className="text-[9px] sm:text-[10px] font-bold">
                      Camera
                    </span>
                  </button>
                </div>
              )}

              {/* Previews */}
              {previews.map((src, idx) => (
                <div
                  key={idx}
                  className={`relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border group ${isDark ? "border-slate-700" : "border-slate-300"}`}
                >
                  <img
                    src={src}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 bg-red-600/80 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              ))}
            </div>
            <p
              className={`text-[10px] italic ${isDark ? "text-slate-500" : "text-slate-600"}`}
            >
              Max 5 images. 10MB limit per file.
            </p>
          </div>

          <textarea
            placeholder="Additional Remarks..."
            className={`w-full border rounded-lg px-4 py-2.5 text-sm resize-none ${isDark ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-500"}`}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
          />
        </form>
      </div>

      {/* --- CAMERA OVERLAY MODAL --- */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-in fade-in duration-200">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
            <span className="text-white font-bold text-sm">Take Photo</span>
            <button
              onClick={stopCamera}
              className="text-white bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center backdrop-blur-md"
            >
              ✕
            </button>
          </div>

          {/* Video Stream */}
          <div className="flex-1 flex items-center justify-center bg-black overflow-hidden relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Hidden Canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Capture Footer */}
          <div className="p-8 bg-black flex justify-center items-center pb-12">
            <button
              type="button"
              onClick={capturePhoto}
              className="w-16 h-16 rounded-full bg-white border-4 border-slate-300 shadow-lg hover:scale-105 active:scale-95 transition-transform"
            />
          </div>
        </div>
      )}
    </div>
  );
}
