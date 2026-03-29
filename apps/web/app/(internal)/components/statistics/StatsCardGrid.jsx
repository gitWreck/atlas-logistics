import React from "react";
import StatsCard from "./StatsCard";

export default function StatsCardGrid({
  cards = [],
  loading = false,
  isDark = false,
  gridClassName = "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4",
}) {
  return (
    <div className={gridClassName}>
      {cards.map((card) => (
        <StatsCard
          key={card.title}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          variant={card.variant}
          loading={loading}
          isDark={isDark}
        />
      ))}
    </div>
  );
}
