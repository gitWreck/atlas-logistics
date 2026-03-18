// atlas/app/(checker)/profile.js
import React from "react";
import ProfileViewer from "../../components/profile/ProfileViewer";
import { useAuth } from "../../contexts/AuthContext"; // Assuming you have an AuthContext

export default function ProfileScreen() {
  const { user, updateUser } = useAuth();

  return <ProfileViewer user={user} onUpdate={updateUser} updating={false} />;
}
