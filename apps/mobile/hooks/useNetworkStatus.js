import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected);
      const reachable =
        state.isInternetReachable === null
          ? connected
          : Boolean(state.isInternetReachable);
      setIsOnline(connected && reachable);
      setIsInternetReachable(reachable);
    });

    NetInfo.fetch().then((state) => {
      const connected = Boolean(state.isConnected);
      const reachable =
        state.isInternetReachable === null
          ? connected
          : Boolean(state.isInternetReachable);
      setIsOnline(connected && reachable);
      setIsInternetReachable(reachable);
    });

    return () => unsub();
  }, []);

  return { isOnline, isInternetReachable };
}
