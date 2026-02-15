import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  faCheck,
  faXmark,
  faClock,
} from "@fortawesome/free-solid-svg-icons";
import { formatFirestoreDate } from "@/app/utility/utilities";
import StatusBadge from "../ui/StatusBadge";
import { resolveDelay } from "@/app/utility/FirebaseFunctions";

export default function DelayApprovalWidget() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null); // To show loading on button

  // 1. Listen for PENDING delay reports
  useEffect(() => {
    const q = query(
      collection(db, "admin_alerts"),
      where("type", "==", "DELAY_REPORT"),
      where("status", "==", "UNREAD"), // Or use a specific status like 'PENDING_APPROVAL'
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAtDate: doc.data().createdAt?.toDate() || new Date(),
      }));
      setRequests(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Handle Approval (Commit the delay to the Trip)
  const handleResolution = async (req, decision) => {
    try {
      setProcessingId(req.id); // Disable buttons while processing

      // const resolveDelay = httpsCallable(functions, "resolveDelayReport");

      await resolveDelay({
        alertId: req.id,
        decision: decision, // "APPROVED" or "REJECTED"
        managerNotes: "", // Add a prompt input if you want notes
      });

      // No need to manually update state, the snapshot listener will
      // see the status change to APPROVED/REJECTED and remove it from the list automatically.
    } catch (err) {
      console.error(`Error resolving delay (${decision}):`, err);
      alert(`Failed to ${decision.toLowerCase()} delay: ` + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading)
    return <div className="animate-pulse h-20 bg-slate-900 rounded-xl"></div>;
  if (requests.length === 0) return null; // Hide widget if no issues!

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl overflow-hidden mb-6 animate-in slide-in-from-top-4">
      <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex justify-between items-center">
        <h3 className="text-amber-400 font-bold text-sm uppercase flex items-center gap-2">
          <FontAwesomeIcon icon={faTriangleExclamation} />
          Pending Delay Approvals
        </h3>
        <span className="bg-amber-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">
          {requests.length} Request{requests.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="divide-y divide-amber-500/10">
        {requests.map((req) => (
          <div
            key={req.id}
            className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-amber-500/5 transition-colors"
          >
            {/* Info */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono font-bold text-white text-sm">
                  {req.tripId || "Unknown Trip"}
                </span>
                <span className="text-slate-500 text-xs">•</span>
                <span className="text-slate-400 text-xs font-bold">
                  {req.details.driverName || "Driver"}
                </span>
              </div>
              <div className="text-amber-200 text-sm font-medium">
                {req.details ? (
                  <div className="flex flex-col gap-1 items-start">
                    {/* 1. The Badge */}
                    <StatusBadge status="DELAYED" reason={req.details.reason} />

                    {/* 2. The Notes (Use span or div, NOT p) */}
                    <span className="text-xs text-amber-200/80 italic mt-1">
                      {req.details.notes || ""}
                    </span>
                  </div>
                ) : (
                  "Reporting a delay"
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                <FontAwesomeIcon icon={faClock} />
                Reported at {formatFirestoreDate(req.createdAt)}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => handleResolution(req, "REJECTED")}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-400 text-xs font-bold transition-colors"
              >
                <FontAwesomeIcon icon={faXmark} className="mr-1" /> Reject
              </button>
              <button
                onClick={() => handleResolution(req, "APPROVED")}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-900/20 transition-colors"
              >
                <FontAwesomeIcon icon={faCheck} className="mr-1" /> Approve
                Delay
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
