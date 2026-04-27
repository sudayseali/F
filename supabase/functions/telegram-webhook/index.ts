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
🌟 *Ku soo dhawow Bot-keena!* 🌟

Waa madal casri ah oo aad uga shaqaysan karto hawlo kala duwan, saaxiibadaana aad ugu marti qaadi karto si aad u hesho dakhli dheeraad ah.

*Muxuu bot-kani qabtaa?*
✅ Qabo hawlo (Tasks) kala duwan si aad u hesho lacag.
✅ Samee ololeyaal (Campaigns) adigoo lacag abaalmarin ah bixinaya.
✅ Soo xarow saaxiibadaa (Referrals) oo hel 10% dhaqaale dheeraad ah.
✅ Dakhligaaga si fudud ula bax (Withdraw).

👉 *Taabo badhanka hoose si aad u bilowdo oo aad App-ka u gasho!*
        `;

        const payload = {
          chat_id: chatId,
          text: welcomeMessage,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🚀 Bilow Hadda (Open App)",
                  web_app: {
                    url: Deno.env.get("FRONTEND_URL") || "https://sudayse.vercel.app/"
                  }
                }
              ],
              [
                {
                  text: "ℹ️ Caawinaad / Help",
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
Waxaad u baahan tahay inaad gasho Mini App-ka si aad u aragto hawlaha kugu habboon.
Haddii aad qabto su'aal la xiriir maamulka.
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
