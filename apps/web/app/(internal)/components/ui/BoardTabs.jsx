"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getBoardTabThemeClasses } from "@/app/utility/constant/theme";

export default function BoardTabs({
  tabs = [],
  activeTab,
  onChange,
  isDark = false,
  className = "",
}) {
  const theme = getBoardTabThemeClasses(isDark);

  return (
    <div
      className={`w-full min-w-0 max-w-[calc(100vw-2rem)] overflow-hidden sm:max-w-full ${className}`}
    >
      <div
        className={`px-2 flex w-full min-w-0 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain py-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:rounded-xl sm:p-1.5 ${theme.list}`}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`group flex min-h-10 min-w-[9.5rem] shrink-0 items-center justify-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition-all duration-200 sm:min-h-12 sm:min-w-max sm:flex-1 sm:gap-2.5 sm:rounded-xl sm:px-3 sm:py-2.5 ${
                isActive ? theme.tabActive : theme.tabIdle
              }`}
              aria-pressed={isActive}
            >
              {tab.icon && (
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] transition-colors ${
                    isActive ? theme.iconActive : theme.iconIdle
                  }`}
                >
                  <FontAwesomeIcon icon={tab.icon} />
                </span>
              )}
              <span>{tab.label}</span>
              {tab.count != null && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    isActive ? theme.countActive : theme.countIdle
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
