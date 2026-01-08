export default function formatFirestoreDate(timestamp) {
  if (!timestamp?.seconds) return "";

  return new Date(timestamp.seconds * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
