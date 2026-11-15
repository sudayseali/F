// supabase/functions/_shared/channel-check.ts
// Server-side Telegram channel membership verification via getChatMember

export interface ChannelCheckResult {
  ok: boolean;
  isMember: boolean;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  channelUsername: string;
  channelUrl: string;
}

const DEFAULT_CHANNEL_ID = "@PayvoraCommunity";
const DEFAULT_CHANNEL_URL = "https://t.me/PayvoraCommunity";

const ALLOWED_MEMBER_STATUSES = new Set(["creator", "administrator", "member"]);

export function getRequiredChannelConfig() {
  const rawChannelId = (Deno.env.get("REQUIRED_CHANNEL_ID") || DEFAULT_CHANNEL_ID).trim();
  const channelUsername = rawChannelId.startsWith("@")
    ? rawChannelId
    : rawChannelId.startsWith("-100")
    ? "@PayvoraCommunity"
    : `@${rawChannelId}`;
  const channelUrl = (Deno.env.get("REQUIRED_CHANNEL_URL") || DEFAULT_CHANNEL_URL).trim();

  return {
    channelId: rawChannelId || DEFAULT_CHANNEL_ID,
    channelUsername,
    channelUrl,
  };
}

export async function checkTelegramChannelMembership(
  botToken: string,
  telegramUserId: number
): Promise<ChannelCheckResult> {
  const { channelId, channelUsername, channelUrl } = getRequiredChannelConfig();

  if (!botToken || !telegramUserId || telegramUserId <= 0) {
    return {
      ok: false,
      isMember: false,
      errorCode: "INVALID_PARAMS",
      errorMessage: "Missing bot token or valid Telegram user ID.",
      channelUsername,
      channelUrl,
    };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channelId,
        user_id: telegramUserId,
      }),
      signal: AbortSignal.timeout(5000),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      const description = String(data?.description || `HTTP ${res.status}`);
      const lower = description.toLowerCase();

      // Common Telegram error if bot is not yet added as admin in the channel
      if (
        lower.includes("member list is inaccessible") ||
        lower.includes("chat not found") ||
        lower.includes("bot is not a member") ||
        lower.includes("administrator")
      ) {
        console.error(`[CHANNEL_CHECK_MISCONFIG] Bot must be Admin in ${channelId}: ${description}`);
        return {
          ok: false,
          isMember: false,
          errorCode: "BOT_NOT_CHANNEL_ADMIN",
          errorMessage: `Channel verification unavailable: ensure the bot is an Admin in ${channelUsername}.`,
          channelUsername,
          channelUrl,
        };
      }

      // Telegram returns "user not found" when the user has never interacted/joined
      if (lower.includes("user not found")) {
        return {
          ok: true,
          isMember: false,
          status: "left",
          channelUsername,
          channelUrl,
        };
      }

      console.warn(`[CHANNEL_CHECK_API_ERROR] ${description}`);
      return {
        ok: false,
        isMember: false,
        errorCode: "TELEGRAM_API_ERROR",
        errorMessage: "Unable to verify channel membership right now. Please try again.",
        channelUsername,
        channelUrl,
      };
    }

    const member = data.result;
    const status = String(member?.status || "left").toLowerCase();
    const isMember =
      ALLOWED_MEMBER_STATUSES.has(status) ||
      (status === "restricted" && Boolean(member?.is_member));

    return {
      ok: true,
      isMember,
      status,
      channelUsername,
      channelUrl,
    };
  } catch (err: any) {
    console.error("[CHANNEL_CHECK_EXCEPTION]", err?.message || err);
    return {
      ok: false,
      isMember: false,
      errorCode: "NETWORK_ERROR",
      errorMessage: "Could not reach Telegram verification service. Please retry.",
      channelUsername,
      channelUrl,
    };
  }
}
