const fetch = require("node-fetch");
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;

async function sendMessengerImage(psid, imageUrl, caption = "") {
  const payload = {
    recipient: { id: psid },
    message: {
      attachment: {
        type: "image",
        payload: { url: imageUrl, is_reusable: true }
      }
    }
  };

  // send image
  const r1 = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${FB_PAGE_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const j1 = await r1.json();
  if (j1.error) throw new Error(JSON.stringify(j1.error));

  // optional caption
  if (caption) {
    const r2 = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${FB_PAGE_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: psid },
        message: { text: caption }
      })
    });
    const j2 = await r2.json();
    if (j2.error) throw new Error(JSON.stringify(j2.error));
  }
}

module.exports = { sendMessengerImage };
