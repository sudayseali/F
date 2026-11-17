// supabase/functions/_shared/alerts.ts
// Unified non-blocking Referral, Task & Offers Alert Dispatcher (In-App Inbox + Telegram Bot Push)

export type AlertCategory = "referral" | "task" | "offer" | "system";

export interface AlertPrefs {
  referral: boolean;
  task: boolean;
  offer: boolean;
  telegram_push: boolean;
}

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  referral: true,
  task: true,
  offer: true,
  telegram_push: true,
};

export interface SendAlertParams {
  userId: string;
  telegramId?: number | null;
  category: AlertCategory;
  eventKey: string;
  title: string;
  message: string;
  amount?: number | null;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  telegramPush?: boolean;
  telegramText?: string;
  ctaLabel?: string;
}

function getBotToken(): string {
  return (Deno.env.get("TELEGRAM_BOT_TOKEN") || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function getSafeWebAppUrl(): string {
  const raw = (Deno.env.get("FRONTEND_URL") || "https://payvora-tan.vercel.app/")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  return raw.startsWith("https://") ? raw : "https://payvora-tan.vercel.app/";
}

function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function normalizeAlertPrefs(raw: unknown): AlertPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ALERT_PREFS };
  const obj = raw as Record<string, unknown>;
  return {
    referral: obj.referral !== false,
    task: obj.task !== false,
    offer: obj.offer !== false,
    telegram_push: obj.telegram_push !== false,
  };
}

function isCategoryEnabled(prefs: AlertPrefs, category: AlertCategory): boolean {
  if (category === "referral") return prefs.referral;
  if (category === "task") return prefs.task;
  if (category === "offer") return prefs.offer;
  return true;
}

function buildTelegramWebAppUrl(actionUrl?: string): string {
  const base = getSafeWebAppUrl().replace(/\/$/, "");
  if (!actionUrl || typeof actionUrl !== "string") return `${base}/`;
  const trimmed = actionUrl.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return `${base}/`;
  return `${base}${trimmed}`;
}

function getCategoryBadge(category: AlertCategory): string {
  switch (category) {
    case "referral":
      return "🤝 <b>Payvora Referral Alert</b>";
    case "task":
      return "📌 <b>Payvora Task Alert</b>";
    case "offer":
      return "🎁 <b>Payvora Offer Alert</b>";
    default:
      return "💳 <b>Payvora Wallet & System Alert</b>";
  }
}

async function pushTelegramAlert(
  telegramId: number,
  htmlText: string,
  ctaLabel = "🚀 Open Payvora",
  actionUrl?: string
): Promise<boolean> {
  const botToken = getBotToken();
  if (!botToken || !telegramId || telegramId <= 0) return false;

  const appUrl = buildTelegramWebAppUrl(actionUrl);
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramId,
        text: htmlText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: ctaLabel,
                web_app: { url: appUrl },
              },
            ],
          ],
        },
      }),
      signal: AbortSignal.timeout(4000),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      console.warn(`[TELEGRAM_ALERT_FAILED] chat=${telegramId}:`, json?.description || res.status);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn("[TELEGRAM_ALERT_EXCEPTION]", err?.message || err);
    return false;
  }
}

/**
 * Sends a notification directly to the user's @PayvoraBot Telegram chat and logs it in user_notifications.
 * Completely non-throwing so financial/auth flows are never disrupted if alerts fail or migration is pending.
 */
export async function sendUserAlert(
  supabaseAdmin: any,
  params: SendAlertParams
): Promise<{ stored: boolean; telegramSent: boolean }> {
  try {
    let telegramId = params.telegramId ?? null;
    let prefs = { ...DEFAULT_ALERT_PREFS };

    // Resolve telegram_id and alert_prefs if not fully supplied
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("users")
      .select("telegram_id, alert_prefs")
      .eq("id", params.userId)
      .maybeSingle();

    if (!userErr && userRow) {
      telegramId = telegramId ?? userRow.telegram_id ?? null;
      prefs = normalizeAlertPrefs(userRow.alert_prefs);
    } else if (userErr) {
      // Fallback if alert_prefs column not migrated yet
      const { data: minUser } = await supabaseAdmin
        .from("users")
        .select("telegram_id")
        .eq("id", params.userId)
        .maybeSingle();
      if (minUser) telegramId = telegramId ?? minUser.telegram_id ?? null;
    }

    if (!isCategoryEnabled(prefs, params.category)) {
      return { stored: false, telegramSent: false };
    }

    const amountVal =
      typeof params.amount === "number" && isFinite(params.amount)
        ? Math.round(params.amount * 100) / 100
        : null;

    let notificationId: string | null = null;
    let stored = false;

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("user_notifications")
      .insert({
        user_id: params.userId,
        category: params.category,
        event_key: params.eventKey,
        title: params.title.slice(0, 140),
        message: params.message.slice(0, 500),
        amount: amountVal,
        action_url: params.actionUrl || null,
        metadata: params.metadata || {},
        telegram_sent: false,
      })
      .select("id")
      .single();

    if (!insertErr && inserted) {
      notificationId = inserted.id;
      stored = true;
    }

    let telegramSent = false;
    const shouldPushTelegram = params.telegramPush !== false && prefs.telegram_push;

    if (shouldPushTelegram && telegramId) {
      const amountLine =
        amountVal !== null && amountVal > 0 ? `\n💵 Amount: <b>+$${amountVal.toFixed(2)}</b>` : "";
      const defaultHtml = `${getCategoryBadge(params.category)}\n\n<b>${escapeHtml(params.title)}</b>\n${escapeHtml(params.message)}${amountLine}`;
      telegramSent = await pushTelegramAlert(
        telegramId,
        params.telegramText || defaultHtml,
        params.ctaLabel || "🚀 Open Payvora",
        params.actionUrl
      );

      if (telegramSent && notificationId) {
        await supabaseAdmin
          .from("user_notifications")
          .update({ telegram_sent: true })
          .eq("id", notificationId);
      }
    }

    return { stored, telegramSent };
  } catch (err: any) {
    console.warn("[SEND_USER_ALERT_WARN]", err?.message || err);
    return { stored: false, telegramSent: false };
  }
}

