"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { getDeliveryCheckerTabThemeClasses } from "@/app/utility/constant/theme";

export default function DeliveryCheckerTabs({
  tabs = [],
  activeTab,
  onChange,
  isDark = false,
}) {
  const theme = getDeliveryCheckerTabThemeClasses(isDark);

  return (
    <section className={`mt-6 rounded-xl border px-4 py-4 sm:px-5 ${theme.section}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className={`text-sm font-bold uppercase tracking-wide ${theme.title}`}>
              Delivery Operations
            </h2>
            <FontAwesomeIcon
              icon={faCircleInfo}
              className={`text-xs ${theme.infoIcon}`}
              title="Packages appear here only after a checker scans and loads them onto a delivery vehicle."
            />
          </div>
          <p className={`mt-1 text-xs sm:text-sm ${theme.subtitle}`}>
            Show only items scanned and loaded into delivery trucks by checkers.
          </p>
        </div>
      </div>

      <div
        className="mt-4 flex w-full min-w-0 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              aria-pressed={isActive}
              className={`group relative flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-200 sm:min-h-11 sm:px-4 sm:text-sm ${
                isActive ? theme.tabActive : theme.tabIdle
              }`}
            >
              <span>{tab.label}</span>
              {tab.count != null && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black sm:text-[11px] ${
                    isActive ? theme.countActive : theme.countIdle
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {isActive && (
                <span
                  aria-hidden
                  className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full ${theme.activeUnderline}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
