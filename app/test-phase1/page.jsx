"use client";
import { useState, useEffect } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function TestPhase1() {
  const [publicData, setPublicData] = useState(null);
  const [privateError, setPrivateError] = useState(null);
  const trackingId = "TEST-CARGO-001"; // We will create this manually in console

  useEffect(() => {
    // 1. Try to read PUBLIC data (Should Succeed)
    const unsub = onSnapshot(
      doc(db, "tracking_public", trackingId),
      (doc) => {
        console.log("Public Doc Snapshot:", doc.data());
        if (doc.exists()) {
          setPublicData(doc.data());
        } else {
          setPublicData("Waiting for projection...");
        }
      },
      (error) => {
        console.error("Public Read Error:", error);
      }
    );

    // 2. Try to read PRIVATE data (Should FAIL)
    async function tryCheating() {
      try {
        await getDoc(doc(db, "tracking_records", trackingId));
      } catch (err) {
        setPrivateError(err.message); // Expect: "Missing or insufficient permissions"
      }
    }
    tryCheating();

    return () => unsub();
  }, []);

  return (
    <div className="p-10 font-sans max-w-2xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold mb-6">Security Verification</h1>

      {/* PUBLIC TEST */}
      <div className="p-6 border rounded-xl shadow-sm bg-green-50 border-green-200">
        <h2 className="text-xl font-bold text-green-800 mb-2">
          ✅ Public Projection
        </h2>
        <p className="text-sm text-green-700 mb-4">
          Reading <code>tracking_public/{trackingId}</code>
        </p>
        <pre className="bg-white p-4 rounded text-xs overflow-auto">
          {publicData ? JSON.stringify(publicData, null, 2) : "Listening..."}
        </pre>
      </div>

      {/* PRIVATE TEST */}
      <div className="p-6 border rounded-xl shadow-sm bg-red-50 border-red-200">
        <h2 className="text-xl font-bold text-red-800 mb-2">
          🛡️ Security Firewall
        </h2>
        <p className="text-sm text-red-700 mb-4">
          Attempting illegal read of <code>tracking_records/{trackingId}</code>
        </p>

        {privateError ? (
          <div className="flex items-center gap-2 text-green-700 font-bold">
            <span>🔒 SUCCESS: Access Denied as expected.</span>
          </div>
        ) : (
          <span className="text-red-600 font-bold">
            ⚠️ DANGER: Access allowed! Rules are broken.
          </span>
        )}
        <p className="text-xs text-gray-500 mt-2">Error: {privateError}</p>
      </div>
    </div>
  );
}
