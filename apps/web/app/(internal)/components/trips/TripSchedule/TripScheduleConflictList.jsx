"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import { getOverviewThemeClasses } from "@/app/utility/constant/theme";
import { formatFirestoreDate } from "@/app/utility/utilities";
import {
  getTripEta,
  getTripDeparture,
  getTripRoute,
} from "@/app/utility/tripScheduleHelpers";

export default function TripScheduleConflictList({
  conflicts = [],
  isDark = false,
}) {
  const theme = getOverviewThemeClasses(isDark);

  return (
    <div className={`rounded-2xl border p-4 ${theme.sectionCard}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className={`font-bold ${theme.strongText}`}>Conflict Watch</h3>
          <p className={`text-xs mt-1 ${theme.mutedText}`}>
            Trips that overlap on the same truck
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {conflicts.length > 0 ? (
          conflicts.slice(0, 5).map((item, index) => (
            <div
              key={`${item.truckId}-${index}`}
              className={`rounded-2xl p-3 ${theme.overviewWarningBadge}`}
            >
              <div className="flex items-start gap-2">
                <FontAwesomeIcon
                  icon={faTriangleExclamation}
                  className="mt-0.5"
                />

                <div className="min-w-0">
                  <div className="text-sm font-bold">
                    {item.truckLabel || "Truck"}
                  </div>

                  <div className="text-xs mt-1 opacity-90">
                    {getTripRoute(item.currentTrip)}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] mt-2 opacity-90 flex-wrap">
                    <span>
                      {formatFirestoreDate(getTripEta(item.currentTrip))}
                    </span>
                    <FontAwesomeIcon icon={faArrowRight} />
                    <span>
                      {formatFirestoreDate(getTripDeparture(item.nextTrip))}
                    </span>
                  </div>

                  <div className="text-[11px] mt-2 opacity-90">
                    Next trip departs before previous ETA.
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div
            className={`rounded-2xl border p-4 text-sm ${theme.overviewSubPanel} ${theme.mutedText}`}
          >
            No truck schedule conflicts found.
          </div>
        )}
      </div>
    </div>
  );
}
