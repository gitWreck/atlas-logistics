import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

export default function PackageTable({ packages = [], itemsPerPage = 5 }) {
  const [currentPage, setCurrentPage] = useState(1);

  if (!packages || packages.length === 0) {
    return <Text style={styles.emptyText}>No package details available.</Text>;
  }

  // Pagination Logic
  const totalPages = Math.ceil(packages.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentPackages = packages.slice(startIndex, startIndex + itemsPerPage);

  const handleNext = () =>
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  const handlePrev = () => setCurrentPage((prev) => Math.max(1, prev - 1));

  return (
    <View style={styles.container}>
      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.headerText, styles.colId]}>#</Text>
        <Text style={[styles.headerText, styles.colDesc]}>Item</Text>
        <Text style={[styles.headerText, styles.colSpecs]}>Specs</Text>
        <Text
          style={[styles.headerText, styles.colTags, { textAlign: "center" }]}
        >
          Tags
        </Text>
      </View>

      {/* Table Body */}
      {currentPackages.map((pkg, index) => {
        const actualIndex = startIndex + index + 1;
        return (
          <View key={actualIndex} style={styles.tableRow}>
            <Text style={[styles.rowText, styles.colId, styles.boldText]}>
              {actualIndex}
            </Text>
            <Text style={[styles.rowText, styles.colDesc]} numberOfLines={2}>
              {pkg.description || "Package Item"}
            </Text>
            <Text style={[styles.rowText, styles.colSpecs]} numberOfLines={2}>
              {pkg.dimensions || "Standard"}
            </Text>

            {/* Tags Column */}
            <View style={[styles.colTags, styles.tagsContainer]}>
              {pkg.isFragile && (
                <View
                  style={[
                    styles.tag,
                    { backgroundColor: "rgba(239, 68, 68, 0.15)" },
                  ]}
                >
                  <FontAwesome5 name="wine-glass" size={10} color="#ef4444" />
                </View>
              )}
              {pkg.isPerishable && (
                <View
                  style={[
                    styles.tag,
                    { backgroundColor: "rgba(59, 130, 246, 0.15)" },
                  ]}
                >
                  <FontAwesome5 name="snowflake" size={10} color="#3b82f6" />
                </View>
              )}
              {!pkg.isFragile && !pkg.isPerishable && (
                <Text style={styles.noTagsText}>—</Text>
              )}
            </View>
          </View>
        );
      })}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[
              styles.pageBtn,
              currentPage === 1 && styles.pageBtnDisabled,
            ]}
            onPress={handlePrev}
            disabled={currentPage === 1}
          >
            <FontAwesome5
              name="chevron-left"
              size={12}
              color={currentPage === 1 ? "#94a3b8" : "#0f172a"}
            />
          </TouchableOpacity>

          <Text style={styles.pageText}>
            Page {currentPage} of {totalPages}
          </Text>

          <TouchableOpacity
            style={[
              styles.pageBtn,
              currentPage === totalPages && styles.pageBtnDisabled,
            ]}
            onPress={handleNext}
            disabled={currentPage === totalPages}
          >
            <FontAwesome5
              name="chevron-right"
              size={12}
              color={currentPage === totalPages ? "#94a3b8" : "#0f172a"}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: { color: "#64748b", fontStyle: "italic", marginTop: 10 },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    marginTop: 8,
    // --- ADDED SHADOW STYLES ---
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerText: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  rowText: { fontSize: 13, color: "#334155" },
  boldText: { fontWeight: "700", color: "#0f172a" },

  // Column Widths
  colId: { flex: 0.15 },
  colDesc: { flex: 0.45, paddingRight: 8 },
  colSpecs: { flex: 0.25, paddingRight: 8 },
  colTags: { flex: 0.15, alignItems: "center" },

  // Tags
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "center",
  },
  tag: { padding: 5, borderRadius: 6 },
  noTagsText: { color: "#cbd5e1", fontSize: 12 },

  // Pagination
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f8fafc",
  },
  pageBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pageBtnDisabled: { backgroundColor: "#f1f5f9", borderColor: "#f1f5f9" },
  pageText: { fontSize: 13, color: "#64748b", fontWeight: "500" },
});
