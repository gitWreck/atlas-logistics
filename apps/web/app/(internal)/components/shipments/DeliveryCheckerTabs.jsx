"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo, faUserCheck } from "@fortawesome/free-solid-svg-icons";
import { getDeliveryCheckerTabThemeClasses } from "@/app/utility/constant/theme";

export default function DeliveryCheckerTabs({
  tabs = [],
  activeTab,
  onChange,
  isDark = false,
  headerAction = null,
  children = null,
}) {
  const theme = getDeliveryCheckerTabThemeClasses(isDark);

  return (
    <section
      className={`mt-6 overflow-hidden rounded-xl border shadow-lg backdrop-blur-sm ${theme.section}`}
    >
      <div
        className={`flex flex-col gap-4 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-5 ${theme.header}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2
              className={`text-sm font-bold uppercase tracking-wide ${theme.title}`}
            >
              Delivery Operations
            </h2>
            <FontAwesomeIcon
              icon={faCircleInfo}
              className={`text-xs ${theme.infoIcon}`}
              title="Packages appear here only after a checker scans and loads them onto a delivery vehicle."
            />
          </div>
          <p className={`mt-1 max-w-2xl text-xs sm:text-sm ${theme.subtitle}`}>
            Show only items scanned and loaded into delivery trucks by checkers.
          </p>
        </div>
        {headerAction ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {headerAction}
          </div>
        ) : null}
      </div>

      <div className={`border-b px-4 py-3 sm:px-5 sm:py-4 ${theme.filterBar}`}>
        <div className="mb-2.5 flex items-center gap-2">
          <FontAwesomeIcon
            icon={faUserCheck}
            className={`text-[11px] ${theme.filterLabel}`}
          />
          <p
            className={`text-[10px] font-bold uppercase tracking-wider ${theme.filterLabel}`}
          >
            Filter by checker
          </p>
        </div>

        <div
          className={`flex w-full min-w-0 touch-pan-x gap-1.5 overflow-x-auto overscroll-x-contain rounded-xl p-1.5 [-webkit-overflow-scrolling:touch] scrollbar-none [&::-webkit-scrollbar]:hidden ${theme.tabTrack}`}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onChange(tab.key)}
                aria-pressed={isActive}
                className={`flex min-h-10 min-w-[8.5rem] shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 sm:min-h-11 sm:min-w-0 sm:flex-1 sm:rounded-xl sm:px-4 sm:text-sm ${
                  isActive ? theme.tabActive : theme.tabIdle
                }`}
              >
                <span className="truncate">{tab.label}</span>
                {tab.count != null && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black sm:text-[11px] ${
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

      {children ? <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div> : null}
    </section>
  );
}
