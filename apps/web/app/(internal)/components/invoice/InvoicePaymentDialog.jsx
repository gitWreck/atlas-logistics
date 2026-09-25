"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faPaperclip, faTrash } from "@fortawesome/free-solid-svg-icons";

const PAYMENT_PROOF_TYPES = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png"]);
const MAX_PAYMENT_PROOF_BYTES = 15 * 1024 * 1024;
const MAX_PAYMENT_PROOFS = 5;

export default function InvoicePaymentDialog({ invoice, isDark = false, isSaving = false, statusError = "", onCancel, onConfirm }) {
  const [method, setMethod] = useState("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [destinationCode, setDestinationCode] = useState("");
  const [proofFiles, setProofFiles] = useState([]);
  const [sendNotification, setSendNotification] = useState(true);
  const [validationError, setValidationError] = useState("");

  const handleProofSelection = (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    const combined = [...proofFiles, ...selected];
    if (combined.length > MAX_PAYMENT_PROOFS) {
      setValidationError(`Attach no more than ${MAX_PAYMENT_PROOFS} payment proofs.`);
      return;
    }
    const invalidType = selected.find((file) => !PAYMENT_PROOF_TYPES.has(String(file.type || "").toLowerCase()));
    if (invalidType) {
      setValidationError(`${invalidType.name} is not a PDF, JPG, or PNG file.`);
      return;
    }
    const oversized = selected.find((file) => file.size > MAX_PAYMENT_PROOF_BYTES);
    if (oversized) {
      setValidationError(`${oversized.name} is larger than 15 MB.`);
      return;
    }
    setValidationError("");
    setProofFiles(combined);
  };

  const handleConfirm = () => {
    if (["BANK_TRANSFER", "GCASH", "CHECK"].includes(method) && proofFiles.length === 0) {
      setValidationError("Upload at least one payment proof for this payment method.");
      return;
    }
    setValidationError("");
    onConfirm?.({
      sendNotification,
      payment: { method, referenceNumber, destinationCode, proofFiles },
    });
  };

  return (
    <div className={`fixed inset-0 z-[120] flex items-center justify-center p-4 ${isDark ? "bg-slate-950/70 backdrop-blur-sm" : "bg-black/40 backdrop-blur-sm"}`}>
      <div role="dialog" aria-modal="true" aria-label="Mark invoice as paid" className={`w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl ${isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"}`}>
        <div className={`border-b px-6 py-5 ${isDark ? "border-slate-800 bg-slate-950/50" : "border-slate-200 bg-slate-50/80"}`}>
          <h3 className="text-lg font-bold">Mark invoice as paid</h3>
          <p className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>{invoice?.invoiceNumber || invoice?.id || "Selected invoice"}</p>
        </div>

        <div className="space-y-5 p-6">
          <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>Enter the payment details below.</p>
          <section className="space-y-4">
            <label className="block text-sm font-semibold">
              <span>Payment method</span>
              <select value={method} onChange={(event) => setMethod(event.target.value)} disabled={isSaving} className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm ${isDark ? "bg-slate-950 border-slate-700" : "bg-white border-slate-300"}`}>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="GCASH">GCash</option>
                <option value="CHECK">Check</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">
              <span className="flex items-center justify-between gap-3"><span>Reference number</span><span className={`text-xs font-normal ${isDark ? "text-slate-400" : "text-slate-500"}`}>Optional</span></span>
              <input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} maxLength={180} disabled={isSaving} className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm ${isDark ? "bg-slate-950 border-slate-700" : "bg-white border-slate-300"}`} placeholder="Receipt, transfer, or check number" />
            </label>
            <label className="block text-sm font-semibold">
              <span className="flex items-center justify-between gap-3"><span>Destination account</span><span className={`text-xs font-normal ${isDark ? "text-slate-400" : "text-slate-500"}`}>Optional</span></span>
              <input value={destinationCode} onChange={(event) => setDestinationCode(event.target.value)} maxLength={100} disabled={isSaving} className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm ${isDark ? "bg-slate-950 border-slate-700" : "bg-white border-slate-300"}`} placeholder="Bank or clearing account code" />
            </label>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Proof of payment</span>
                <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{method === "CASH" ? "Optional" : "Required"}</span>
              </div>
              <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm font-semibold transition-colors ${isDark ? "border-slate-600 bg-slate-950 hover:bg-slate-800" : "border-slate-300 bg-slate-50 hover:bg-slate-100"}`}>
                <FontAwesomeIcon icon={faPaperclip} /> Add proof of payment
                <input type="file" accept="application/pdf,image/jpeg,image/png" multiple className="sr-only" disabled={isSaving || proofFiles.length >= MAX_PAYMENT_PROOFS} onChange={handleProofSelection} />
              </label>
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>PDF, JPG or PNG, up to 15 MB each</p>
              {proofFiles.length > 0 && (
                <ul className="space-y-1">
                  {proofFiles.map((file, index) => (
                    <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                      <span className="min-w-0 truncate">{file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                      <button type="button" disabled={isSaving} onClick={() => setProofFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))} className="shrink-0 text-red-600 hover:text-red-500 disabled:opacity-50" aria-label={`Remove ${file.name}`}><FontAwesomeIcon icon={faTrash} /></button>
                    </li>
                  ))}
                </ul>
              )}
              {(validationError || statusError) && <p role="alert" className="text-sm font-medium text-red-600">{validationError || statusError}</p>}
            </div>
            <p className={`rounded-lg px-3 py-2.5 text-xs ${isDark ? "bg-slate-800/70 text-slate-300" : "bg-blue-50 text-slate-600"}`}>The payment is recorded in Atlas Transport and sent to Atlas Finance automatically.</p>
            <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
              <span className="text-sm font-semibold flex items-center gap-2"><FontAwesomeIcon icon={faBell} />Notify customer</span>
              <input type="checkbox" checked={sendNotification} onChange={(event) => setSendNotification(event.target.checked)} disabled={isSaving} className="h-4 w-4" />
            </label>
          </section>
        </div>

        <div className={`flex justify-end gap-2 border-t px-6 py-4 ${isDark ? "border-slate-800 bg-slate-950/30" : "border-slate-200 bg-slate-50/60"}`}>
          <button type="button" onClick={onCancel} disabled={isSaving} className={isDark ? "px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800" : "px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"}>Cancel</button>
          <button type="button" onClick={handleConfirm} disabled={isSaving} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50">{isSaving ? "Saving..." : "Mark as paid"}</button>
        </div>
      </div>
    </div>
  );
}
