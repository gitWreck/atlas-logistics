import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

import { db, auth } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext.js";
import { useTheme } from "../../contexts/ThemeContext";
import { COLORS, GLOBAL_STYLES } from "../constants/theme";

import TripCard from "./TripCard.js";
import TripFilterModal from "./TripFilterModal";
import {
  CHECKER_TAB_OPTIONS,
  CHECKER_VISIBLE_STATUSES,
  DRIVER_TAB_OPTIONS,
  DRIVER_VISIBLE_STATUSES,
} from "../constants/templates.js";

export default function TripScreen() {
  const { colors, resolvedScheme } = useTheme();
  const { role, isChecker, isDriver } = useAuth();
  const router = useRouter();
  const uid = auth.currentUser?.uid;

  //   const [userName, setUserName] = useState(isChecker ? "Checker" : "Driver");
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState("ALL");

  const [activeTab, setActiveTab] = useState("ALL");

  useEffect(() => {
    let unsubscribe = null;

    const setup = async () => {
      try {
        // if (uid) {
        //   const userRef = doc(db, "users", uid);
        //   const userSnap = await getDoc(userRef);

        //   if (userSnap.exists()) {
        //     const userData = userSnap.data();
        //     setUserName(
        //       userData?.name ||
        //         userData?.fullName ||
        //         auth.currentUser?.displayName ||
        //         (isChecker ? "Checker" : "Driver"),
        //     );
        //   } else if (auth.currentUser?.displayName) {
        //     setUserName(auth.currentUser.displayName);
        //   }
        // }

        const statuses = isChecker
          ? CHECKER_VISIBLE_STATUSES
          : DRIVER_VISIBLE_STATUSES;

        // const tripsQuery = query(
        //   collection(db, "truck_trips"),
        //   isChecker ? where("tripType" === "DEL") : "",
        //   where("status", "in", statuses),
        //   orderBy("updatedAt", "desc"),
        // );

        const constraints = [
          where("status", "in", statuses),
          orderBy("updatedAt", "desc"),
        ];

        if (isChecker) {
          constraints.unshift(where("tripType", "==", "DELIVERY"));
        }

        if (isDriver) {
          constraints.unshift(where("tripType", "==", "HUB_TRANSFER"));
        }

        const tripsQuery = query(collection(db, "truck_trips"), ...constraints);

        unsubscribe = onSnapshot(
          tripsQuery,
          (snapshot) => {
            const mappedTrips = snapshot.docs.map((tripDoc) => {
              const data = tripDoc.data();

              return {
                id: tripDoc.id,
                ...data,
                plate: data.truckPlateNumber || data.plate || "No Plate",
                route: data.route || "No Route",
                status: data.status || "UNKNOWN",
                loaded: data.totalLoaded || 0,
                total: data.totalItems || 0,
              };
            });

            setTrips(mappedTrips);
            setLoading(false);
          },
          (error) => {
            console.error("Error fetching trips:", error);
            setLoading(false);
          },
        );
      } catch (error) {
        console.error("Error setting up trips screen:", error);
        setLoading(false);
      }
    };

    setup();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [uid, isChecker, isDriver]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const filteredTrips = useMemo(() => {
    let filtered = [...trips];

    if (isDriver) {
      filtered = filtered.filter((trip) => trip.driverId === uid);

      if (activeTab === "Upcoming") {
        filtered = filtered.filter(
          (trip) => trip.status === "CREATED" || trip.status === "ASSIGNED",
        );
      }

      if (activeTab === "Active") {
        filtered = filtered.filter(
          (trip) =>
            trip.status === "LOADED" ||
            trip.status === "IN_TRANSIT" ||
            trip.status === "ARRIVED",
        );
      }

      if (
        activeTab !== "ALL" &&
        activeTab !== "Upcoming" &&
        activeTab !== "Active"
      ) {
        filtered = filtered.filter((trip) => trip.status === activeTab);
      }
    }

    if (isChecker) {
      if (activeTab !== "ALL") {
        filtered = filtered.filter((trip) => trip.status === activeTab);
      }
    }

    if (activeStatusFilter !== "ALL") {
      filtered = filtered.filter((trip) => trip.status === activeStatusFilter);
    }

    if (searchText.trim()) {
      const term = searchText.toLowerCase().trim();

      filtered = filtered.filter((trip) => {
        return (
          (trip.id || "").toLowerCase().includes(term) ||
          (trip.plate || "").toLowerCase().includes(term) ||
          (trip.route || "").toLowerCase().includes(term) ||
          (trip.destination || "").toLowerCase().includes(term) ||
          (trip.driverName || "").toLowerCase().includes(term)
        );
      });
    }

    return filtered;
  }, [
    trips,
    uid,
    isChecker,
    isDriver,
    activeTab,
    activeStatusFilter,
    searchText,
  ]);

  const handleTripPress = (trip) => {
    if (isChecker) {
      router.push({
        pathname: "/(checker)/trip-details",
        params: {
          tripId: trip.id,
          plate: trip.plate,
        },
      });
      return;
    }

    router.push({
      pathname: "/(driver)/trip-details",
      params: {
        tripId: trip.id,
      },
    });
  };

  const renderTabs = () => {
    const tabs = isChecker ? CHECKER_TAB_OPTIONS : DRIVER_TAB_OPTIONS;
    const activeChipColors =
      resolvedScheme === "dark"
        ? { bg: "#0284c7", border: "#0284c7", text: "#ffffff" }
        : { bg: "#0f172a", border: "#0f172a", text: "#ffffff" };

    return (
      <View style={styles.tabsContainer}>
        <FlatList
          data={tabs}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.tabsContent}
          renderItem={({ item }) => {
            const isActive = activeTab === item.key;
            return (
              <TouchableOpacity
                style={[
                  styles.tabChip,
                  isActive
                    ? {
                        backgroundColor: activeChipColors.bg,
                        borderColor: activeChipColors.border,
                      }
                    : {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                ]}
                onPress={() => setActiveTab(item.key)}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    {
                      color: isActive
                        ? activeChipColors.text
                        : colors.textMuted,
                      fontWeight: isActive ? "700" : "600",
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  };

  const renderItem = ({ item }) => {
    return <TripCard trip={item} onPress={handleTripPress} />;
  };

  const emptyText = searchText
    ? "No trips match your search."
    : isChecker
      ? "No active loads found."
      : activeTab === "COMPLETED"
        ? "No completed trips."
      : activeTab === "Upcoming"
        ? "No upcoming trips."
      : activeTab === "ALL"
        ? "No trips found."
        : "No active trips.";

  if (loading) {
    return (
      <View style={[GLOBAL_STYLES.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={COLORS.primary || "#042C83"} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar
        style={resolvedScheme === "dark" ? "light" : "dark"}
        backgroundColor={colors.bg}
      />

      {/* {renderHeader()} */}
      {renderTabs()}

      <View style={[styles.searchRow, { backgroundColor: colors.bg }]}>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <FontAwesome5 name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={
              isChecker
                ? "Search plate, route, driver..."
                : "Search trips, route..."
            }
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <FontAwesome5
                name="times-circle"
                size={16}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
            activeStatusFilter !== "ALL" && styles.filterBtnActive,
          ]}
          onPress={() => setFilterModalVisible(true)}
        >
          <FontAwesome5
            name="sliders-h"
            size={16}
            color={activeStatusFilter !== "ALL" ? "#0284c7" : colors.text}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={11}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary || "#042C83"}
            colors={[COLORS.primary || "#042C83"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5
              name={isChecker ? "truck-loading" : "clipboard-list"}
              size={40}
              color={colors.textMuted}
              style={{ marginBottom: 12 }}
            />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {emptyText}
            </Text>
          </View>
        }
      />

      <TripFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        activeFilter={activeStatusFilter}
        onApplyFilter={setActiveStatusFilter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },

  tabsContainer: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: "600",
  },

  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 12,
    backgroundColor: "#f1f5f9",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: {
    flex: 1,
    color: "#0f172a",
    marginLeft: 10,
    fontSize: 15,
  },
  filterBtn: {
    width: 48,
    height: 48,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActive: {
    backgroundColor: "#e0f2fe",
    borderColor: "#38bdf8",
  },

  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 50,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 50,
  },
  emptyText: {
    color: "#64748b",
  },
});
