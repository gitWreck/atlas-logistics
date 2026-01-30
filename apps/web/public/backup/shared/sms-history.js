import { db } from "../firebase.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";

/**
 * Load recent SMS history for a tracking ID
 */
export async function loadSMSHistory(trackingId, max = 5) {
  if (!trackingId) return [];

  try {
    const q = query(
      collection(db, "sms_logs"),
      where("trackingId", "==", trackingId),
      orderBy("at", "desc"),
      limit(max),
    );

    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        at: data.at || null, // normalize timestamp
      };
    });
  } catch (err) {
    console.warn("loadSMSHistory failed:", err);
    return []; // 🔒 NEVER break UI
  }
}
