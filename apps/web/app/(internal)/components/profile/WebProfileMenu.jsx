"use client";

import { useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCamera,
  faRightFromBracket,
  faUser,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, functions, storage } from "@/lib/firebase";

function initials(name = "User") {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function ProfileAvatar({ profile, size = 40, gradientClass }) {
  const photoURL = String(profile?.photoURL || "").trim();
  if (photoURL) {
    return <img src={photoURL} alt={`${profile?.name || "User"} profile`} className="h-full w-full rounded-full object-cover" />;
  }
  return (
    <div className={`flex h-full w-full items-center justify-center rounded-full text-xs font-semibold text-white ${gradientClass}`}>
      {initials(profile?.name)}
    </div>
  );
}

export default function WebProfileMenu({
  user,
  profile,
  onProfileUpdated,
  onLogout,
  gradientClass = "bg-gradient-to-br from-sky-500 to-indigo-600",
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [photoOptionsOpen, setPhotoOptionsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const updateProfile = httpsCallable(functions, "updateUserProfileMobile");
  const closeMenu = () => setMenuOpen(false);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user?.uid || uploading) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Please choose an image file.");
      return;
    }

    setUploading(true);
    try {
      const avatarRef = ref(storage, `users/${user.uid}/profile/avatar.jpg`);
      await uploadBytes(avatarRef, file, { contentType: file.type || "image/jpeg" });
      const photoURL = await getDownloadURL(avatarRef);
      await updateProfile({ targetUid: user.uid, photoURL });
      await auth.currentUser?.reload();
      onProfileUpdated?.({ ...profile, photoURL });
    } catch (error) {
      console.error("Profile photo upload failed:", error);
      window.alert("Unable to upload your profile photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const warehouse = profile?.warehouseName || profile?.warehouseCode || profile?.branchName || profile?.branchCode || "Not assigned";

  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="flex items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label="Open profile menu"
      >
        <div className="text-right">
          <div className="text-xs font-medium">{profile?.name || "User"}</div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400">{profile?.role || "user"}</div>
        </div>
        <div className="h-9 w-9 overflow-hidden rounded-full"><ProfileAvatar profile={profile} gradientClass={gradientClass} /></div>
      </button>

      {menuOpen ? (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <button type="button" role="menuitem" onClick={() => { closeMenu(); setProfileOpen(true); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
            <FontAwesomeIcon icon={faUser} className="w-4" /> My Profile
          </button>
          <button type="button" role="menuitem" onClick={onLogout} className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
            <FontAwesomeIcon icon={faRightFromBracket} className="w-4" /> Logout
          </button>
        </div>
      ) : null}

      {profileOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="My Profile">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex justify-end"><button type="button" onClick={() => setProfileOpen(false)} aria-label="Close profile"><FontAwesomeIcon icon={faXmark} /></button></div>
            <div className="flex flex-col items-center text-center">
              <div className="h-24 w-24 overflow-hidden rounded-full"><ProfileAvatar profile={profile} gradientClass={gradientClass} /></div>
              <h2 className="mt-3 text-xl font-bold">{profile?.name || "User"}</h2>
              <p className="text-sm text-slate-500">{profile?.role || "User"}</p>
              <div className="relative mt-4">
                <button type="button" disabled={uploading} onClick={() => setPhotoOptionsOpen((open) => !open)} className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-60">
                  <FontAwesomeIcon icon={faCamera} className="mr-2" />{uploading ? "Uploading…" : "Change Profile Photo"}
                </button>
                {photoOptionsOpen ? (
                  <div className="absolute left-1/2 z-10 mt-2 w-52 -translate-x-1/2 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    <button type="button" onClick={() => { setPhotoOptionsOpen(false); fileInputRef.current?.click(); }} className="w-full px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700">Upload from Computer</button>
                    <button type="button" onClick={() => setPhotoOptionsOpen(false)} className="w-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
                  </div>
                ) : null}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
            <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-700">
              {[["Email", profile?.email || user?.email || "Not provided"], ["Phone Number", profile?.phoneNumber || "Not provided"], ["Role", profile?.role || "Not provided"], ["Warehouse / Branch", warehouse]].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 px-4 py-3"><dt className="text-slate-500">{label}</dt><dd className="text-right font-medium">{value}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}

    </div>
  );
}
