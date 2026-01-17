import { signOut } from "firebase/auth";

export const handleLogout = async (auth, router) => {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn("Logout error (likely emulator stale token):", error);
  } finally {
    localStorage.removeItem("atlas_user"); // optional
    router.push("/login");
  }
};
