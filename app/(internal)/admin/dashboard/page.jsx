"use client";
import React, { useState, useEffect } from "react"; // Added useEffect
import TripManager from "../../components/trips/TripManager";
import ShipmentBoard from "../../components/shipments/ShipmentBoard";
import AdminOverview from "../../components/admin/AdminOverview";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartPie,
  faTruck,
  faSignOutAlt,
  faMapSigns,
} from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  // ✅ STATE FOR USER INFO
  const [currentUser, setCurrentUser] = useState({
    name: "Loading...",
    email: "...",
    role: "admin",
  });

  // ✅ 1. LISTEN TO FIREBASE AUTH STATE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("User detected:", user.uid);

        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));

          if (userDoc.exists()) {
            const userData = userDoc.data();

            const sessionUser = {
              uid: user.uid,
              name: userData.name || userData.displayName || "Atlas User",
              email: user.email,
              role: userData.role?.toUpperCase(),
              photoURL: userData.photoURL || null,
            };

            setCurrentUser(sessionUser);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        console.log("No user found");
        setCurrentUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // ✅ 2. SIMPLIFIED LOGOUT
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      {/* --- ADMIN HEADER --- */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-6 pt-4 pb-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
                A
              </div>
              <div>
                <h1 className="font-bold text-white tracking-wide text-lg uppercase">
                  Admin Console
                </h1>
                <p className="text-xs text-slate-500">System Management</p>
              </div>
            </div>

            {/* ✅ DYNAMIC USER INFO */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-white">
                  {currentUser.name}
                </div>
                <div className="text-xs text-slate-500 uppercase">
                  {currentUser.role}
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-900/50 hover:border-red-800 transition-colors"
                title="Sign Out"
              >
                <FontAwesomeIcon icon={faSignOutAlt} />
              </button>
            </div>
          </div>

          {/* --- TABS --- */}
          <div className="flex gap-6">
            <TabButton
              isActive={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              icon={faChartPie}
              label="Overview & Users"
            />
            <TabButton
              isActive={activeTab === "shipments"}
              onClick={() => setActiveTab("shipments")}
              icon={faTruck}
              label="Shipment Operations"
            />
            <TabButton
              isActive={activeTab === "trips"}
              onClick={() => setActiveTab("trips")}
              icon={faMapSigns}
              label="Trip Operations"
            />
          </div>
        </div>
      </header>

      {/* --- CONTENT AREA --- */}
      <main className="max-w-7xl mx-auto p-6">
        {activeTab === "overview" && <AdminOverview />}
        {activeTab === "shipments" && <ShipmentBoard userRole="admin" />}
        {activeTab === "trips" && <TripManager />}
      </main>
    </div>
  );
}

function TabButton({ isActive, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`
        pb-3 flex items-center gap-2 text-sm font-medium border-b-2 transition-colors
        ${
          isActive
            ? "border-blue-500 text-blue-400"
            : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-800"
        }
      `}
    >
      <FontAwesomeIcon icon={icon} />
      {label}
    </button>
  );
}
