import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const WEBAPP_URL = "https://your-mini-app-url.com"; // User will need to set this appropriately if they want a Play button. Or we can just send text.

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const update = await req.json();
    console.log("Received update:", JSON.stringify(update));

    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      if (text.startsWith("/start")) {
        const welcomeMessage = `
🌟 *Welcome to our Bot!* 🌟

A modern platform where you can complete various tasks and invite friends to earn extra income.

*What does this bot do?*
✅ Complete various Tasks to earn money.
✅ Create campaigns by offering reward money.
✅ Invite friends (Referrals) and earn 10% extra income.
✅ Easily withdraw your earnings.

👉 *Tap the button below to start and open the App!*
        `;

        const payload = {
          chat_id: chatId,
          text: welcomeMessage,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🚀 Start Now (Open App)",
                  web_app: {
                    url: Deno.env.get("FRONTEND_URL") || "https://payvora-tan.vercel.app/"
                  }
                }
              ],
              [
                {
                  text: "ℹ️ Help",
                  callback_data: "help"
                }
              ]
            ]
          }
        };

        if (BOT_TOKEN) {
             const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload)
            });
            const result = await res.json();
            console.log("Telegram API Start Response:", result);
        } else {
            console.error("TELEGRAM_BOT_TOKEN is not set in environment variables");
        }
      }
    } else if (update.callback_query) {
       const callbackQuery = update.callback_query;
       if (callbackQuery.data === "help") {
          const helpMessage = `
You need to open the Mini App to see the tasks available for you.
If you have any questions, please contact the administration.
          `;
          if (BOT_TOKEN) {
             const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ chat_id: callbackQuery.message.chat.id, text: helpMessage })
            });
            console.log("Telegram API Help Response:", await res.json());
          }
       }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
