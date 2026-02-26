import { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faTriangleExclamation,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import { formatDistanceToNow } from "date-fns"; // Recommended for "5 mins ago"
import StatusBadge from "../ui/StatusBadge";

export default function NotificationBell({ isDark = false }) {
  const [alerts, setAlerts] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 1. Listen for Real-time Alerts
  useEffect(() => {
    const q = query(
      collection(db, "admin_alerts"),
      where("status", "==", "UNREAD"),
      orderBy("createdAt", "desc"), // Ensure newest are first (Requires Index)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newAlerts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Safe date conversion
        createdAtDate: doc.data().createdAt?.toDate() || new Date(),
      }));
      setAlerts(newAlerts);

      // Play sound only if a NEW alert appeared
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const audio = new Audio("/sounds/alert1.mp3");
          audio.play().catch((e) => console.log("Audio blocked"));
        }
      });
    });

    return () => unsubscribe();
  }, []);

  // 2. Handle Click Outside to Close
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  // 3. Mark Single Alert as Read
  const markAsRead = async (e, id) => {
    e.stopPropagation(); // Prevent dropdown from closing immediately
    try {
      await updateDoc(doc(db, "admin_alerts", id), {
        status: "READ",
        readAt: new Date(),
      });
      // UI updates automatically via snapshot listener!
    } catch (err) {
      console.error("Error updating alert:", err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* BELL ICON BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 transition-colors ${
          isDark
            ? "text-slate-400 hover:text-white"
            : "text-slate-500 hover:text-slate-900"
        }`}
      >
        <FontAwesomeIcon icon={faBell} size="lg" />
        {alerts.length > 0 && (
          <span
            className={`absolute top-0 right-0 h-5 w-5 bg-red-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 ${
              isDark ? "border-slate-900" : "border-white"
            } animate-pulse`}
          >
            {alerts.length > 9 ? "9+" : alerts.length}
          </span>
        )}
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-80 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 border ${
            isDark
              ? "bg-slate-900 border-slate-700"
              : "bg-white border-slate-200"
          }`}
        >
          {/* Header */}
          <div
            className={`p-3 border-b flex justify-between items-center ${
              isDark
                ? "bg-slate-950 border-slate-800"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <h3
              className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}
            >
              Notifications
            </h3>
            <span
              className={`text-xs font-bold ${
                isDark ? "text-blue-400" : "text-blue-600"
              }`}
            >
              {alerts.length} New
            </span>
          </div>

          {/* List */}
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            {alerts.length === 0 ? (
              <div
                className={`p-8 text-center text-sm ${
                  isDark ? "text-slate-500" : "text-slate-500"
                }`}
              >
                No new alerts. All clear!
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 border-b transition-colors flex gap-3 group ${
                    isDark
                      ? "border-slate-800 hover:bg-slate-800/50"
                      : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`mt-1 ${
                      alert.type === "DELAY_REPORT"
                        ? "text-amber-500"
                        : "text-blue-500"
                    }`}
                  >
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <p
                      className={`flex items-center flex-wrap text-sm font-bold leading-tight mb-1 gap-1.5 ${
                        isDark ? "text-slate-200" : "text-slate-900"
                      }`}
                    >
                      {/* Construct message since 'message' field is missing in data */}
                      {alert.details?.driverName
                        ? `${alert.details.driverName}: `
                        : `${alert.tripId || "Unknown Trip"} `}

                      {/* Badge aligns nicely beside text */}
                      {alert.details?.reason ? (
                        <StatusBadge
                          status="delayed"
                          reason={alert.details.reason}
                        />
                      ) : (
                        "New System Alert"
                      )}
                    </p>
                    <div className="flex justify-between items-center mt-2">
                      <span
                        className={`text-[10px] font-mono ${
                          isDark ? "text-slate-500" : "text-slate-500"
                        }`}
                      >
                        {/* ✅ FIX: Safe check for toDate() in case data is incomplete */}
                        {alert.createdAt?.toDate
                          ? formatDistanceToNow(alert.createdAt.toDate(), {
                              addSuffix: true,
                            })
                          : "Just now"}
                      </span>

                      {/* Mark Read Button (Visible on Hover) */}
                      <button
                        onClick={(e) => markAsRead(e, alert.id)}
                        className={`text-[10px] px-2 py-1 rounded border transition-all opacity-100 md:opacity-0 group-hover:opacity-100 flex items-center gap-1 ${
                          isDark
                            ? "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-green-400 border-slate-700"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-emerald-600 border-slate-200"
                        }`}
                      >
                        <FontAwesomeIcon icon={faCheck} /> Mark Read
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div
              className={`p-2 border-t text-center ${
                isDark
                  ? "bg-slate-950/50 border-slate-800"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <button
                className={`text-xs transition-colors ${
                  isDark
                    ? "text-slate-500 hover:text-white"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                View All History
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
