// public/shared/dragDrop.js
// Drag payload is JSON: { shipmentId, fromTruckTripId|null }

export function setDragPayload(e, payload) {
  try {
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  } catch {}
}

export function readDragPayload(e) {
  try {
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Generic dropzone binder
export function bindDropzone(el, { onDrop, outline = "2px dashed #2563eb" } = {}) {
  if (!el) return () => {};

  const onOver = (e) => {
    e.preventDefault();
    el.style.outline = outline;
    el.style.outlineOffset = "4px";
  };
  const onLeave = () => {
    el.style.outline = "none";
  };
  const onDropHandler = async (e) => {
    e.preventDefault();
    el.style.outline = "none";
    const payload = readDragPayload(e);
    if (payload && typeof onDrop === "function") {
      await onDrop(payload, e);
    }
  };

  el.addEventListener("dragover", onOver);
  el.addEventListener("dragleave", onLeave);
  el.addEventListener("drop", onDropHandler);

  return () => {
    el.removeEventListener("dragover", onOver);
    el.removeEventListener("dragleave", onLeave);
    el.removeEventListener("drop", onDropHandler);
  };
}