/**
 * Helper triggered after a user earns a reward from a task, survey, or offerwall.
 * Looks up their referrer (who already received 10% in atomic_wallet_credit) and dispatches a Referral Commission Alert.
 */
export async function notifyReferrerOfCommission(
  supabaseAdmin: any,
  referredUserId: string,
  baseRewardAmount: number,
  sourceLabel: string
): Promise<void> {
  try {
    const commission = Math.round(baseRewardAmount * 0.1 * 100) / 100;
    if (commission <= 0) return;

    const { data: refRow } = await supabaseAdmin
      .from("referrals")
      .select("referrer_id")
      .eq("referred_user_id", referredUserId)
      .maybeSingle();

    if (!refRow?.referrer_id) return;

    const { data: invitee } = await supabaseAdmin
      .from("users")
      .select("username, first_name")
      .eq("id", referredUserId)
      .maybeSingle();

    const inviteeName = invitee?.username
      ? `@${invitee.username}`
      : invitee?.first_name || "Your referral";

    await sendUserAlert(supabaseAdmin, {
      userId: refRow.referrer_id,
      category: "referral",
      eventKey: "referral_commission",
      title: "Referral Commission Earned!",
      message: `${inviteeName} completed ${sourceLabel} ($${baseRewardAmount.toFixed(2)}). Your 10% lifetime bonus (+$${commission.toFixed(2)}) has been credited.`,
      amount: commission,
      actionUrl: "/referrals",
      ctaLabel: "🤝 View Referrals",
      metadata: {
        referred_user_id: referredUserId,
        source: sourceLabel,
        base_reward: baseRewardAmount,
      },
    });
  } catch (err: any) {
    console.warn("[REFERRAL_COMMISSION_ALERT_WARN]", err?.message || err);
  }
}

/**
 * Broadcasts a New Task Drop alert directly to subscribers' @PayvoraBot chats.
 * Processes in rate-safe chunks without throwing.
 */
export async function broadcastNewTaskAlert(
  supabaseAdmin: any,
  task: { id: string; title: string; reward: number; category?: string }
): Promise<{ notified: number }> {
  try {
    const { data: recipients, error } = await supabaseAdmin
      .from("users")
      .select("id, telegram_id, alert_prefs")
      .eq("status", "active")
      .order("last_active_at", { ascending: false })
      .limit(150);

    if (error || !recipients || recipients.length === 0) {
      return { notified: 0 };
    }

    const eligible = recipients.filter((u: any) => normalizeAlertPrefs(u.alert_prefs).task);
    if (eligible.length === 0) return { notified: 0 };

    const rewardNum = Number(task.reward || 0);
    const title = `New Task: ${task.title}`;
    const message = `Earn +$${rewardNum.toFixed(2)} in the ${task.category || "Tasks"} category before available slots fill up.`;
    const actionUrl = `/tasks/${task.id}`;

    // Log notifications in DB
    const rows = eligible.map((u: any) => ({
      user_id: u.id,
      category: "task",
      event_key: "new_task_drop",
      title: title.slice(0, 140),
      message: message.slice(0, 500),
      amount: rewardNum > 0 ? rewardNum : null,
      action_url: actionUrl,
      metadata: { task_id: task.id, category: task.category || "Other" },
      telegram_sent: false,
    }));

    const { data: insertedRows } = await supabaseAdmin
      .from("user_notifications")
      .insert(rows)
      .select("id, user_id");

    const notifIdByUser = new Map<string, string>();
    for (const r of insertedRows || []) {
      notifIdByUser.set(r.user_id, r.id);
    }

    // Rate-safe Telegram DM push in chunks of 20
    const pushTargets = eligible.filter(
      (u: any) => u.telegram_id && normalizeAlertPrefs(u.alert_prefs).telegram_push
    );

    const htmlText = [
      "📌 <b>New High-Paying Task Live!</b>",
      "",
      `📝 <b>${escapeHtml(task.title)}</b>`,
      `💵 Reward: <b>+$${rewardNum.toFixed(2)}</b>`,
      `🏷 Category: ${escapeHtml(task.category || "General")}`,
      "",
      "⚡ Complete it now before slots run out!",
    ].join("\n");

    const deliveredNotifIds: string[] = [];
    for (let i = 0; i < pushTargets.length; i += 20) {
      const batch = pushTargets.slice(i, i + 20);
      await Promise.all(
        batch.map(async (u: any) => {
          const sent = await pushTelegramAlert(u.telegram_id, htmlText, "📌 Open Task", actionUrl);
          if (sent) {
            const nId = notifIdByUser.get(u.id);
            if (nId) deliveredNotifIds.push(nId);
          }
        })
      );
    }

    if (deliveredNotifIds.length > 0) {
      await supabaseAdmin
        .from("user_notifications")
        .update({ telegram_sent: true })
        .in("id", deliveredNotifIds);
    }

    return { notified: deliveredNotifIds.length || eligible.length };
  } catch (err: any) {
    console.warn("[BROADCAST_TASK_ALERT_WARN]", err?.message || err);
    return { notified: 0 };
  }
}
