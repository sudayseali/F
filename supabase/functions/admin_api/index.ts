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

      const { data: result, error } = await supabaseAdmin.rpc("admin_approve_withdrawal", {
        p_admin_id: admin.id,
        p_withdrawal_id: withdrawalId,
        p_tx_hash: sanitizeString(txHash || "", 100),
        p_note: sanitizeString(note || "", 250)
      });

      if (error) throw error;
      if (!result?.success) throw new AppError(result?.error || "Approval failed", 400, "APPROVAL_FAILED");

      return successResponse(result, 200, req);
    }

    if (action === "reject_withdrawal") {
      const admin = await verifyAdminRequest(req, "manage_withdrawals");
      const { withdrawalId, reason } = body;

      if (!withdrawalId || !isValidUuid(withdrawalId)) throw new AppError("Valid withdrawalId required.", 400, "INVALID_WITHDRAWAL_ID");
      if (!reason || reason.trim().length < 3) throw new AppError("Rejection reason is required.", 400, "MISSING_REASON");

      const { data: result, error } = await supabaseAdmin.rpc("admin_reject_withdrawal", {
        p_admin_id: admin.id,
        p_withdrawal_id: withdrawalId,
        p_reason: sanitizeString(reason, 250)
      });

      if (error) throw error;
      if (!result?.success) throw new AppError(result?.error || "Rejection failed", 400, "REJECTION_FAILED");

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
      const { title, description, category, reward, maxCompletions, targetUrl, jobLength, proofInstructions } = body;

      if (!title || !description) throw new AppError("Task title and description are required.", 400, "MISSING_FIELDS");
      const cleanReward = validatePositiveAmount(reward, 0.01, 100.0);
      const safeTargetUrl = validateOptionalHttpUrl(targetUrl);

      const { data: newTask, error } = await supabaseAdmin
        .from("tasks")
        .insert({
          title: sanitizeString(title, 120),
          description: sanitizeString(description, 1000),
          category: sanitizeString(category || "Other", 40),
          reward: cleanReward,
          max_completions: Math.max(1, parseInt(maxCompletions) || 100),
          target_url: safeTargetUrl,
          job_length: Math.max(1, parseInt(jobLength) || 5),
          proof_instructions: sanitizeString(proofInstructions || "", 500),
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
        details: { title, reward: cleanReward },
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

    throw new AppError(`Unknown admin action: '${action}'`, 404, "UNKNOWN_ACTION");

  } catch (err) {
    return errorResponse(err, req);
  }
});
