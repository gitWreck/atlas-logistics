const { defineSecret } = require("firebase-functions/params");

const SEMAPHORE_API_KEY = defineSecret("SEMAPHORE_API_KEY");
const SEMAPHORE_SENDER_NAME = defineSecret("SEMAPHORE_SENDER_NAME");

async function sendViaSemaphore({ phone, message, apiKey, sender }) {
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

module.exports = {
  sendViaSemaphore,
  SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME,
};
