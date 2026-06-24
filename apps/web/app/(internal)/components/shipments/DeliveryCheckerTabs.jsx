"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo, faUserCheck } from "@fortawesome/free-solid-svg-icons";
import { getDeliveryCheckerTabThemeClasses } from "@/app/utility/constant/theme";
import DeliveryCheckerProfile from "./DeliveryCheckerProfile";

export default function DeliveryCheckerTabs({
  tabs = [],
  activeTab,
  onChange,
  isDark = false,
  headerAction = null,
  checkerProfile = null,
  canEditCheckerAreas = false,
  onEditCheckerAreas,
  children = null,
}) {
  const theme = getDeliveryCheckerTabThemeClasses(isDark);

  return (
    <section
      className={`mt-4 max-w-full overflow-hidden rounded-lg border shadow-lg backdrop-blur-sm sm:mt-6 sm:rounded-xl ${theme.section}`}
    >
      <div
        className={`flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5 sm:py-5 ${theme.header}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2
              className={`text-xs font-bold uppercase tracking-wide sm:text-sm ${theme.title}`}
            >
              Delivery Operations
            </h2>
            <FontAwesomeIcon
              icon={faCircleInfo}
              className={`text-xs ${theme.infoIcon}`}
              title="Packages appear here only after a checker scans and loads them onto a delivery vehicle."
            />
          </div>
          <p className={`mt-1 max-w-2xl text-[11px] leading-relaxed sm:text-sm ${theme.subtitle}`}>
            Show only items scanned and loaded into delivery trucks by checkers.
          </p>
        </div>
        {headerAction ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {headerAction}
          </div>
        ) : null}
      </div>

      <div className={`border-b px-3 py-3 sm:px-5 sm:py-4 ${theme.filterBar}`}>
        <div className="mb-2 flex items-center justify-between gap-2 sm:mb-2.5">
          <div className="flex items-center gap-2">
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
          <p className={`text-[10px] sm:hidden ${theme.subtitle}`}>Swipe →</p>
        </div>

        <div
          className={`flex w-full min-w-0 touch-pan-x snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain rounded-lg p-1 [-webkit-overflow-scrolling:touch] scrollbar-none sm:snap-none sm:rounded-xl sm:p-1.5 [&::-webkit-scrollbar]:hidden ${theme.tabTrack}`}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onChange(tab.key)}
                aria-pressed={isActive}
                className={`flex min-h-11 min-w-[7.75rem] shrink-0 snap-start items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition-all duration-200 sm:min-h-11 sm:min-w-0 sm:flex-1 sm:gap-2 sm:rounded-xl sm:px-4 sm:text-sm ${
                  isActive ? theme.tabActive : theme.tabIdle
                }`}
              >
                <span className="max-w-[5.5rem] truncate sm:max-w-none">{tab.label}</span>
                {tab.count != null && (
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black sm:px-2 sm:text-[11px] ${
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

      <DeliveryCheckerProfile
        checker={checkerProfile}
        isDark={isDark}
        canEdit={canEditCheckerAreas}
        onEditAreas={onEditCheckerAreas}
      />

      {children ? <div className="px-3 py-3 sm:px-5 sm:py-5">{children}</div> : null}
    </section>
  );
}
