import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../firebase";
import {
  endCurrentCallSession,
  ensureUserPublicId,
} from "../components/utilities/FirebaseFunctions";
import { getUsableCachedAuthProfile } from "../components/utilities/authPerformance";
import { getNavigationStorageKey } from "../components/utilities/navigationPersistence";

const ALLOWED_ROLES = [
  "checker",
  "driver",
  "customer",
  "admin",
  "manager",
  "administrator",
];
const STAFF_ROLES = ["admin", "manager", "administrator"];
const profileCacheKey = (uid) => `atlas_profile_${String(uid || "").trim()}`;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const authGenerationRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      const generation = ++authGenerationRef.current;
      const isCurrent = () =>
        !disposed && generation === authGenerationRef.current;

      setLoading(true);
      setUser(firebaseUser ?? null);
      setProfile(null);
      setRole(null);

      if (!firebaseUser) {
        setLoading(false);
        setIsReady(true);
        return;
      }

      // Restore the last server-validated profile immediately so startup and
      // navigation are not blocked by a slow Firestore round trip. The cache
      // is UID-bound and still applies the same active-role checks; the server
      // request below always runs and reconciles or revokes the cached state.
      let cachedProfile = null;
      try {
        const cached = await AsyncStorage.getItem(
          profileCacheKey(firebaseUser.uid),
        );
        cachedProfile = getUsableCachedAuthProfile(cached, {
          uid: firebaseUser.uid,
          allowedRoles: ALLOWED_ROLES,
        });
        if (cachedProfile && isCurrent()) {
          setRole(String(cachedProfile.role).toLowerCase());
          setProfile(cachedProfile);
          setUser(cachedProfile);
          setLoading(false);
          setIsReady(true);
        }
      } catch (cacheErr) {
        console.warn("AuthContext: profile cache read failed", cacheErr);
      }

      try {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!isCurrent()) return;

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const r = (userData.role ?? "").toString().toLowerCase();
          const fullProfile = {
            id: userDoc.id,
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            ...userData,
          };

          setRole(r);
          setProfile(fullProfile);
          setUser(fullProfile);
          void AsyncStorage.setItem(
            profileCacheKey(firebaseUser.uid),
            JSON.stringify(fullProfile),
          ).catch((cacheError) => {
            console.warn("AuthContext: profile cache write skipped", cacheError);
          });

          // Public-ID repair is not required to route an authenticated user.
          // Keep it out of the startup critical path.
          void ensureUserPublicId().catch((idError) => {
            console.warn("AuthContext: public ID sync skipped", idError);
          });
        } else {
          // Fallback if Auth exists but Firestore doc doesn't
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
          setProfile(null);
          setRole(null);
        }
      } catch (err) {
        if (!isCurrent()) return;
        console.error("AuthContext: fetch role error", err);
        if (!cachedProfile) {
          setProfile(null);
          setRole(null);
        }
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setIsReady(true);
        }
      }
    });

    return () => {
      disposed = true;
      authGenerationRef.current += 1;
      unsub();
    };
  }, []);

  const refreshUser = async () => {
    if (!auth.currentUser) return;
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const fullProfile = {
        id: userDoc.id,
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        ...userData,
      };

      setUser(fullProfile);
      setProfile(fullProfile);
      setRole((userData.role ?? "").toString().toLowerCase());
    }
  };

  const signOut = async () => {
    try {
      if (auth.currentUser) {
        const navigationStorageKey = getNavigationStorageKey(
          auth.currentUser.uid,
        );
        if (navigationStorageKey) {
          await AsyncStorage.removeItem(navigationStorageKey);
        }
        await endCurrentCallSession({ reason: "logout" }).catch((error) => {
          console.warn("AuthContext: active call cleanup skipped", error);
        });
      }
      await firebaseSignOut(auth);
    } catch (e) {
      console.error("AuthContext: signOut error", e);
    }
  };

  const isActive =
    profile?.active !== false &&
    String(profile?.status || "").toLowerCase() !== "inactive" &&
    String(profile?.employmentStatus || "").toLowerCase() !== "inactive";
  const isAllowedRole = isActive && ALLOWED_ROLES.includes(role);
  const isChecker = isActive && role === "checker";
  const isDriver = isActive && role === "driver";
  const isCustomer = isActive && role === "customer";
  const isManager = isActive && role === "manager";
  const isStaff = isActive && STAFF_ROLES.includes(role);
  /** Checker app access: field checkers plus admin/manager (all routes). */
  const isCheckerOps = isChecker || isStaff;

  const value = {
    user,
    profile,
    role,
    loading,
    isReady,
    isAllowedRole,
    isActive,
    isChecker,
    isDriver,
    isCustomer,
    isManager,
    isStaff,
    isCheckerOps,
    signOut,
    refreshUser,
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
