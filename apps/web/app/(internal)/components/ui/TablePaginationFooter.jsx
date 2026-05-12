"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faListOl,
} from "@fortawesome/free-solid-svg-icons";

const LIMIT_OPTIONS = ["50", "100", "200", "all"];

export default function TablePaginationFooter({
  totalItems,
  currentPage,
  itemsPerPage,
  totalPages,
  limitValue,
  limitTitle,
  onLimitChange,
  onPrevious,
  onNext,
  theme,
}) {
  const safeTotalPages = Math.max(totalPages, 1);
  const safeCurrentPage = Math.min(
    Math.max(currentPage, 1),
    safeTotalPages,
  );
  const firstItem = (safeCurrentPage - 1) * itemsPerPage + 1;
  const lastItem = Math.min(safeCurrentPage * itemsPerPage, totalItems);
  const footerText = theme.footerText || theme.tableText || "";
  const footerStrong = theme.footerStrong || theme.footerBold || "";
  const mutedIcon = theme.iconMuted || theme.inputIcon || "";
  const showLimitSelect = Boolean(limitValue && onLimitChange);

  return (
    <div
      className={`px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row justify-between items-center gap-3 text-xs ${theme.footer}`}
    >
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <span className={footerText}>
          Showing{" "}
          <span className={`font-bold ${footerStrong}`}>
            {firstItem}
          </span>{" "}
          to{" "}
          <span className={`font-bold ${footerStrong}`}>
            {lastItem}
          </span>{" "}
          of {totalItems}
        </span>

        {showLimitSelect && (
          <div className="relative w-32">
            <FontAwesomeIcon
              icon={faListOl}
              className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${mutedIcon}`}
            />
            <select
              className={`w-full border rounded-lg pl-9 pr-4 py-1.5 text-xs focus:border-blue-500 focus:outline-none appearance-none cursor-pointer ${theme.input}`}
              value={limitValue}
              onChange={(event) => onLimitChange?.(event.target.value)}
              title={limitTitle}
            >
              {LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All items" : `${option} items`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={safeCurrentPage === 1}
          className={`px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
        >
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={safeCurrentPage === safeTotalPages}
          className={`px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
        >
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>
    </div>
  );
}
