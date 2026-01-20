// Function to fetch history for a specific package
const fetchHistory = async (packageId) => {
  const snapshot = await db
    .collection("packages")
    .doc(packageId)
    .collection("history")
    .orderBy("timestamp", "desc") // Show newest first
    .get();

  return snapshot.docs.map((doc) => doc.data());
};
