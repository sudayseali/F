// supabase/functions/_shared/admin-auth.ts
// Strict administrator authentication & authorization verification

import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AppError } from './errors.ts';
import { AdminRole, AdminPermission, hasPermission } from './permissions.ts';

export interface VerifiedAdmin {
  id: string;
  authUserId: string;
  email: string;
  role: AdminRole;
  fullName?: string;
}

/**
 * Validates request Bearer JWT and checks administrator database authorization
 * @param req Incoming HTTP Request
 * @param requiredPermission Optional specific permission to enforce
 */
export async function verifyAdminRequest(
  req: Request,
  requiredPermission?: AdminPermission
): Promise<VerifiedAdmin> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Unauthorized: Missing or malformed Authorization Bearer header.', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const SUPABASE_JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_JWT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError('Server configuration missing for authentication.', 500, 'CONFIG_ERROR');
  }

  // 1. Verify Cryptographic JWT Signature
  let payload: jose.JWTPayload;
  try {
    const secret = new TextEncoder().encode(SUPABASE_JWT_SECRET);
    const { payload: verifiedPayload } = await jose.jwtVerify(token, secret);
    payload = verifiedPayload;
  } catch (err: any) {
    throw new AppError(`Invalid or expired administrator session: ${err.message}`, 401, 'INVALID_TOKEN');
  }

  const authUserId = payload.sub;
  if (!authUserId) {
    throw new AppError('Token subject identifier is missing.', 401, 'INVALID_TOKEN');
  }

  // Explicitly reject standard Telegram user tokens from accessing admin routes
  const tokenEmail = String(payload.email || '');
  if (tokenEmail.endsWith('@telegram.local')) {
    throw new AppError('Forbidden: Standard Telegram user credentials cannot access administrator endpoints.', 403, 'FORBIDDEN_USER_TOKEN');
  }

  // 2. Query Database for Administrator Record by verified Auth User ID
  // Security rule: NEVER fallback to unverified email lookups
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: adminRecord, error: dbError } = await supabaseAdmin
    .from('admin_users')
    .select('id, auth_user_id, email, role, status, full_name')
    .or(`auth_user_id.eq.${authUserId},id.eq.${authUserId}`)
    .maybeSingle();

  if (dbError) {
    console.error('[ADMIN_AUTH_DB_ERROR]', dbError);
    throw new AppError('Database error validating administrator credentials.', 500, 'DB_ERROR');
  }

  if (!adminRecord) {
    throw new AppError('Access Denied: You do not have administrator privileges.', 403, 'FORBIDDEN_NOT_ADMIN');
  }

  // Verify administrator status is active (reject suspended or revoked admins)
  if (adminRecord.status !== 'active') {
    throw new AppError('Access Denied: Administrator account is suspended or revoked.', 403, 'FORBIDDEN_INACTIVE_ADMIN');
  }

  const role = (adminRecord.role || 'moderator') as AdminRole;

  // 3. Enforce Specific Server-Side Permission
  if (requiredPermission && !hasPermission(role, requiredPermission)) {
    throw new AppError(
      `Permission Denied: Your administrator role (${role}) lacks the required '${requiredPermission}' privilege.`,
      403,
      'FORBIDDEN_INSUFFICIENT_PERMISSIONS'
    );
  }

  return {
    id: adminRecord.id,
    authUserId: adminRecord.auth_user_id || authUserId,
    email: adminRecord.email,
    role,
    fullName: adminRecord.full_name,
  };
}
