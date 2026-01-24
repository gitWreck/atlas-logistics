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

export default function NotificationBell() {
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
          // const audio = new Audio('/sounds/alert.mp3');
          // audio.play().catch(e => console.log("Audio blocked"));
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
        className="relative p-2 text-slate-400 hover:text-white transition-colors"
      >
        <FontAwesomeIcon icon={faBell} size="lg" />
        {alerts.length > 0 && (
          <span className="absolute top-0 right-0 h-5 w-5 bg-red-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-slate-900 animate-pulse">
            {alerts.length > 9 ? "9+" : alerts.length}
          </span>
        )}
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Notifications
            </h3>
            <span className="text-xs text-blue-400 font-bold">
              {alerts.length} New
            </span>
          </div>

          {/* List */}
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No new alerts. All clear!
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 border-b border-slate-800 hover:bg-slate-800/50 transition-colors flex gap-3 group"
                >
                  {/* Icon */}
                  <div
                    className={`mt-1 ${alert.type === "DELAY_REPORT" ? "text-amber-500" : "text-blue-500"}`}
                  >
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-200 leading-tight mb-1">
                      {alert.message || "New System Alert"}
                    </p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {formatDistanceToNow(alert.createdAtDate, {
                          addSuffix: true,
                        })}
                      </span>

                      {/* Mark Read Button (Visible on Hover) */}
                      <button
                        onClick={(e) => markAsRead(e, alert.id)}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-green-400 px-2 py-1 rounded border border-slate-700 transition-all opacity-100 md:opacity-0 group-hover:opacity-100 flex items-center gap-1"
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
            <div className="p-2 bg-slate-950/50 border-t border-slate-800 text-center">
              <button className="text-xs text-slate-500 hover:text-white transition-colors">
                View All History
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
