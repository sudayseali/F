// supabase/functions/_shared/admin-auth.ts
// Strict administrator authentication & authorization verification

import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AppError } from './errors.ts';
import { AdminRole, AdminPermission, hasPermission } from './permissions.ts';

export interface VerifiedAdmin {
  id: string;
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
    throw new AppError('Unauthorized: Missing or malformed Authorization Bearer header', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const SUPABASE_JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_JWT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError('Server misconfiguration: Authentication secrets missing', 500, 'CONFIG_ERROR');
  }

  // 1. Verify Cryptographic JWT Signature
  let payload: jose.JWTPayload;
  try {
    const secret = new TextEncoder().encode(SUPABASE_JWT_SECRET);
    const { payload: verifiedPayload } = await jose.jwtVerify(token, secret);
    payload = verifiedPayload;
  } catch (err: any) {
    throw new AppError(`Invalid or expired token: ${err.message}`, 401, 'INVALID_TOKEN');
  }

  const userId = payload.sub;
  if (!userId) {
    throw new AppError('Token subject identifier is missing', 401, 'INVALID_TOKEN');
  }

  // 2. Query Database for Administrator Record (Single source of truth)
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: adminRecord, error: dbError } = await supabaseAdmin
    .from('admin_users')
    .select('id, email, role, status, full_name')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (dbError) {
    console.error('[ADMIN_AUTH_DB_ERROR]', dbError);
    throw new AppError('Database error validating administrator credentials', 500, 'DB_ERROR');
  }

  // Fallback: If not found by auth_user_id, check email or direct id
  let admin = adminRecord;
  if (!admin && payload.email) {
    const { data: byEmail } = await supabaseAdmin
      .from('admin_users')
      .select('id, email, role, status, full_name')
      .eq('email', payload.email)
      .maybeSingle();
    admin = byEmail;
  }

  if (!admin) {
    throw new AppError('Access Denied: You do not have administrator privileges.', 403, 'FORBIDDEN_NOT_ADMIN');
  }

  if (admin.status !== 'active') {
    throw new AppError('Administrator account is suspended or inactive.', 403, 'FORBIDDEN_INACTIVE_ADMIN');
  }

  const role = (admin.role || 'moderator') as AdminRole;

  // 3. Enforce Specific Permission if requested
  if (requiredPermission && !hasPermission(role, requiredPermission)) {
    throw new AppError(
      `Permission Denied: Your role (${role}) lacks the required '${requiredPermission}' privilege.`,
      403,
      'FORBIDDEN_INSUFFICIENT_PERMISSIONS'
    );
  }

  return {
    id: admin.id,
    email: admin.email,
    role,
    fullName: admin.full_name,
  };
}
