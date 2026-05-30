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
      className={`px-3 sm:px-6 py-3 sm:py-4 border-t flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 text-xs ${theme.footer}`}
    >
      <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
        <span
          className={`text-center sm:text-left text-[11px] sm:text-xs ${footerText}`}
        >
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

        <div className="flex w-full items-center gap-2 sm:hidden">
          {showLimitSelect && (
            <div className="relative min-w-0 flex-1">
              <FontAwesomeIcon
                icon={faListOl}
                className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${mutedIcon}`}
              />
              <select
                className={`h-10 w-full border rounded-lg pl-9 pr-4 py-2 text-xs focus:border-blue-500 focus:outline-none appearance-none cursor-pointer ${theme.input}`}
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

          <button
            type="button"
            onClick={onPrevious}
            disabled={safeCurrentPage === 1}
            className={`h-10 w-10 shrink-0 rounded-lg border text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
            aria-label="Previous page"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={safeCurrentPage === safeTotalPages}
            className={`h-10 w-10 shrink-0 rounded-lg border text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
            aria-label="Next page"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>

        {showLimitSelect && (
          <div className="relative hidden sm:block sm:w-32">
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

      <div className="hidden gap-2 sm:flex">
        <button
          type="button"
          onClick={onPrevious}
          disabled={safeCurrentPage === 1}
          className={`px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
          aria-label="Previous page"
        >
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={safeCurrentPage === safeTotalPages}
          className={`px-3 py-1.5 rounded-lg border text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all ${theme.paginationButton}`}
          aria-label="Next page"
        >
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>
    </div>
  );
}
