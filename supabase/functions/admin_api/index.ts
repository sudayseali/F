// supabase/functions/admin_api/index.ts
// Comprehensive, Secure Backend API for the separate Payvora Admin Frontend

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { verifyAdminRequest } from "../_shared/admin-auth.ts";
import { checkDistributedRateLimit, getClientIp } from "../_shared/rate-limit.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";
import { validatePositiveAmount, sanitizeString, sanitizePostgrestSearch, isValidUuid } from "../_shared/validation.ts";
import { AdminRole } from "../_shared/permissions.ts";
import { sendUserAlert, notifyReferrerOfCommission, broadcastNewTaskAlert } from "../_shared/alerts.ts";
import { getAllProviderStatuses } from "../_shared/providers/registry.ts";
import { syncAllEnabledProviders, syncProviderOffers } from "../_shared/offers/sync-engine.ts";
import { getVpnSecretsStatus, loadAntiFraudConfig } from "../_shared/vpn-check.ts";
import { normalizeTelegramChatId } from "../_shared/channel-check.ts";

function validateOptionalHttpUrl(raw: unknown): string {
  const clean = sanitizeString(raw || "", 300);
  if (!clean) return "";
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new AppError("Task target URL must use http:// or https://.", 400, "INVALID_TARGET_URL");
    }
    return parsed.toString();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Invalid task target URL format.", 400, "INVALID_TARGET_URL");
  }
}

