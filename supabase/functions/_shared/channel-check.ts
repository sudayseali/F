// supabase/functions/_shared/channel-check.ts
// Server-side Telegram channel/group membership verification via getChatMember

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

/**
 * Normalizes a Telegram chat identifier from `@username`, `-100...` numeric chat ID,
 * `https://t.me/username` URL, or bare username into a valid Bot API `chat_id` string.
 * Rejects private invite links (`t.me/+...` / `t.me/joinchat/...`) because Bot API
 * `getChatMember` requires a numeric `-100...` ID or `@publicusername`.
 */
export function normalizeTelegramChatId(raw: string | null | undefined): string | null {
  const val = String(raw || "").trim();
  if (!val) return null;

  // Numeric channel/supergroup/group ID (e.g. -1001234567890 or -987654321)
  if (/^-100\d{5,}$/.test(val) || /^-\d{5,}$/.test(val)) {
    return val;
  }

  // @username
  if (/^@[A-Za-z][A-Za-z0-9_]{3,63}$/.test(val)) {
    return val;
  }

  // https://t.me/username or t.me/username
  if (/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\//i.test(val)) {
    try {
      const withProto = /^https?:\/\//i.test(val) ? val : `https://${val}`;
      const u = new URL(withProto);
      const seg = u.pathname.replace(/^\/+/, "").split("/")[0] || "";
      if (
        seg &&
        !seg.startsWith("+") &&
        seg.toLowerCase() !== "joinchat" &&
        /^[A-Za-z][A-Za-z0-9_]{3,63}$/.test(seg)
      ) {
        return `@${seg}`;
      }
      return null;
    } catch {
      return null;
    }
  }

  // Bare username
  if (/^[A-Za-z][A-Za-z0-9_]{3,63}$/.test(val)) {
    return `@${val}`;
  }

  return null;
}

function readEnvVar(name: string): string | undefined {
  if (typeof Deno !== "undefined" && Deno?.env?.get) {
    return Deno.env.get(name);
  }
  if (typeof process !== "undefined" && process?.env) {
    return process.env[name];
  }
  return undefined;
}

export function getRequiredChannelConfig(
  overrideChatId?: string | null,
  overrideChannelUrl?: string | null
) {
  const rawOverride = normalizeTelegramChatId(overrideChatId);
  const rawEnvChannelId = (readEnvVar("REQUIRED_CHANNEL_ID") || DEFAULT_CHANNEL_ID).trim();
  const channelId = rawOverride || rawEnvChannelId || DEFAULT_CHANNEL_ID;

  const channelUsername = channelId.startsWith("@")
    ? channelId
    : channelId.startsWith("-")
    ? (overrideChatId ? "the target Telegram channel" : "@PayvoraCommunity")
    : `@${channelId}`;

  const derivedUrl = channelId.startsWith("@")
    ? `https://t.me/${channelId.slice(1)}`
    : DEFAULT_CHANNEL_URL;

  const channelUrl = overrideChannelUrl?.trim()
    ? overrideChannelUrl.trim()
    : rawOverride
    ? derivedUrl
    : (readEnvVar("REQUIRED_CHANNEL_URL") || DEFAULT_CHANNEL_URL).trim();

  return {
    channelId,
    channelUsername,
    channelUrl,
  };
}

export async function checkTelegramChannelMembership(
  botToken: string,
  telegramUserId: number,
  targetChatId?: string | null,
  targetChannelUrl?: string | null
): Promise<ChannelCheckResult> {
  const { channelId, channelUsername, channelUrl } = getRequiredChannelConfig(
    targetChatId,
    targetChannelUrl
  );

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

      // Common Telegram error if bot is not yet added as admin in the channel/group
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
          errorMessage: `Verification unavailable: ensure the Payvora bot is an Admin in ${channelUsername}.`,
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
