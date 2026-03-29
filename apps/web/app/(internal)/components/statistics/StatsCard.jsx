import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getStatCardTheme } from "@/app/utility/constant/theme";

export default function StatsCard({
  title,
  value,
  subtitle,
  icon,
  variant = "indigo",
  loading = false,
  isDark = false,
}) {
  const theme = getStatCardTheme(isDark);
  const colors = theme[variant] || theme.indigo;

  return (
    <div
      className={`rounded-2xl border px-4 py-3 sm:px-4 sm:py-4 ${colors.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className={`text-xs font-medium uppercase tracking-wide ${colors.title}`}
          >
            {title}
          </div>

          <div className={`mt-2 text-2xl font-semibold ${colors.value}`}>
            {loading ? <span className="animate-pulse">...</span> : value}
          </div>

          {subtitle && (
            <div
              className={`mt-1 text-xs flex items-center gap-1.5 ${colors.subtitle}`}
            >
              {icon && <FontAwesomeIcon icon={icon} className="text-[10px]" />}
              <span>{subtitle}</span>
            </div>
          )}
        </div>

        {icon && (
          <div
            className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${colors.iconWrap}`}
          >
            <FontAwesomeIcon icon={icon} />
          </div>
        )}
      </div>
    </div>
  );
}
