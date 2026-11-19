// supabase/functions/submit_task/index.ts
// Secure user task submission endpoint with JWT authentication, quota check,
// distributed rate limiting, manual screenshot proof flow, AND instant Telegram
// channel/group auto-verification (`auto_telegram_join`) via Bot getChatMember.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { verifyUserRequest } from "../_shared/auth.ts";
import { checkDistributedRateLimit, getClientIp } from "../_shared/rate-limit.ts";
import { sanitizeString, isValidUuid } from "../_shared/validation.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";
import { sendUserAlert, notifyReferrerOfCommission } from "../_shared/alerts.ts";
import { enforceVpnPolicy } from "../_shared/vpn-check.ts";
import { checkTelegramChannelMembership, normalizeTelegramChatId } from "../_shared/channel-check.ts";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) {
    throw new AppError("Server configuration missing database credentials", 500, "CONFIG_ERROR");
  }
  return createClient(url, key);
}

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const clientIp = getClientIp(req);

  try {
    if (req.method !== "POST") {
      throw new AppError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Distributed Rate Limiting: 10 task submissions per minute per IP
    const ipRate = await checkDistributedRateLimit(supabaseAdmin, `task_sub_ip_${clientIp}`, 10, 60);
    if (!ipRate.allowed) {
      throw new AppError("Too many task submissions. Please wait a moment.", 429, "RATE_LIMIT_EXCEEDED");
    }

    // 1. Verify User Authentication exclusively via JWT
    const verifiedUser = await verifyUserRequest(req);
    const userId = verifiedUser.id;

    const userRate = await checkDistributedRateLimit(supabaseAdmin, `task_sub_usr_${userId}`, 6, 60);
    if (!userRate.allowed) {
      throw new AppError("Please wait a moment before submitting another task.", 429, "RATE_LIMIT_EXCEEDED");
    }

    await enforceVpnPolicy(supabaseAdmin, req, clientIp, "submit_task", userId);

    const body = await req.json().catch(() => ({}));
    const { task_id, proof_text, proof_data, proof, proof_url, telegram_username } = body;

    // 2. Validate Task ID
    if (!task_id || !isValidUuid(task_id)) {
      throw new AppError("A valid task ID is required.", 400, "INVALID_TASK_ID");
    }

    // 3. Look up Task & Verification Mode (with safe fallback if migration is pending)
    let taskMeta: any = null;
    const taskQuery = await supabaseAdmin
      .from("tasks")
      .select("id, title, reward, status, verification_type, verification_chat_id, target_url")
      .eq("id", task_id)
      .maybeSingle();

    if (taskQuery.error) {
      const msg = String(taskQuery.error.message || "").toLowerCase();
      if ((taskQuery.error as any).code === "42703" || msg.includes("verification_type")) {
        const legacyTaskQuery = await supabaseAdmin
          .from("tasks")
          .select("id, title, reward, status, target_url")
          .eq("id", task_id)
          .maybeSingle();
        if (legacyTaskQuery.error) throw legacyTaskQuery.error;
        taskMeta = legacyTaskQuery.data ? { ...legacyTaskQuery.data, verification_type: "manual_screenshot" } : null;
      } else {
        throw taskQuery.error;
      }
    } else {
      taskMeta = taskQuery.data;
    }

    if (!taskMeta) {
      throw new AppError("Task not found.", 404, "TASK_NOT_FOUND");
    }

    if (taskMeta.status !== "active") {
      throw new AppError("This task is currently paused or completed.", 400, "TASK_NOT_ACTIVE");
    }

    const verificationType = taskMeta.verification_type === "auto_telegram_join"
      ? "auto_telegram_join"
      : "manual_screenshot";

    // ========================================================================
    // BRANCH A: INSTANT BOT AUTO-VERIFICATION (`auto_telegram_join`)
    // ========================================================================
    if (verificationType === "auto_telegram_join") {
      const telegramUserId = Number(verifiedUser.telegramId || 0);
      if (!telegramUserId || telegramUserId <= 0) {
        throw new AppError("A verified Telegram account is required to claim this task.", 400, "MISSING_TELEGRAM_ID");
      }

      const targetChatId = normalizeTelegramChatId(taskMeta.verification_chat_id || taskMeta.target_url);
      if (!targetChatId) {
        throw new AppError(
          "This auto-verify task is missing a valid Telegram channel/group identifier.",
          400,
          "TASK_MISCONFIGURED"
        );
      }

      // Fast pre-check so duplicate clicks never spam Telegram Bot API
      const { data: existingSub } = await supabaseAdmin
        .from("submissions")
        .select("id, status")
        .eq("task_id", task_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingSub) {
        throw new AppError(
          `You have already completed or submitted this task (Status: ${existingSub.status}).`,
          400,
          "DUPLICATE_SUBMISSION"
        );
      }

      const botToken = (Deno.env.get("TELEGRAM_BOT_TOKEN") || "").trim();
      if (!botToken) {
        throw new AppError("Server configuration missing TELEGRAM_BOT_TOKEN.", 500, "CONFIG_ERROR");
      }

      const check = await checkTelegramChannelMembership(
        botToken,
        telegramUserId,
        targetChatId,
        taskMeta.target_url
      );

      if (!check.ok) {
        throw new AppError(
          check.errorMessage || "Unable to verify Telegram membership right now. Please try again.",
          check.errorCode === "BOT_NOT_CHANNEL_ADMIN" ? 503 : 502,
          check.errorCode || "TELEGRAM_VERIFY_ERROR"
        );
      }

      if (!check.isMember) {
        throw new AppError(
          `You are not a member of ${check.channelUsername} yet. Please join first, then tap Verify & Claim.`,
          400,
          "NOT_CHANNEL_MEMBER"
        );
      }

      const { data: autoRes, error: autoErr } = await supabaseAdmin.rpc(
        "complete_auto_telegram_task_atomic",
        {
          p_user_id: userId,
          p_task_id: task_id,
          p_chat_id: targetChatId,
          p_member_status: check.status || "member",
        }
      );

      if (autoErr) throw autoErr;
      if (!autoRes?.success) {
        const errCode = autoRes?.code || "AUTO_VERIFY_FAILED";
        const statusCode =
          errCode === "TASK_NOT_FOUND" ? 404 : errCode === "ACCOUNT_SUSPENDED" ? 403 : 400;
        throw new AppError(autoRes?.error || "Failed to credit auto-verified task.", statusCode, errCode);
      }

      const rewardNum = Number(autoRes.reward ?? taskMeta.reward ?? 0);
      const taskTitle = autoRes.task_title || taskMeta.title || "Telegram Task";

      await sendUserAlert(supabaseAdmin, {
        userId,
        category: "task",
        eventKey: "task_approved",
        title: "Task Completed Instantly!",
        message: `Membership verified for "${taskTitle}" and +$${rewardNum.toFixed(2)} was credited to your wallet.`,
        amount: rewardNum,
        actionUrl: "/wallet",
        ctaLabel: "💰 View Wallet",
        metadata: { submission_id: autoRes.submission_id, task_id, auto_verified: true },
      });

      await notifyReferrerOfCommission(
        supabaseAdmin,
        userId,
        rewardNum,
        `instant task "${taskTitle}"`
      );

      return successResponse(
        {
          message: "Membership verified! Reward credited instantly to your wallet.",
          submission_id: autoRes.submission_id,
          status: "approved",
          auto_verified: true,
          reward_credited: rewardNum,
          wallet_balance: autoRes.wallet_balance,
        },
        200,
        req
      );
    }

    // ========================================================================
    // BRANCH B: STANDARD MANUAL SCREENSHOT PROOF SUBMISSION (`manual_screenshot`)
    // ========================================================================
    const proofContent = String(proof_text || proof_data || proof || proof_url || "").trim();

    if (!proofContent || proofContent.length < 3) {
      throw new AppError("Task proof is required (text or URL).", 400, "MISSING_PROOF");
    }

    if (proofContent.length > 2000) {
      throw new AppError("Proof content exceeds maximum length of 2,000 characters.", 400, "PROOF_TOO_LONG");
    }

    const cleanProof = sanitizeString(proofContent, 2000);
    const cleanTgUsername = sanitizeString(telegram_username || "", 64);

    // 4. Atomic task slot check, duplicate prevention & submission creation under FOR UPDATE lock
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc("submit_task_atomic", {
      p_user_id: userId,
      p_task_id: task_id,
      p_proof_text: cleanProof,
    });

    if (rpcErr) throw rpcErr;

    if (!rpcRes?.success) {
      const errCode = rpcRes?.code || "SUBMISSION_FAILED";
      const statusCode = errCode === "TASK_NOT_FOUND" ? 404 : errCode === "ACCOUNT_SUSPENDED" ? 403 : 400;
      throw new AppError(rpcRes?.error || "Failed to submit task proof.", statusCode, errCode);
    }

    const submissionId = rpcRes.submission_id;
    const taskTitle = rpcRes.task_title || "Task";

    // 5. Audit Log & In-App Task Alert
    await logAuditEvent({
      actorId: userId,
      actorType: "user",
      action: "task_submitted",
      targetType: "task",
      targetId: task_id,
      details: { submissionId, taskTitle, telegramUsername: cleanTgUsername || undefined },
      ipAddress: clientIp,
    });

    await sendUserAlert(supabaseAdmin, {
      userId,
      category: "task",
      eventKey: "task_submitted",
      title: "Task Proof Under Review",
      message: `Your proof for "${taskTitle}" was submitted and is awaiting verification.`,
      actionUrl: `/tasks/${task_id}`,
      ctaLabel: "📋 View Task",
      metadata: { task_id, submission_id: submissionId },
    });

    return successResponse(
      {
        message: "Proof submitted successfully and queued for review.",
        submission_id: submissionId,
        status: "pending",
        auto_verified: false,
      },
      200,
      req
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
