// supabase/functions/_shared/auth.ts
// Standard user JWT authentication verification

import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AppError } from './errors.ts';

export interface VerifiedUser {
  id: string; // Internal UUID
  telegramId?: number;
  walletBalance?: number;
  status?: string;
}

export async function verifyUserRequest(req: Request): Promise<VerifiedUser> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Unauthorized: Missing or malformed Authorization header', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const JWT_SECRET = Deno.env.get('JWT_SECRET') || Deno.env.get('SUPABASE_JWT_SECRET') || Deno.env.get('CUSTOM_JWT_SECRET');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!JWT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError('Server configuration missing for authentication', 500, 'CONFIG_ERROR');
  }

  let payload: jose.JWTPayload;
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload: verifiedPayload } = await jose.jwtVerify(token, secret);
    payload = verifiedPayload;
  } catch (err: any) {
    throw new AppError(`Invalid or expired session: ${err.message}`, 401, 'INVALID_SESSION');
  }

  const userId = payload.sub;
  if (!userId) {
    throw new AppError('Invalid token subject', 401, 'INVALID_SESSION');
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, telegram_id, wallet_balance, status')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user) {
    throw new AppError('User account not found', 404, 'USER_NOT_FOUND');
  }

  if (user.status === 'suspended') {
    throw new AppError('Account is suspended. Please contact support.', 403, 'ACCOUNT_SUSPENDED');
  }

  return {
    id: user.id,
    telegramId: user.telegram_id,
    walletBalance: Number(user.wallet_balance || 0),
    status: user.status,
  };
}
