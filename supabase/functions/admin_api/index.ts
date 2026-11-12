// supabase/functions/admin_api/index.ts
// Comprehensive, Secure Backend API for the separate Payvora Admin Frontend

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { verifyAdminRequest } from "../_shared/admin-auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";
import { validatePositiveAmount, sanitizeString, isValidUuid } from "../_shared/validation.ts";
import { AdminRole } from "../_shared/permissions.ts";

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

  const supabaseAdmin = getSupabaseAdmin();
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // Rate limiting for admin requests (120 reqs / minute per IP)
  const rate = checkRateLimit(`admin_${clientIp}`, 120, 60000);
  if (!rate.allowed) {
    return errorResponse(new AppError("Too many admin requests. Rate limit exceeded.", 429, "RATE_LIMIT_EXCEEDED"));
  }

  try {
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

      const [
        { count: totalUsers },
        { count: totalTasks },
        { count: pendingWithdrawals },
        { count: pendingSubmissions },
        { data: balanceStats },
        { data: withdrawalStats }
      ] = await Promise.all([
        supabaseAdmin.from("users").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("tasks").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabaseAdmin.from("withdrawals").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabaseAdmin.from("submissions").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabaseAdmin.from("users").select("wallet_balance, total_earned"),
        supabaseAdmin.from("withdrawals").select("amount").eq("status", "completed")
      ]);

      const totalBalance = balanceStats?.reduce((acc, curr) => acc + Number(curr.wallet_balance || 0), 0) || 0;
      const totalEarned = balanceStats?.reduce((acc, curr) => acc + Number(curr.total_earned || 0), 0) || 0;
      const totalPaidOut = withdrawalStats?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;

      const { data: recentTransactions } = await supabaseAdmin
        .from("transactions")
        .select("*, user:users(telegram_id, username, first_name)")
        .order("created_at", { ascending: false })
        .limit(10);

      return successResponse({
        admin: { email: admin.email, role: admin.role, fullName: admin.fullName },
        stats: {
          totalUsers: totalUsers || 0,
          activeTasks: totalTasks || 0,
          pendingWithdrawals: pendingWithdrawals || 0,
          pendingSubmissions: pendingSubmissions || 0,
          totalTreasuryBalance: totalBalance,
          totalPlatformEarned: totalEarned,
          totalPaidOut: totalPaidOut,
        },
        recentTransactions: recentTransactions || []
      });
    }

    // ========================================================================
    // 2. USER MANAGEMENT
    // ========================================================================
    if (action === "get_users") {
      await verifyAdminRequest(req, "manage_users");
      const page = Math.max(1, parseInt(body.page || url.searchParams.get("page") || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(body.limit || url.searchParams.get("limit") || "20")));
      const search = body.search || url.searchParams.get("search");
      const offset = (page - 1) * limit;

      let query = supabaseAdmin.from("users").select("*", { count: "exact" });
      if (search) {
        query = query.or(`username.ilike.%${search}%,first_name.ilike.%${search}%,telegram_id.eq.${parseInt(search) || 0}`);
      }

      const { data: users, count, error } = await query
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return successResponse({ users, total: count, page, limit });
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

      return successResponse({ message: `User status updated to ${status}.` });
    }

    if (action === "adjust_user_balance") {
      const admin = await verifyAdminRequest(req, "manage_balances");
      const { userId, amount, reason, type } = body;

      if (!userId || !isValidUuid(userId)) throw new AppError("Valid userId is required.", 400, "INVALID_USER_ID");
      const numAmount = validatePositiveAmount(amount, 0.01, 10000.0);
      const isDeduction = type === "deduct";
      const finalAmount = isDeduction ? -numAmount : numAmount;

      const { data: rpcResult, error } = await supabaseAdmin.rpc("atomic_wallet_credit", {
        p_user_id: userId,
        p_amount: finalAmount,
        p_type: "manual_adjustment",
        p_idempotency_key: `adj_${Date.now()}_${userId}`,
        p_description: `Admin adjustment (${admin.email}): ${sanitizeString(reason || "Manual update")}`
      });

      if (error) throw error;

      await logAuditEvent({
        actorId: admin.id,
        actorType: "admin",
        action: "manual_balance_adjustment",
        targetType: "user",
        targetId: userId,
        details: { amount: finalAmount, reason: sanitizeString(reason || "") },
        ipAddress: clientIp,
      });

      return successResponse(rpcResult);
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
      return successResponse({ withdrawals, total: count, page, limit });
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

      return successResponse(result);
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

      return successResponse(result);
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
      return successResponse({ tasks });
    }

    if (action === "create_task") {
      const admin = await verifyAdminRequest(req, "manage_tasks");
      const { title, description, category, reward, maxCompletions, targetUrl, jobLength, proofInstructions } = body;

      if (!title || !description) throw new AppError("Task title and description are required.", 400, "MISSING_FIELDS");
      const cleanReward = validatePositiveAmount(reward, 0.01, 100.0);

      const { data: newTask, error } = await supabaseAdmin
        .from("tasks")
        .insert({
          title: sanitizeString(title, 120),
          description: sanitizeString(description, 1000),
          category: sanitizeString(category || "Other", 40),
          reward: cleanReward,
          max_completions: Math.max(1, parseInt(maxCompletions) || 100),
          target_url: sanitizeString(targetUrl || "", 300),
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

      return successResponse({ task: newTask });
    }

    if (action === "update_task_status") {
      const admin = await verifyAdminRequest(req, "manage_tasks");
      const { taskId, status } = body;

      if (!taskId || !isValidUuid(taskId)) throw new AppError("Valid taskId required.", 400, "INVALID_TASK_ID");
      if (!["active", "paused", "completed", "archived"].includes(status)) throw new AppError("Invalid task status.", 400, "INVALID_STATUS");

      const { error } = await supabaseAdmin.from("tasks").update({ status }).eq("id", taskId);
      if (error) throw error;

      return successResponse({ message: `Task status updated to ${status}.` });
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
      return successResponse({ submissions, total: count, page, limit });
    }

    if (action === "review_submission") {
      const admin = await verifyAdminRequest(req, "review_submissions");
      const { submissionId, decision, comment } = body;

      if (!submissionId || !isValidUuid(submissionId)) throw new AppError("Valid submissionId required.", 400, "INVALID_SUBMISSION_ID");
      if (!["approved", "rejected"].includes(decision)) throw new AppError("Decision must be 'approved' or 'rejected'.", 400, "INVALID_DECISION");

      const { data: result, error } = await supabaseAdmin.rpc("admin_review_submission", {
        p_admin_id: admin.id,
        p_submission_id: submissionId,
        p_decision: decision,
        p_comment: sanitizeString(comment || "", 250)
      });

      if (error) throw error;
      if (!result?.success) throw new AppError(result?.error || "Review failed", 400, "REVIEW_FAILED");

      return successResponse(result);
    }

    // ========================================================================
    // 5. APPLICATION SETTINGS & AUDIT LOGS
    // ========================================================================
    if (action === "get_settings") {
      await verifyAdminRequest(req, "manage_settings");
      const { data: settings, error } = await supabaseAdmin.from("app_settings").select("*");
      if (error) throw error;
      return successResponse({ settings });
    }

    if (action === "update_setting") {
      const admin = await verifyAdminRequest(req, "manage_settings");
      const { key, value } = body;
      if (!key || typeof value !== "object") throw new AppError("Key and JSON object value required.", 400, "INVALID_SETTINGS");

      const { error } = await supabaseAdmin
        .from("app_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() });

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

      return successResponse({ message: `Setting '${key}' updated successfully.` });
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
      return successResponse({ logs, total: count, page, limit });
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
      return successResponse({ admins });
    }

    if (action === "update_admin_role") {
      const admin = await verifyAdminRequest(req, "manage_admins");
      const { targetAdminId, role, status } = body;

      if (!targetAdminId || !isValidUuid(targetAdminId)) {
        throw new AppError("Valid targetAdminId required.", 400, "INVALID_ADMIN_ID");
      }

      // Prevent super_admin demoting or locking themselves out
      if (targetAdminId === admin.id && status === "suspended") {
        throw new AppError("Cannot suspend your own administrator account.", 400, "CANNOT_SELF_SUSPEND");
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

      return successResponse({ message: "Administrator permissions updated successfully." });
    }

    throw new AppError(`Unknown admin action: '${action}'`, 404, "UNKNOWN_ACTION");

  } catch (err) {
    return errorResponse(err);
  }
});
