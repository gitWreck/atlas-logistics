"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faCommentSms,
  faEnvelope,
} from "@fortawesome/free-solid-svg-icons";

export const DEFAULT_CUSTOMER_NOTIFICATION_CHANNELS = {
  sms: true,
  email: true,
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

        return (
          <label
            key={channel.key}
            className={`min-w-0 flex items-center justify-center sm:justify-start gap-1.5 sm:gap-3 rounded-xl border px-2 py-3 sm:p-4 transition-colors ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            } ${safeTheme.panelSurface || ""}`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) => updateChannel(channel.key, e.target.checked)}
              className="h-4 w-4 shrink-0 sm:mt-1"
            />

            <div className="min-w-0">
              <div
                className={`text-xs sm:text-sm font-semibold flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 ${
                  safeTheme.title || ""
                }`}
              >
                <FontAwesomeIcon icon={channel.icon} className="shrink-0" />
                <span className="truncate">{channel.title}</span>
              </div>

              {channel.description ? (
                <p
                  className={`hidden sm:block text-xs mt-1 ${
                    safeTheme.helperText || ""
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
