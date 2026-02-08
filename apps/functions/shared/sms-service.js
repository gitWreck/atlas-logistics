"use strict";

const { defineSecret } = require("firebase-functions/params");

// Define secrets here so they are available to the service
const SEMAPHORE_API_KEY = defineSecret("SEMAPHORE_API_KEY");
const SEMAPHORE_SENDER_NAME = defineSecret("SEMAPHORE_SENDER_NAME");

// YOUR FUNCTION (Slightly updated to use the secrets automatically)
async function sendViaSemaphore({ phone, message }) {
  // 1. Get values from the secrets defined above
  const apiKey = SEMAPHORE_API_KEY.value();
  const sender = SEMAPHORE_SENDER_NAME.value();

  if (!apiKey) throw new Error("Semaphore API Key is missing.");

  // 2. Your existing fetch logic
  const res = await fetch("https://api.semaphore.co/api/v4/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: apiKey,
      number: phone,
      message,
      sendername: sender || undefined,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Semaphore ${res.status}: ${txt}`);
  }

  return await res.json().catch(() => ({}));
}

// 3. Export them correctly
module.exports = {
  sendSmsViaProvider: sendViaSemaphore, // Aliased for clarity
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
};