function extractProofObjectPath(rawProof: unknown): string | null {
  if (typeof rawProof !== "string" || !rawProof.trim()) return null;
  const trimmed = rawProof.trim();
  const markerMatch = trimmed.match(/\/storage\/v1\/object\/(?:public|sign)\/proofs\/([^?#]+)/i);
  if (markerMatch?.[1]) return decodeURIComponent(markerMatch[1]);
  if (/^[0-9a-f-]{36}\/[^?#]+\.(png|jpg|jpeg|webp)$/i.test(trimmed)) return trimmed;
  return null;
}

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

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const clientIp = getClientIp(req);

    // Distributed rate limiting for admin requests (120 reqs / 60s per IP)
    const rate = await checkDistributedRateLimit(supabaseAdmin, `admin_ip_${clientIp}`, 120, 60);
    if (!rate.allowed) {
      return errorResponse(new AppError("Too many admin requests. Rate limit exceeded.", 429, "RATE_LIMIT_EXCEEDED"), req);
    }

    const url = new URL(req.url);
    const body = req.method !== "GET" ? await req.json().catch(() => ({})) : {};

    // Support either path routing (/admin_api/get_users) or action payload ({ action: "get_users" })
    const pathAction = url.pathname.split("/").filter(Boolean).pop();
    const action = body.action || (pathAction !== "admin_api" && pathAction !== "admin_action" ? pathAction : null);

    if (!action) {
      throw new AppError("Missing administrator action specification.", 400, "MISSING_ACTION");
    }

    // ========================================================================
    // 1. DASHBOARD & SYSTEM STATS
    // ========================================================================
    if (action === "get_admin_data" || action === "get_dashboard_stats") {
      const admin = await verifyAdminRequest(req, "view_dashboard");

      const [{ data: aggData, error: aggErr }, { data: recentTransactions }] = await Promise.all([
        supabaseAdmin.rpc("get_admin_dashboard_aggregates"),
        supabaseAdmin
          .from("transactions")
          .select("*, user:users(telegram_id, username, first_name)")
          .order("created_at", { ascending: false })
          .limit(10)
      ]);

      if (aggErr) throw aggErr;

      return successResponse({
        admin: { email: admin.email, role: admin.role, fullName: admin.fullName },
        stats: {
          totalUsers: Number(aggData?.totalUsers || 0),
          activeTasks: Number(aggData?.activeTasks || 0),
          pendingWithdrawals: Number(aggData?.pendingWithdrawals || 0),
          pendingSubmissions: Number(aggData?.pendingSubmissions || 0),
          totalTreasuryBalance: Number(aggData?.totalTreasuryBalance || 0),
          totalPlatformEarned: Number(aggData?.totalPlatformEarned || 0),
          totalPaidOut: Number(aggData?.totalPaidOut || 0),
        },
        recentTransactions: recentTransactions || []
      }, 200, req);
    }

    // ========================================================================
    // 2. USER MANAGEMENT
    // ========================================================================
    if (action === "get_users") {
      await verifyAdminRequest(req, "manage_users");
      const page = Math.max(1, parseInt(body.page || url.searchParams.get("page") || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(body.limit || url.searchParams.get("limit") || "20")));
      const rawSearch = body.search || url.searchParams.get("search");
      const cleanSearch = sanitizePostgrestSearch(rawSearch);
      const offset = (page - 1) * limit;

      let query = supabaseAdmin.from("users").select("*", { count: "exact" });
      if (cleanSearch) {
        const filters = [`username.ilike.%${cleanSearch}%`, `first_name.ilike.%${cleanSearch}%`];
        if (/^\d+$/.test(cleanSearch)) {
          filters.push(`telegram_id.eq.${cleanSearch}`);
        }
        query = query.or(filters.join(","));
      }

      const { data: users, count, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return successResponse({ users, total: count, page, limit }, 200, req);
    }

    if (action === "update_user_status") {
      const admin = await verifyAdminRequest(req, "manage_users");
      const { userId, status, reason } = body;

      if (!userId || !isValidUuid(userId)) throw new AppError("Valid userId is required.", 400, "INVALID_USER_ID");
      if (!["active", "suspended"].includes(status)) throw new AppError("Invalid status value.", 400, "INVALID_STATUS");

      const { error } = await supabaseAdmin
        .from("users")
        .update({ status })
        .eq("id", userId);

      if (error) throw error;

      await logAuditEvent({
        actorId: admin.id,
        actorType: "admin",
        action: `user_status_${status}`,
        targetType: "user",
        targetId: userId,
        details: { status, reason: sanitizeString(reason || "") },
        ipAddress: clientIp,
      });

      return successResponse({ message: `User status updated to ${status}.` }, 200, req);
    }

    if (action === "adjust_user_balance") {
      const admin = await verifyAdminRequest(req, "manage_balances");
      const { userId, amount, reason, type, idempotencyKey } = body;

      if (!userId || !isValidUuid(userId)) throw new AppError("Valid userId is required.", 400, "INVALID_USER_ID");
      const numAmount = validatePositiveAmount(amount, 0.01, 10000.0);
      const isDeduction = type === "deduct";
      const finalAmount = isDeduction ? -numAmount : numAmount;
      const safeKey = typeof idempotencyKey === "string" && /^[a-zA-Z0-9_-]{8,100}$/.test(idempotencyKey)
        ? `adj_${idempotencyKey}`
        : `adj_${crypto.randomUUID()}_${userId}`;

      const { data: rpcResult, error } = await supabaseAdmin.rpc("atomic_wallet_credit", {
        p_user_id: userId,
        p_amount: finalAmount,
        p_type: "manual_adjustment",
        p_idempotency_key: safeKey,
        p_description: `Admin adjustment (${admin.email}): ${sanitizeString(reason || "Manual update")}`
      });

      if (error) throw error;
      if (rpcResult && rpcResult.success === false) {
        throw new AppError(rpcResult.error || "Balance adjustment failed.", 400, "ADJUSTMENT_FAILED");
      }

      await logAuditEvent({
        actorId: admin.id,
        actorType: "admin",
        action: "manual_balance_adjustment",
        targetType: "user",
        targetId: userId,
        details: { amount: finalAmount, reason: sanitizeString(reason || "") },
        ipAddress: clientIp,
      });

      return successResponse(rpcResult, 200, req);
    }

    // ========================================================================
    // 3. WITHDRAWAL MANAGEMENT
    // ========================================================================
    if (action === "get_withdrawals") {
      await verifyAdminRequest(req, "manage_withdrawals");
      const status = body.status || url.searchParams.get("status") || "pending";
      const page = Math.max(1, parseInt(body.page || url.searchParams.get("page") || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(body.limit || url.searchParams.get("limit") || "25")));
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from("withdrawals")
        .select("*, user:users(id, telegram_id, username, first_name, wallet_balance)", { count: "exact" });

      if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data: withdrawals, count, error } = await query
        .order("requested_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return successResponse({ withdrawals, total: count, page, limit }, 200, req);
    }

    if (action === "approve_withdrawal") {
      const admin = await verifyAdminRequest(req, "manage_withdrawals");
      const { withdrawalId, txHash, note } = body;

      if (!withdrawalId || !isValidUuid(withdrawalId)) throw new AppError("Valid withdrawalId required.", 400, "INVALID_WITHDRAWAL_ID");

      const { data: wdInfo } = await supabaseAdmin
        .from("withdrawals")
        .select("user_id, amount, method")
        .eq("id", withdrawalId)
        .maybeSingle();

      const cleanTxHash = sanitizeString(txHash || "", 100);
      const { data: result, error } = await supabaseAdmin.rpc("admin_approve_withdrawal", {
        p_admin_id: admin.id,
        p_withdrawal_id: withdrawalId,
        p_tx_hash: cleanTxHash,
        p_note: sanitizeString(note || "", 250)
      });

      if (error) throw error;
      if (!result?.success) throw new AppError(result?.error || "Approval failed", 400, "APPROVAL_FAILED");

      if (wdInfo?.user_id) {
        const amt = Number(wdInfo.amount || 0);
        const methodLabel =
          wdInfo.method === "usdt" ? "USDT (TRC20)" : wdInfo.method === "usdt_bep20" ? "USDT (BEP20)" : "TRX";
        const txLine = cleanTxHash ? ` Tx Hash: ${cleanTxHash}` : "";
        await sendUserAlert(supabaseAdmin, {
          userId: wdInfo.user_id,
          category: "system",
          eventKey: "withdrawal_approved",
          title: "Withdrawal Approved & Sent!",
          message: `Your $${amt.toFixed(2)} ${methodLabel} payout has been processed.${txLine}`,
          amount: amt,
          actionUrl: "/wallet",
          ctaLabel: "💰 View Wallet",
          metadata: { withdrawal_id: withdrawalId, tx_hash: cleanTxHash || undefined },
        });
      }

      return successResponse(result, 200, req);
    }

    if (action === "reject_withdrawal") {
      const admin = await verifyAdminRequest(req, "manage_withdrawals");
      const { withdrawalId, reason } = body;

      if (!withdrawalId || !isValidUuid(withdrawalId)) throw new AppError("Valid withdrawalId required.", 400, "INVALID_WITHDRAWAL_ID");
      if (!reason || reason.trim().length < 3) throw new AppError("Rejection reason is required.", 400, "MISSING_REASON");

      const { data: wdInfo } = await supabaseAdmin
        .from("withdrawals")
        .select("user_id, amount, method")
        .eq("id", withdrawalId)
        .maybeSingle();

      const cleanReason = sanitizeString(reason, 250);
      const { data: result, error } = await supabaseAdmin.rpc("admin_reject_withdrawal", {
        p_admin_id: admin.id,
        p_withdrawal_id: withdrawalId,
        p_reason: cleanReason
      });

      if (error) throw error;
      if (!result?.success) throw new AppError(result?.error || "Rejection failed", 400, "REJECTION_FAILED");

      if (wdInfo?.user_id) {
        const amt = Number(wdInfo.amount || 0);
        await sendUserAlert(supabaseAdmin, {
          userId: wdInfo.user_id,
          category: "system",
          eventKey: "withdrawal_rejected",
          title: "Withdrawal Declined & Refunded",
          message: `Your $${amt.toFixed(2)} withdrawal was declined and refunded to your wallet. Reason: ${cleanReason}`,
          actionUrl: "/wallet",
          ctaLabel: "💰 View Wallet",
          metadata: { withdrawal_id: withdrawalId, reason: cleanReason },
        });
      }

      return successResponse(result, 200, req);
    }

    // ========================================================================
    // 4. TASK & SUBMISSION MANAGEMENT
    // ========================================================================
    if (action === "get_tasks") {
      await verifyAdminRequest(req, "manage_tasks");
      const { data: tasks, error } = await supabaseAdmin
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return successResponse({ tasks }, 200, req);
    }

    if (action === "create_task") {
      const admin = await verifyAdminRequest(req, "manage_tasks");
      const {
        title,
        description,
        category,
        reward,
        maxCompletions,
        targetUrl,
        jobLength,
        proofInstructions,
        verificationType,
        verification_type,
        verificationChatId,
        verification_chat_id,
      } = body;

      if (!title || !description) throw new AppError("Task title and description are required.", 400, "MISSING_FIELDS");
      const cleanReward = validatePositiveAmount(reward, 0.01, 100.0);
      const safeTargetUrl = validateOptionalHttpUrl(targetUrl);

      const rawVerType = String(verificationType || verification_type || "manual_screenshot").trim();
      if (!["manual_screenshot", "auto_telegram_join"].includes(rawVerType)) {
        throw new AppError("Invalid verificationType. Must be 'manual_screenshot' or 'auto_telegram_join'.", 400, "INVALID_VERIFICATION_TYPE");
      }

      const rawChatInput = verificationChatId ?? verification_chat_id ?? (rawVerType === "auto_telegram_join" ? safeTargetUrl : null);
      const normalizedChatId = rawVerType === "auto_telegram_join"
        ? normalizeTelegramChatId(String(rawChatInput || ""))
        : null;

      if (rawVerType === "auto_telegram_join" && !normalizedChatId) {
        throw new AppError(
          "Auto Telegram Join tasks require a valid @channel username, public t.me link, or -100... chat ID.",
          400,
          "INVALID_CHAT_ID"
        );
      }

      const { data: newTask, error } = await supabaseAdmin
        .from("tasks")
        .insert({
          title: sanitizeString(title, 120),
          description: sanitizeString(description, 1000),
          category: sanitizeString(category || (rawVerType === "auto_telegram_join" ? "Social" : "Other"), 40),
          reward: cleanReward,
          max_completions: Math.max(1, parseInt(maxCompletions) || 100),
          target_url: safeTargetUrl,
          job_length: Math.max(1, parseInt(jobLength) || (rawVerType === "auto_telegram_join" ? 1 : 5)),
          proof_instructions: sanitizeString(proofInstructions || "", 500),
          verification_type: rawVerType,
          verification_chat_id: normalizedChatId,
          status: "active"
        })
        .select()
        .single();

      if (error) throw error;

      await logAuditEvent({
        actorId: admin.id,
        actorType: "admin",
        action: "task_created",
        targetType: "task",
        targetId: newTask.id,
        details: { title, reward: cleanReward, verificationType: rawVerType, chatId: normalizedChatId },
        ipAddress: clientIp,
      });

      const broadcastResult = await broadcastNewTaskAlert(supabaseAdmin, {
        id: newTask.id,
        title: newTask.title,
        reward: cleanReward,
        category: newTask.category,
      });

      return successResponse({ task: newTask, alertedUsers: broadcastResult.notified }, 200, req);
    }

    if (action === "update_task_status") {
      const admin = await verifyAdminRequest(req, "manage_tasks");
      const { taskId, status } = body;

      if (!taskId || !isValidUuid(taskId)) throw new AppError("Valid taskId required.", 400, "INVALID_TASK_ID");
      if (!["active", "paused", "completed", "archived"].includes(status)) throw new AppError("Invalid task status.", 400, "INVALID_STATUS");

      const { error } = await supabaseAdmin.from("tasks").update({ status }).eq("id", taskId);
      if (error) throw error;

      await logAuditEvent({
        actorId: admin.id,
        actorType: "admin",
        action: "task_status_updated",
        targetType: "task",
        targetId: taskId,
        details: { status },
        ipAddress: clientIp,
      });

      return successResponse({ message: `Task status updated to ${status}.` }, 200, req);
    }

    if (action === "get_submissions") {
      await verifyAdminRequest(req, "review_submissions");
      const status = body.status || url.searchParams.get("status") || "pending";
      const page = Math.max(1, parseInt(body.page || url.searchParams.get("page") || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(body.limit || url.searchParams.get("limit") || "25")));
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from("submissions")
        .select("*, task:tasks(id, title, reward), user:users(id, telegram_id, username, first_name)", { count: "exact" });

      if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data: submissions, count, error } = await query
        .order("submitted_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Sign private proof URLs (1-hour expiry) so admin panel can display screenshots securely
      const signedSubmissions = await Promise.all(
        (submissions || []).map(async (sub: any) => {
          const objectPath = extractProofObjectPath(sub?.proof_text);
          if (!objectPath) return sub;
          const { data: signedData } = await supabaseAdmin.storage
            .from("proofs")
            .createSignedUrl(objectPath, 3600);
          if (signedData?.signedUrl) {
            return {
              ...sub,
              proof_text: signedData.signedUrl,
              proof_signed_url: signedData.signedUrl,
              proof_object_path: objectPath,
            };
          }
          return sub;
        })
      );

      return successResponse({ submissions: signedSubmissions, total: count, page, limit }, 200, req);
    }

    if (action === "review_submission") {
      const admin = await verifyAdminRequest(req, "review_submissions");
      const { submissionId, decision, comment } = body;

      if (!submissionId || !isValidUuid(submissionId)) throw new AppError("Valid submissionId required.", 400, "INVALID_SUBMISSION_ID");
      if (!["approved", "rejected"].includes(decision)) throw new AppError("Decision must be 'approved' or 'rejected'.", 400, "INVALID_DECISION");

      const { data: subInfo } = await supabaseAdmin
        .from("submissions")
        .select("user_id, task_id, task:tasks(title, reward)")
        .eq("id", submissionId)
        .maybeSingle();

      const cleanComment = sanitizeString(comment || "", 250);

      const { data: result, error } = await supabaseAdmin.rpc("admin_review_submission", {
        p_admin_id: admin.id,
        p_submission_id: submissionId,
        p_decision: decision,
        p_comment: cleanComment
      });

      if (error) throw error;
      if (!result?.success) throw new AppError(result?.error || "Review failed", 400, "REVIEW_FAILED");

      if (subInfo?.user_id) {
        const taskObj = Array.isArray(subInfo.task) ? subInfo.task[0] : subInfo.task;
        const taskTitle = taskObj?.title || "Micro-Task";
        const rewardNum = Number(taskObj?.reward || 0);

        if (decision === "approved") {
          await sendUserAlert(supabaseAdmin, {
            userId: subInfo.user_id,
            category: "task",
            eventKey: "task_approved",
            title: "Task Approved!",
            message: `Your submission for "${taskTitle}" was approved and +$${rewardNum.toFixed(2)} was credited to your wallet.`,
            amount: rewardNum,
            actionUrl: "/wallet",
            ctaLabel: "💰 View Wallet",
            metadata: { submission_id: submissionId, task_id: subInfo.task_id },
          });
          await notifyReferrerOfCommission(supabaseAdmin, subInfo.user_id, rewardNum, `task "${taskTitle}"`);
        } else {
          await sendUserAlert(supabaseAdmin, {
            userId: subInfo.user_id,
            category: "task",
            eventKey: "task_rejected",
            title: "Task Submission Declined",
            message: cleanComment
              ? `Your submission for "${taskTitle}" was declined: ${cleanComment}`
              : `Your submission for "${taskTitle}" did not meet the proof requirements.`,
            actionUrl: subInfo.task_id ? `/tasks/${subInfo.task_id}` : "/tasks",
            ctaLabel: "📋 View Tasks",
            metadata: { submission_id: submissionId, task_id: subInfo.task_id },
          });
        }
      }

      return successResponse(result, 200, req);
    }

    // ========================================================================
    // 5. APPLICATION SETTINGS & AUDIT LOGS
    // ========================================================================
    if (action === "get_settings") {
      await verifyAdminRequest(req, "manage_settings");
      const { data: settings, error } = await supabaseAdmin.from("app_settings").select("*");
      if (error) throw error;
      return successResponse({ settings }, 200, req);
    }

    if (action === "update_setting") {
      const admin = await verifyAdminRequest(req, "manage_settings");
      const { key, value } = body;
      if (!key || typeof value !== "object" || value === null) throw new AppError("Key and JSON object value required.", 400, "INVALID_SETTINGS");

      const { error } = await supabaseAdmin
        .from("app_settings")
        .upsert({ key: sanitizeString(key, 64), value, updated_at: new Date().toISOString() });

      if (error) throw error;

      await logAuditEvent({
        actorId: admin.id,
        actorType: "admin",
        action: "app_setting_updated",
        targetType: "setting",
        targetId: key,
        details: { value },
        ipAddress: clientIp,
      });

      return successResponse({ message: `Setting '${key}' updated successfully.` }, 200, req);
    }

    if (action === "get_audit_logs") {
      await verifyAdminRequest(req, "view_audit_logs");
      const page = Math.max(1, parseInt(body.page || url.searchParams.get("page") || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(body.limit || url.searchParams.get("limit") || "50")));
      const offset = (page - 1) * limit;

      const { data: logs, count, error } = await supabaseAdmin
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return successResponse({ logs, total: count, page, limit }, 200, req);
    }

    // ========================================================================
    // 6. ADMIN USER MANAGEMENT (SUPER ADMIN ONLY)
    // ========================================================================
    if (action === "get_admins") {
      await verifyAdminRequest(req, "manage_admins");
      const { data: admins, error } = await supabaseAdmin
        .from("admin_users")
        .select("id, auth_user_id, email, full_name, role, status, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return successResponse({ admins }, 200, req);
    }

    if (action === "update_admin_role") {
      const admin = await verifyAdminRequest(req, "manage_admins");
      const { targetAdminId, role, status } = body;

      if (!targetAdminId || !isValidUuid(targetAdminId)) {
        throw new AppError("Valid targetAdminId required.", 400, "INVALID_ADMIN_ID");
      }

      // Prevent super_admin from suspending or demoting themselves (lockout protection)
      if (targetAdminId === admin.id) {
        if (status === "suspended") {
          throw new AppError("Cannot suspend your own administrator account.", 400, "CANNOT_SELF_SUSPEND");
        }
        if (role && role !== admin.role) {
          throw new AppError("Cannot change your own administrator role.", 400, "CANNOT_SELF_DEMOTE");
        }
      }

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (role) {
        const allowedRoles: AdminRole[] = ["super_admin", "admin", "finance_admin", "finance", "moderator", "support"];
        if (!allowedRoles.includes(role)) {
          throw new AppError("Invalid administrator role specified.", 400, "INVALID_ROLE");
        }
        updates.role = role;
      }
      if (status) {
        if (!["active", "suspended"].includes(status)) {
          throw new AppError("Invalid administrator status.", 400, "INVALID_STATUS");
        }
        updates.status = status;
      }

      const { error } = await supabaseAdmin
        .from("admin_users")
        .update(updates)
        .eq("id", targetAdminId);

      if (error) throw error;

      await logAuditEvent({
        actorId: admin.id,
        actorType: "admin",
        action: "admin_role_updated",
        targetType: "admin_user",
        targetId: targetAdminId,
        details: updates,
        ipAddress: clientIp,
      });

      return successResponse({ message: "Administrator permissions updated successfully." }, 200, req);
    }

    // ========================================================================
    // 7. CUSTOM OFFERS ENGINE ADMIN ENDPOINTS (PROVIDERS, SYNC, OFFERS, DISPUTES)
    // ========================================================================
    if (action === "get_offer_providers") {
      await verifyAdminRequest(req, "view_dashboard");
      const [{ data: providers, error }, { data: commissionSetting }] = await Promise.all([
        supabaseAdmin.from("offer_providers").select("*").order("display_name", { ascending: true }),
        supabaseAdmin.from("app_settings").select("value").eq("key", "offerwall_commission_config").maybeSingle(),
      ]);
      if (error) throw error;

      const statusMap = new Map(getAllProviderStatuses().map((s) => [s.providerKey, s]));
      const enriched = (providers || []).map((p: any) => ({
        ...p,
        runtimeStatus: statusMap.get(p.provider_key) || null,
      }));

      return successResponse({
        providers: enriched,
        commissionConfig: commissionSetting?.value || null,
      }, 200, req);
    }

    if (action === "update_offer_provider") {
      const admin = await verifyAdminRequest(req, "manage_settings");
      const { providerKey, status, apiEnabled, customListingEnabled, syncEnabled, commissionOverridePercent, hostedWallUrlTemplate } = body;
      const cleanKey = sanitizeString(providerKey || "", 32).toLowerCase();
      if (!cleanKey) throw new AppError("providerKey is required.", 400, "MISSING_PROVIDER_KEY");

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (status !== undefined) {
        if (!["active", "paused", "pending_approval", "disabled"].includes(status)) {
          throw new AppError("Invalid provider status.", 400, "INVALID_STATUS");
        }
        updates.status = status;
      }
      if (typeof apiEnabled === "boolean") updates.api_enabled = apiEnabled;
      if (typeof customListingEnabled === "boolean") updates.custom_listing_enabled = customListingEnabled;
      if (typeof syncEnabled === "boolean") updates.sync_enabled = syncEnabled;
      if (commissionOverridePercent !== undefined) {
        if (commissionOverridePercent === null || commissionOverridePercent === "") {
          updates.commission_override_percent = null;
        } else {
          const pct = Number(commissionOverridePercent);
          if (!Number.isFinite(pct) || pct < 10 || pct > 100) {
            throw new AppError("Commission override user share percent must be between 10 and 100.", 400, "INVALID_COMMISSION");
          }
          updates.commission_override_percent = Math.round(pct * 100) / 100;
        }
      }
      if (typeof hostedWallUrlTemplate === "string") {
        updates.hosted_wall_url_template = sanitizeString(hostedWallUrlTemplate, 400) || null;
      }

      const { data: updated, error } = await supabaseAdmin
        .from("offer_providers")
        .update(updates)
        .eq("provider_key", cleanKey)
        .select()
        .single();
      if (error) throw error;

      await logAuditEvent({
        actorId: admin.id,
        actorType: "admin",
        action: "offer_provider_updated",
        targetType: "offer_provider",
        targetId: cleanKey,
        details: updates,
        ipAddress: clientIp,
      });

      return successResponse({ provider: updated }, 200, req);
    }

    if (action === "update_commission_config") {
      const admin = await verifyAdminRequest(req, "manage_settings");
      const defaultShare = Number(body.default_user_share_percent ?? body.defaultUserSharePercent);
      const minReward = Number(body.min_user_reward_usd ?? body.minUserRewardUsd ?? 0.01);
      const maxReward = Number(body.max_user_reward_usd ?? body.maxUserRewardUsd ?? 1000);
      const rawOverrides = body.provider_user_share_overrides || body.providerUserShareOverrides || {};

      if (!Number.isFinite(defaultShare) || defaultShare < 10 || defaultShare > 100) {
        throw new AppError("Default user share percent must be between 10 and 100.", 400, "INVALID_COMMISSION");
      }
      if (!Number.isFinite(minReward) || minReward < 0.01 || minReward > 10) {
        throw new AppError("Minimum user reward must be between $0.01 and $10.00.", 400, "INVALID_LIMIT");
      }
      if (!Number.isFinite(maxReward) || maxReward < 10 || maxReward > 5000) {
        throw new AppError("Maximum user reward must be between $10 and $5000.", 400, "INVALID_LIMIT");
      }

      const cleanOverrides: Record<string, number> = {};
      if (rawOverrides && typeof rawOverrides === "object") {
        for (const [k, v] of Object.entries(rawOverrides)) {
          const pct = Number(v);
          if (Number.isFinite(pct) && pct >= 10 && pct <= 100) {
            cleanOverrides[sanitizeString(k, 32).toLowerCase()] = Math.round(pct * 100) / 100;
          }
        }
      }

      const value = {
        default_user_share_percent: Math.round(defaultShare * 100) / 100,
        min_user_reward_usd: Math.round(minReward * 100) / 100,
        max_user_reward_usd: Math.round(maxReward * 100) / 100,
        provider_user_share_overrides: cleanOverrides,
      };

      const { error } = await supabaseAdmin
        .from("app_settings")
        .upsert({
          key: "offerwall_commission_config",
          value,
          description: "Payvora custom offers reward split & margin rules",
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;

      await logAuditEvent({
        actorId: admin.id,
        actorType: "admin",
        action: "offer_commission_config_updated",
        targetType: "setting",
        targetId: "offerwall_commission_config",
        details: value,
        ipAddress: clientIp,
      });

      return successResponse({ commissionConfig: value }, 200, req);
    }

    if (action === "trigger_offer_sync") {
      const admin = await verifyAdminRequest(req, "manage_settings");
      const providerKey = sanitizeString(body.providerKey || "", 32).toLowerCase();
      const country = body.country ? sanitizeString(body.country, 2).toUpperCase() : undefined;

      const results = providerKey
        ? [await syncProviderOffers(supabaseAdmin, providerKey, { country, forceEvenIfSyncDisabled: true })]
        : await syncAllEnabledProviders(supabaseAdmin);

      await logAuditEvent({
        actorId: admin.id,
        actorType: "admin",
        action: "admin_offer_sync_triggered",
        targetType: "offer_provider",
        targetId: providerKey || "all_enabled",
        details: { results },
        ipAddress: clientIp,
      });

      return successResponse({ results }, 200, req);
    }

    if (action === "get_provider_sync_logs") {
      await verifyAdminRequest(req, "view_dashboard");
      const limit = Math.min(100, Math.max(1, parseInt(body.limit || url.searchParams.get("limit") || "40")));
      const { data: logs, error } = await supabaseAdmin
        .from("provider_sync_logs")
        .select("*, provider:offer_providers(provider_key, display_name)")
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return successResponse({ logs: logs || [] }, 200, req);
    }

    if (action === "get_admin_offers") {
      await verifyAdminRequest(req, "view_dashboard");
      const page = Math.max(1, parseInt(body.page || url.searchParams.get("page") || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(body.limit || url.searchParams.get("limit") || "30")));
      const offset = (page - 1) * limit;
      const category = sanitizeString(body.category || url.searchParams.get("category") || "all", 32).toLowerCase();
      const cleanSearch = sanitizePostgrestSearch(body.search || url.searchParams.get("search") || "");

      let query = supabaseAdmin
        .from("offers")
        .select("*, provider:offer_providers(provider_key, display_name)", { count: "exact" });

      if (category !== "all") query = query.eq("category", category);
      if (cleanSearch) {
        query = query.or(`title.ilike.%${cleanSearch}%,external_offer_id.ilike.%${cleanSearch}%`);
      }

      const { data: offers, count, error } = await query
        .order("is_active", { ascending: false })
        .order("is_featured", { ascending: false })
        .order("user_reward", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return successResponse({ offers: offers || [], total: count || 0, page, limit }, 200, req);
    }

    if (action === "update_admin_offer") {
      const admin = await verifyAdminRequest(req, "manage_settings");
      const { offerId, isActive, isFeatured } = body;
      if (!offerId || !isValidUuid(offerId)) throw new AppError("Valid offerId required.", 400, "INVALID_OFFER_ID");

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (typeof isActive === "boolean") updates.is_active = isActive;
      if (typeof isFeatured === "boolean") updates.is_featured = isFeatured;

      const { data: updated, error } = await supabaseAdmin
        .from("offers")
        .update(updates)
        .eq("id", offerId)
        .select()
        .single();
      if (error) throw error;

      await logAuditEvent({
        actorId: admin.id,
        actorType: "admin",
        action: "admin_offer_updated",
        targetType: "offer",
        targetId: offerId,
        details: updates,
        ipAddress: clientIp,
      });

      return successResponse({ offer: updated }, 200, req);
    }

    if (action === "get_offer_conversions") {
      await verifyAdminRequest(req, "view_dashboard");
      const limit = Math.min(100, Math.max(1, parseInt(body.limit || url.searchParams.get("limit") || "40")));
      const [{ data: conversions, error: cErr }, { data: postbacks, error: pErr }] = await Promise.all([
        supabaseAdmin
          .from("offer_completions")
          .select("*, user:users(telegram_id, username, first_name), offer:offers(title), provider:offer_providers(provider_key, display_name)")
          .order("created_at", { ascending: false })
          .limit(limit),
        supabaseAdmin
          .from("provider_postbacks")
          .select("*, provider:offer_providers(provider_key, display_name)")
          .order("received_at", { ascending: false })
          .limit(limit),
      ]);
      if (cErr) throw cErr;
      if (pErr) throw pErr;
      return successResponse({ conversions: conversions || [], postbacks: postbacks || [] }, 200, req);
    }

    if (action === "get_offer_disputes") {
      await verifyAdminRequest(req, "review_submissions");
      const status = sanitizeString(body.status || url.searchParams.get("status") || "all", 24).toLowerCase();
      let query = supabaseAdmin
        .from("offer_disputes")
        .select("*, user:users(id, telegram_id, username, first_name), offer:offers(title, user_reward), provider:offer_providers(provider_key, display_name)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (status !== "all") query = query.eq("status", status);
      const { data: disputes, error } = await query;
      if (error) throw error;
      return successResponse({ disputes: disputes || [] }, 200, req);
    }

    if (action === "resolve_offer_dispute") {
      const admin = await verifyAdminRequest(req, "review_submissions");
      const { disputeId, status, adminNote, creditAmount } = body;
      if (!disputeId || !isValidUuid(disputeId)) throw new AppError("Valid disputeId required.", 400, "INVALID_DISPUTE_ID");
      if (!["open", "investigating", "resolved", "rejected"].includes(status)) {
        throw new AppError("Invalid dispute status.", 400, "INVALID_STATUS");
      }

      const { data: disputeRow } = await supabaseAdmin
        .from("offer_disputes")
        .select("id, user_id, offer_id, status, offer:offers(title)")
        .eq("id", disputeId)
        .maybeSingle();

      if (!disputeRow) throw new AppError("Dispute ticket not found.", 404, "DISPUTE_NOT_FOUND");

      const cleanNote = sanitizeString(adminNote || "", 400);
      const resolvedAt = status === "resolved" || status === "rejected" ? new Date().toISOString() : null;

      let credited = 0;
      if (status === "resolved" && creditAmount !== undefined && Number(creditAmount) > 0) {
        // Explicit permission check for financial credits
        await verifyAdminRequest(req, "manage_balances");
        const numCredit = validatePositiveAmount(creditAmount, 0.01, 250.0);
        const { data: creditRes, error: creditErr } = await supabaseAdmin.rpc("atomic_wallet_credit", {
          p_user_id: disputeRow.user_id,
          p_amount: numCredit,
          p_type: "offer_reward",
          p_idempotency_key: `dispute_${disputeId}`,
          p_reference_id: disputeId,
          p_description: `Missing Offer Reward Resolution (Ticket ${disputeId.slice(0, 8)})`,
        });
        if (creditErr) throw creditErr;
        if (!creditRes?.already_processed) {
          credited = numCredit;
        }
      }

      const { data: updated, error: updErr } = await supabaseAdmin
        .from("offer_disputes")
        .update({
          status,
          admin_note: cleanNote || null,
          reviewed_by: admin.id,
          resolved_at: resolvedAt,
        })
        .eq("id", disputeId)
        .select()
        .single();
      if (updErr) throw updErr;

      await logAuditEvent({
        actorId: admin.id,
        actorType: "admin",
        action: "offer_dispute_resolved",
        targetType: "offer_dispute",
        targetId: disputeId,
        details: { status, adminNote: cleanNote, credited },
        ipAddress: clientIp,
      });

      const offerObj = Array.isArray(disputeRow.offer) ? disputeRow.offer[0] : disputeRow.offer;
      const offerTitle = offerObj?.title || "Offer Ticket";
      if (status === "resolved" || status === "rejected") {
        await sendUserAlert(supabaseAdmin, {
          userId: disputeRow.user_id,
          category: "offer",
          eventKey: status === "resolved" ? "offer_dispute_resolved" : "offer_dispute_rejected",
          title: status === "resolved" ? "Missing Reward Ticket Resolved" : "Missing Reward Ticket Closed",
          message:
            status === "resolved" && credited > 0
              ? `Your review for "${offerTitle}" was resolved and +$${credited.toFixed(2)} has been credited to your wallet.`
              : `Update on "${offerTitle}": ${cleanNote || `Marked as ${status}.`}`,
          amount: credited > 0 ? credited : null,
          actionUrl: credited > 0 ? "/wallet" : "/offerwall",
          ctaLabel: credited > 0 ? "💰 View Wallet" : "🎁 View Offers",
        });
      }

      return successResponse({ dispute: updated, credited }, 200, req);
    }

    if (action === "get_offer_analytics") {
      await verifyAdminRequest(req, "view_dashboard");
      const [{ count: totalClicks }, { count: activeOffers }, { data: completions }, { count: openDisputes }] =
        await Promise.all([
          supabaseAdmin.from("offer_clicks").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("offers").select("*", { count: "exact", head: true }).eq("is_active", true),
          supabaseAdmin.from("offer_completions").select("provider_reward, user_reward, payvora_commission, status, reversed_amount"),
          supabaseAdmin.from("offer_disputes").select("*", { count: "exact", head: true }).in("status", ["open", "investigating"]),
        ]);

      let totalProviderPayout = 0;
      let totalUserRewards = 0;
      let totalNetMargin = 0;
      let totalReversedCount = 0;
      const allComps = completions || [];

      for (const c of allComps) {
        totalProviderPayout += Number(c.provider_reward || 0);
        totalUserRewards += Number(c.user_reward || 0);
        totalNetMargin += Number(c.payvora_commission || 0);
        if (c.status === "reversed" || c.status === "partially_reversed") {
          totalReversedCount++;
        }
      }

      return successResponse({
        analytics: {
          activeOffers: activeOffers || 0,
          totalClicks: totalClicks || 0,
          totalConversions: allComps.length,
          reversalRatePercent: allComps.length > 0 ? Math.round((totalReversedCount / allComps.length) * 10000) / 100 : 0,
          totalProviderPayout: Math.round(totalProviderPayout * 100) / 100,
          totalUserRewards: Math.round(totalUserRewards * 100) / 100,
          totalNetMargin: Math.round(totalNetMargin * 100) / 100,
          openDisputes: openDisputes || 0,
        },
      }, 200, req);
    }

    // ========================================================================
    // 8. ANTI-FRAUD & VPN DETECTION CONTROLS
    // ========================================================================
    if (action === "get_anti_fraud_config") {
      await verifyAdminRequest(req, "manage_settings");
      const [config, recentBlocksRes] = await Promise.all([
        loadAntiFraudConfig(supabaseAdmin, true),
        supabaseAdmin
          .from("audit_logs")
          .select("id, actor_id, target_type, details, ip_address, created_at")
          .eq("action", "vpn_access_blocked")
          .order("created_at", { ascending: false })
          .limit(25),
      ]);

      return successResponse({
        config,
        secretsStatus: getVpnSecretsStatus(),
        recentVpnBlocks: recentBlocksRes.data || [],
      }, 200, req);
    }

    if (action === "update_anti_fraud_config") {
      const admin = await verifyAdminRequest(req, "manage_settings");
      const current = await loadAntiFraudConfig(supabaseAdmin, true);

      const updated = {
        vpn_detection_enabled:
          typeof body.vpn_detection_enabled === "boolean"
            ? body.vpn_detection_enabled
            : current.vpn_detection_enabled,
        max_daily_withdrawals:
          body.max_daily_withdrawals !== undefined
            ? Math.min(20, Math.max(1, parseInt(String(body.max_daily_withdrawals), 10) || 3))
            : current.max_daily_withdrawals,
        block_vpn_on_offers:
          typeof body.block_vpn_on_offers === "boolean" ? body.block_vpn_on_offers : current.block_vpn_on_offers,
        block_vpn_on_tasks:
          typeof body.block_vpn_on_tasks === "boolean" ? body.block_vpn_on_tasks : current.block_vpn_on_tasks,
        block_vpn_on_checkin:
          typeof body.block_vpn_on_checkin === "boolean" ? body.block_vpn_on_checkin : current.block_vpn_on_checkin,
        block_vpn_on_withdraw:
          typeof body.block_vpn_on_withdraw === "boolean" ? body.block_vpn_on_withdraw : current.block_vpn_on_withdraw,
        block_vpn_on_auth:
          typeof body.block_vpn_on_auth === "boolean" ? body.block_vpn_on_auth : current.block_vpn_on_auth,
        block_hosting_ips:
          typeof body.block_hosting_ips === "boolean" ? body.block_hosting_ips : current.block_hosting_ips,
        vpn_risk_threshold:
          body.vpn_risk_threshold !== undefined
            ? Math.min(100, Math.max(20, parseInt(String(body.vpn_risk_threshold), 10) || 66))
            : current.vpn_risk_threshold,
        strict_fail_closed:
          typeof body.strict_fail_closed === "boolean" ? body.strict_fail_closed : current.strict_fail_closed,
      };

      const { error: cfgErr } = await supabaseAdmin
        .from("app_settings")
        .upsert(
          {
            key: "anti_fraud_config",
            value: updated,
            description: "Multi-layer VPN, Proxy, and anti-fraud controls",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );
      if (cfgErr) throw cfgErr;

      await logAuditEvent({
        actorId: admin.id,
        actorType: "admin",
        action: "anti_fraud_config_updated",
        targetType: "app_settings",
        targetId: "anti_fraud_config",
        details: updated,
        ipAddress: clientIp,
      });

      return successResponse({
        config: updated,
        secretsStatus: getVpnSecretsStatus(),
      }, 200, req);
    }

    throw new AppError(`Unknown admin action: '${action}'`, 404, "UNKNOWN_ACTION");

  } catch (err) {
    return errorResponse(err, req);
  }
});
