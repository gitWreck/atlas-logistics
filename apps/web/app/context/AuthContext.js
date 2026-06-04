"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        if (typeof window !== "undefined") {
          window.__atlasGetIdToken = null;
        }
        return;
      }

      // 1. Get the fresh ID token result to check current claims
      let tokenResult = await firebaseUser.getIdTokenResult();

      try {
        // 2. Fetch User Profile from Firestore
        const docRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(docRef);
        const userProfile = snap.exists() ? snap.data() : null;

        setProfile(userProfile);

        // 3. SYNC LOGIC: If Firestore says "admin" but Token says "no admin"...
        if (userProfile?.role === "admin" && !tokenResult.claims.admin) {
          console.log("User is admin in DB but missing claim. Syncing...");

          // Call our Next.js API Route
          const token = await firebaseUser.getIdToken();
          await fetch("/api/auth/sync-claims", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });

          // 4. Force Token Refresh to pick up the new claim immediately
          // 'true' forces a refresh from the server
          tokenResult = await firebaseUser.getIdTokenResult(true);
          console.log("Claims synced. Admin access granted.");
        }
      } catch (err) {
        console.error("Failed to load user profile or sync claims", err);
        setProfile(null);
      }

      // 5. Attach the claims to the user object for easy access in your app
      firebaseUser.customClaims = tokenResult.claims;
      setUser(firebaseUser);
      setLoading(false);

      if (typeof window !== "undefined") {
        window.__atlasGetIdToken = () => firebaseUser.getIdToken();
      }
    });

    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
