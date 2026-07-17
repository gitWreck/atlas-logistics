import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import {
  shipmentCounts,
  statusKey,
  tripDateKey,
  tripPriority,
} from "../components/driver/driverData";

export default function useDriverOperations(selectedDateKey) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [trips, setTrips] = useState([]);
  const [shipmentsByTrip, setShipmentsByTrip] = useState({});
  const [tripsLoading, setTripsLoading] = useState(true);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setTrips([]);
      setTripsLoading(false);
      return undefined;
    }

    setTripsLoading(true);
    const tripsQuery = query(
      collection(db, "truck_trips"),
      where("driverId", "==", uid),
    );
    return onSnapshot(
      tripsQuery,
      (snapshot) => {
        setTrips(snapshot.docs.map((trip) => ({ id: trip.id, ...trip.data() })));
        setTripsLoading(false);
        setError(null);
      },
      (nextError) => {
        console.error("Driver trips subscription failed:", nextError);
        setError(nextError);
        setTripsLoading(false);
      },
    );
  }, [uid]);

  const dateTrips = useMemo(
    () => trips
      .filter((trip) => tripDateKey(trip) === selectedDateKey)
      .sort((a, b) => tripPriority(a) - tripPriority(b)),
    [selectedDateKey, trips],
  );

  useEffect(() => {
    setShipmentsByTrip({});
    if (!dateTrips.length) {
      setShipmentsLoading(false);
      return undefined;
    }

    setShipmentsLoading(true);
    const state = {};
    const loaded = new Set();
    const unsubscribers = dateTrips.map((trip) => onSnapshot(
      collection(db, "truck_trips", trip.id, "trip_shipments"),
      (snapshot) => {
        state[trip.id] = snapshot.docs.map((item) => ({ id: item.id, tripId: trip.id, ...item.data() }));
        loaded.add(trip.id);
        setShipmentsByTrip({ ...state });
        if (loaded.size === dateTrips.length) setShipmentsLoading(false);
      },
      (nextError) => {
        console.error(`Driver trip shipments subscription failed (${trip.id}):`, nextError);
        state[trip.id] = [];
        loaded.add(trip.id);
        setShipmentsByTrip({ ...state });
        setError(nextError);
        if (loaded.size === dateTrips.length) setShipmentsLoading(false);
      },
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [dateTrips]);

  const shipments = useMemo(
    () => dateTrips.flatMap((trip) => shipmentsByTrip[trip.id] || []),
    [dateTrips, shipmentsByTrip],
  );
  const primaryTrip = dateTrips[0] || null;
  const primaryShipments = primaryTrip ? shipmentsByTrip[primaryTrip.id] || [] : [];
  const latestAssignedTrip = useMemo(() => [...trips].sort((a, b) => {
    const activeDifference = tripPriority(a) - tripPriority(b);
    if (activeDifference !== 0) return activeDifference;
    const left = a.updatedAt?.toMillis?.() || 0;
    const right = b.updatedAt?.toMillis?.() || 0;
    return right - left;
  })[0] || null, [trips]);
  const activeTrip = useMemo(() => dateTrips.find((trip) =>
    ["ASSIGNED", "LOADED", "IN_TRANSIT", "ARRIVED"].includes(statusKey(trip.status)),
  ) || primaryTrip, [dateTrips, primaryTrip]);

  return {
    trips,
    dateTrips,
    shipments,
    shipmentsByTrip,
    primaryTrip,
    primaryShipments,
    activeTrip,
    latestAssignedTrip,
    stats: shipmentCounts(shipments),
    loading: tripsLoading || shipmentsLoading,
    error,
  };
}
