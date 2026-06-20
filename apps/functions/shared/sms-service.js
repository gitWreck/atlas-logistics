"use strict";

const { defineSecret } = require("firebase-functions/params");
const {
  requireNormalizedPhone,
  toLocal,
} = require("../src/utilities/phoneHelpers");

const SEMAPHORE_API_KEY = defineSecret("SEMAPHORE_API_KEY");
const SEMAPHORE_SENDER_NAME = defineSecret("SEMAPHORE_SENDER_NAME");

function formatSemaphoreNumber(phone) {
  const normalized = requireNormalizedPhone(phone);
  if (normalized) return normalized;

  const local = toLocal(phone);
  if (local) return requireNormalizedPhone(local) || local;

  const digits = String(phone || "").replace(/[^\d]/g, "");
  if (digits.length === 11 && digits.startsWith("0")) {
    return `63${digits.slice(1)}`;
  }
  return digits;
}

function normalizeSemaphoreEntry(entry = {}) {
  const status = String(entry.status || entry.message_status || "unknown")
    .trim()
    .toLowerCase();

  return {
    messageId: entry.message_id || entry.messageId || null,
    status,
    recipient: entry.recipient || null,
    network: entry.network || null,
    senderName: entry.sender_name || entry.senderName || null,
    raw: entry,
  };
}

function assertSemaphoreAccepted(result) {
  if (result.status === "failed" || result.status === "refunded") {
    throw new Error(
      result.raw?.message ||
        result.raw?.error ||
        `Semaphore ${result.status}`,
    );
  }
}

async function sendViaSemaphore({ phone, message }) {
  const apiKey = SEMAPHORE_API_KEY.value();
  const sender = SEMAPHORE_SENDER_NAME.value();

  if (!apiKey) throw new Error("Semaphore API Key is missing.");

  const recipientNumber = formatSemaphoreNumber(phone);
  if (!recipientNumber) {
    throw new Error("Invalid PH phone number for Semaphore.");
  }

  const response = await fetch("https://api.semaphore.co/api/v4/messages", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      apikey: apiKey,
      number: recipientNumber,
      message: String(message || ""),
      ...(sender ? { sendername: sender } : {}),
    }),
  });

  const rawBody = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Semaphore ${response.status}: ${rawBody}`);
  }

  let data = null;
  try {
    data = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    data = null;
  }

  const entries = Array.isArray(data) ? data : data ? [data] : [];
  if (!entries.length) {
    throw new Error("Semaphore returned an empty response.");
  }

  const result = normalizeSemaphoreEntry(entries[0]);
  assertSemaphoreAccepted(result);
  return result;
}

module.exports = {
  sendSmsViaProvider: sendViaSemaphore,
  formatSemaphoreNumber,
  normalizeSemaphoreEntry,
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
};
