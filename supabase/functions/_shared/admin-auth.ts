// supabase/functions/_shared/admin-auth.ts
// Strict administrator authentication & authorization verification

import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AppError } from './errors.ts';
import { AdminRole, AdminPermission, hasPermission } from './permissions.ts';
import { isValidUuid } from './validation.ts';

export interface VerifiedAdmin {
  id: string;
  authUserId: string;
  email: string;
  role: AdminRole;
  fullName?: string;
}

const ASYMMETRIC_ALGS = new Set(['ES256', 'RS256', 'EdDSA']);
let cachedJwksUrl = '';
let cachedJwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getSupabaseJwks(supabaseUrl: string) {
  const jwksUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`;
  if (!cachedJwks || cachedJwksUrl !== jwksUrl) {
    cachedJwksUrl = jwksUrl;
    cachedJwks = jose.createRemoteJWKSet(new URL(jwksUrl));
  }
  return cachedJwks;
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
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const hsSecrets = Array.from(
    new Set(
      [
        Deno.env.get('SUPABASE_JWT_SECRET'),
        Deno.env.get('JWT_SECRET'),
        Deno.env.get('CUSTOM_JWT_SECRET'),
      ]
        .map((s) => (s || '').trim())
        .filter(Boolean)
    )
  );

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError('Server configuration missing for authentication.', 500, 'CONFIG_ERROR');
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Inspect JWT algorithm safely (reject 'none' and algorithm confusion)
  let alg = '';
  try {
    const header = jose.decodeProtectedHeader(token);
    alg = String(header.alg || '').trim();
  } catch {
    throw new AppError('Invalid or expired administrator session: Malformed token header.', 401, 'INVALID_TOKEN');
  }

  if (alg !== 'HS256' && !ASYMMETRIC_ALGS.has(alg)) {
    throw new AppError(`Invalid or expired administrator session: Unsupported algorithm '${alg || 'unknown'}'.`, 401, 'INVALID_TOKEN');
  }

  // 2. Cryptographic JWT Verification (Asymmetric JWKS for ES256/RS256/EdDSA, Secret for HS256, GoTrue fallback for managed keys)
  let authUserId: string | undefined;
  let tokenEmail = '';

  if (ASYMMETRIC_ALGS.has(alg)) {
    try {
      const jwks = getSupabaseJwks(SUPABASE_URL);
      const { payload } = await jose.jwtVerify(token, jwks, {
        algorithms: [alg],
        audience: 'authenticated',
      });
      authUserId = payload.sub;
      tokenEmail = String(payload.email || '');
    } catch (jwksErr: any) {
      // Fallback to authoritative GoTrue verification (handles key rotation / custom auth domains)
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
      if (userErr || !userData?.user) {
        throw new AppError(
          `Invalid or expired administrator session: ${jwksErr?.message || userErr?.message || 'Verification failed'}`,
          401,
          'INVALID_TOKEN'
        );
      }
      authUserId = userData.user.id;
      tokenEmail = String(userData.user.email || '');
    }
  } else {
    let verified = false;
    let lastErr: any = null;
    for (const rawSecret of hsSecrets) {
      try {
        const secret = new TextEncoder().encode(rawSecret);
        const { payload } = await jose.jwtVerify(token, secret, {
          algorithms: ['HS256'],
          audience: 'authenticated',
        });
        authUserId = payload.sub;
        tokenEmail = String(payload.email || '');
        verified = true;
        break;
      } catch (err: any) {
        lastErr = err;
      }
    }

    if (!verified) {
      // If JWT_SECRET was customized for Telegram tokens while Supabase Auth uses its managed HS256 key, verify via GoTrue
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
      if (userErr || !userData?.user) {
        throw new AppError(
          `Invalid or expired administrator session: ${lastErr?.message || userErr?.message || 'Verification failed'}`,
          401,
          'INVALID_TOKEN'
        );
      }
      authUserId = userData.user.id;
      tokenEmail = String(userData.user.email || '');
    }
  }

  if (!authUserId || !isValidUuid(authUserId)) {
    throw new AppError('Token subject identifier is missing or invalid.', 401, 'INVALID_TOKEN');
  }

  // Explicitly reject standard Telegram user tokens from accessing admin routes
  if (tokenEmail.endsWith('@telegram.local')) {
    throw new AppError('Forbidden: Standard Telegram user credentials cannot access administrator endpoints.', 403, 'FORBIDDEN_USER_TOKEN');
  }

  // 3. Query Database for Administrator Record by verified Auth User ID
  // Security rule: NEVER fallback to unverified email lookups

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
