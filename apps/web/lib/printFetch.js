import { auth } from "@/lib/firebase";

export async function fetchPrintApi(path) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Please sign in to view print documents.");
  }

  const token = await user.getIdToken();
  const response = await fetch(path, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Failed to load print data.");
  }

  return data;
}
