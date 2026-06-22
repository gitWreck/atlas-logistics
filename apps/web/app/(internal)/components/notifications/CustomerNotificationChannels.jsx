"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faCheck,
  faCommentSms,
  faEnvelope,
} from "@fortawesome/free-solid-svg-icons";

export const DEFAULT_CUSTOMER_NOTIFICATION_CHANNELS = {
  sms: false,
  email: false,
  push: false,
};

/** Used when creating a new shipment — customer should get a receive confirmation. */
export const DEFAULT_SHIPMENT_CREATION_NOTIFICATION_CHANNELS = {
  sms: true,
  email: false,
  push: true,
};

export const CUSTOMER_NOTIFICATION_CHANNEL_OPTIONS = [
  {
    key: "sms",
    title: "SMS",
    description: "Send a text message to the customer's registered number.",
    icon: faCommentSms,
  },
  {
    key: "email",
    title: "Email",
    description: "Send an email update using the customer's email address.",
    icon: faEnvelope,
  },
  {
    key: "push",
    title: "Push notification",
    description: "Notify the customer's mobile app when push tokens exist.",
    icon: faBell,
  },
];

export default function CustomerNotificationChannels({
  value = DEFAULT_CUSTOMER_NOTIFICATION_CHANNELS,
  onChange,
  theme,
  disabled = false,
  channels = CUSTOMER_NOTIFICATION_CHANNEL_OPTIONS,
  columns = "grid-cols-3",
}) {
  const safeTheme = theme || {};
  const selected = {
    ...DEFAULT_CUSTOMER_NOTIFICATION_CHANNELS,
    ...(value || {}),
  };

  const updateChannel = (key, checked) => {
    onChange?.({
      ...selected,
      [key]: checked,
    });
  };

  return (
    <div className={`grid gap-2 sm:gap-3 ${columns}`}>
      {channels.map((channel) => {
        const checked = selected[channel.key] === true;
        const cardState = checked
          ? "border-emerald-500/70 bg-emerald-500/10 ring-1 ring-emerald-500/30 shadow-sm shadow-emerald-900/10"
          : safeTheme.panelSurface || "";
        const titleState = checked
          ? "text-emerald-600"
          : safeTheme.title || "";
        const helperState = checked
          ? "text-emerald-700/80"
          : safeTheme.helperText || "";

        return (
          <label
            key={channel.key}
            className={`min-w-0 flex items-center justify-center sm:justify-start gap-1.5 sm:gap-3 rounded-xl border px-2 py-3 sm:p-4 transition-colors ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            } ${cardState}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) => updateChannel(channel.key, e.target.checked)}
              className="sr-only"
            />

            <div className="min-w-0">
              <div
                className={`text-xs sm:text-sm font-semibold flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 ${
                  titleState
                }`}
              >
                <FontAwesomeIcon icon={channel.icon} className="shrink-0" />
                <span className="truncate">{channel.title}</span>
                {checked ? (
                  <FontAwesomeIcon icon={faCheck} className="shrink-0" />
                ) : null}
              </div>

              {channel.description ? (
                <p
                  className={`hidden sm:block text-xs mt-1 ${
                    helperState
                  }`}
                >
                  {channel.description}
                </p>
              ) : null}
            </div>
          </label>
        );
      })}
    </div>
  );
}
