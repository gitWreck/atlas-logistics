import React from "react";
import StatsCardGrid from "../statistics/StatsCardGrid";

export default function Statistics({
  title = "Statistics",
  description = "Metrics based on updates since",
  rangeLabel = "Today",
  dateRange = "today",
  setDateRange,
  cards = [],
  loading = false,
  isDark = false,
  theme,
  gridClassName = "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4",
}) {
  return (
    <>
      <div
        className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl border ${theme.sectionCard}`}
      >
        <div>
          <h2 className={`text-lg font-bold ${theme.strongText}`}>{title}</h2>
          <p className={`text-xs ${theme.mutedText}`}>
            {description}{" "}
            <span className={theme.highlightText}>{rangeLabel}</span>
          </p>
        </div>

        <div
          className={`flex w-full sm:w-auto p-1 rounded-lg border ${theme.segmentedControl}`}
        >
          {["today", "7days", "30days"].map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDateRange(range)}
              className={`flex-1 sm:flex-none px-4 py-2 sm:py-1.5 text-xs font-bold uppercase rounded-md transition-all text-center ${
                dateRange === range
                  ? theme.segmentedControlActive
                  : theme.segmentedControlIdle
              }`}
            >
              {range === "today"
                ? "Today"
                : range === "7days"
                  ? "7 Days"
                  : "30 Days"}
            </button>
          ))}
        </div>
      </div>

      <StatsCardGrid
        cards={cards}
        loading={loading}
        isDark={isDark}
        gridClassName={gridClassName}
      />
    </>
  );
}
