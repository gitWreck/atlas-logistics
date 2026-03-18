import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";

const ALLOWED_ROLES = ["checker", "driver", "customer"];

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setUser(firebaseUser ?? null);
      setRole(null);

      if (!firebaseUser) {
        setLoading(false);
        setIsReady(true);
        return;
      }

      try {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        const r = userDoc.exists()
          ? (userDoc.data().role ?? "").toString().toLowerCase()
          : null;
        setRole(r);
      } catch (err) {
        console.error("AuthContext: fetch role error", err);
        setRole(null);
      } finally {
        setLoading(false);
        setIsReady(true);
      }
    });

    return () => unsub();
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.error("AuthContext: signOut error", e);
    }
  };

  const isAllowedRole = ALLOWED_ROLES.includes(role);
  const isChecker = role === "checker";
  const isDriver = role === "driver";
  const isCustomer = role === "customer";

  const value = {
    user,
    role,
    loading,
    isReady,
    isAllowedRole,
    isChecker,
    isDriver,
    isCustomer,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
