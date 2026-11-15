import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { constantTimeCompare } from "../_shared/telegram-verification.ts";
import { checkTelegramChannelMembership, getRequiredChannelConfig } from "../_shared/channel-check.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

async function callTelegramApi(method: string, body: Record<string, unknown>) {
  if (!BOT_TOKEN) return null;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

function buildWelcomeMessage(appUrl: string) {
  const welcomeMessage = `
🌟 *Welcome to Payvora!* 🌟

A modern platform where you can complete simple tasks, surveys, and offers to earn real rewards.

*What can you do?*
✅ Complete daily tasks & high-paying offerwalls.
✅ Claim +50 PTS Daily Check-In every 24 hours.
✅ Invite friends & earn 10% lifetime commission.
✅ Withdraw directly to USDT, TRX, or Payeer.

👉 *Tap the button below to launch the App!*
  `.trim();

  return {
    text: welcomeMessage,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🚀 Start Now (Open App)",
            web_app: { url: appUrl },
          },
        ],
        [
          {
            text: "📢 Official Channel",
            url: getRequiredChannelConfig().channelUrl,
          },
          {
            text: "ℹ️ Help",
            callback_data: "help",
          },
        ],
      ],
    },
  };
}

function buildJoinGateMessage(channelUsername: string, channelUrl: string) {
  return {
    text: `
🔒 *Join Required Before Starting*

Welcome to *Payvora*! To protect our community and receive updates, gift drops, and payout proofs, please join our official Telegram channel first:

📢 Channel: ${channelUsername}

1️⃣ Tap *Join Channel* below
2️⃣ Come back and tap *I Joined — Verify*
    `.trim(),
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: `📢 Join ${channelUsername}`,
            url: channelUrl,
          },
        ],
        [
          {
            text: "✅ I Joined — Verify",
            callback_data: "verify_channel_join",
          },
        ],
      ],
    },
  };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Fail-closed: Enforce Telegram Webhook secret token in constant time
  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("[TELEGRAM_WEBHOOK_MISCONFIG] TELEGRAM_WEBHOOK_SECRET is not set");
    return new Response("Server Misconfiguration", { status: 500 });
  }

  const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!incomingSecret || !constantTimeCompare(incomingSecret, webhookSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const update = await req.json();
    console.log("Received Telegram update:", update?.update_id ?? "unknown");

    const appUrl = Deno.env.get("FRONTEND_URL") || "https://payvora-tan.vercel.app/";

    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const fromUserId = update.message.from?.id;
      const text = update.message.text;

      if (text.startsWith("/start")) {
        if (!BOT_TOKEN) {
          console.error("TELEGRAM_BOT_TOKEN is not set in environment variables");
        } else if (fromUserId) {
          const membership = await checkTelegramChannelMembership(BOT_TOKEN, fromUserId);

          if (!membership.isMember) {
            await callTelegramApi("sendMessage", {
              chat_id: chatId,
              ...buildJoinGateMessage(membership.channelUsername, membership.channelUrl),
            });
          } else {
            await callTelegramApi("sendMessage", {
              chat_id: chatId,
              ...buildWelcomeMessage(appUrl),
            });
          }
        }
      }
    } else if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message?.chat?.id;
      const messageId = callbackQuery.message?.message_id;
      const fromUserId = callbackQuery.from?.id;

      if (callbackQuery.data === "verify_channel_join" && BOT_TOKEN && fromUserId) {
        const membership = await checkTelegramChannelMembership(BOT_TOKEN, fromUserId);

        if (membership.ok && membership.isMember) {
          await callTelegramApi("answerCallbackQuery", {
            callback_query_id: callbackQuery.id,
            text: "✅ Verified! Welcome to Payvora.",
            show_alert: false,
          });

          const welcomePayload = buildWelcomeMessage(appUrl);
          if (chatId && messageId) {
            await callTelegramApi("editMessageText", {
              chat_id: chatId,
              message_id: messageId,
              ...welcomePayload,
            });
          } else if (chatId) {
            await callTelegramApi("sendMessage", {
              chat_id: chatId,
              ...welcomePayload,
            });
          }
        } else {
          const alertText = membership.errorMessage
            ? membership.errorMessage
            : `You have not joined ${membership.channelUsername} yet. Please join first, then tap Verify.`;
          await callTelegramApi("answerCallbackQuery", {
            callback_query_id: callbackQuery.id,
            text: alertText.slice(0, 190),
            show_alert: true,
          });
        }
      } else if (callbackQuery.data === "help") {
        await callTelegramApi("answerCallbackQuery", {
          callback_query_id: callbackQuery.id,
        });
        const helpMessage =
          "Open the Payvora Mini App using the Start Now button to view tasks, offerwalls, and your wallet. For help, reach out via Payvora Support.";
        if (BOT_TOKEN && chatId) {
          await callTelegramApi("sendMessage", {
            chat_id: chatId,
            text: helpMessage,
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error processing request:", error?.message || error);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), { status: 500 });
  }
});
