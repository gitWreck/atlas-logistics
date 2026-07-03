import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import {
  customerOwnsShipment,
  mapShipmentDoc,
  sortShipments,
} from "../utilities/customerShipmentAccess";

export default function useCustomerDashboardData() {
  const router = useRouter();
  const { profile } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [userData, setUserData] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [userName, setUserName] = useState("Customer");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const name = (data.name || "").trim();
          setUserData({ id: snap.id, ...data });
          setUserName(name || auth.currentUser?.displayName || "Customer");
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !profile?.uid) return undefined;

    const customer = {
      uid: user.uid,
      email: user.email || profile.email,
      phoneNumber: profile.phoneNumber,
      phone: profile.phone,
      publicId: profile.publicId,
      userCode: profile.userCode,
      customerCode: profile.customerCode,
    };

    const shipmentQueries = [
      query(collection(db, "shipments"), where("sender.uid", "==", user.uid)),
      query(
        collection(db, "shipments"),
        where("recipient.uid", "==", user.uid),
      ),
      query(collection(db, "shipments"), where("customerId", "==", user.uid)),
      query(
        collection(db, "shipments"),
        where("visibilityUserIds", "array-contains", user.uid),
      ),
    ];

    const snapshotsByQuery = {};

    const mergeAndSetShipments = () => {
      const shipmentMap = new Map();

      Object.values(snapshotsByQuery).forEach((snapshot) => {
        snapshot.docs.forEach((docSnap) => {
          const item = mapShipmentDoc(docSnap);
          if (customerOwnsShipment(item, customer)) {
            shipmentMap.set(docSnap.id, item);
          }
        });
      });

      setShipments(sortShipments([...shipmentMap.values()]));
    };

    const unsubscribers = shipmentQueries.map((q, index) =>
      onSnapshot(
        q,
        (snapshot) => {
          snapshotsByQuery[index] = snapshot;
          mergeAndSetShipments();
        },
        (error) => console.error("Shipment subscription error:", error),
      ),
    );

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [profile?.uid, profile?.phoneNumber, profile?.email]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return undefined;

    const q = query(
      collection(db, "users", user.uid, "notifications"),
      where("read", "==", false),
    );

    return onSnapshot(
      q,
      (snapshot) => setUnreadNotifications(snapshot.size),
      (error) =>
        console.error("Unread notifications subscription error:", error),
    );
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return undefined;

    const q = query(
      collection(db, "conversations"),
      where("customerId", "==", user.uid),
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const total = snapshot.docs.reduce((sum, docSnap) => {
          const data = docSnap.data() || {};
          return sum + Number(data.unreadCounts?.[user.uid] || 0);
        }, 0);
        setUnreadMessages(total);
      },
      (error) => console.error("Unread messages subscription error:", error),
    );
  }, []);

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          signOut(auth);
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const handleShipmentPress = (item) => {
    router.push({
      pathname: "/(customer)/tracking/",
      params: { trackingId: item.trackingNumber || item.id },
    });
  };

  return {
    shipments,
    userData,
    userName,
    unreadNotifications,
    unreadMessages,
    handleLogout,
    handleShipmentPress,
  };
}
