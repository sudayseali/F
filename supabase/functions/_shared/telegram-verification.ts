// supabase/functions/_shared/telegram-verification.ts
// Official Telegram WebApp initData HMAC-SHA256 verification procedure

export interface VerifiedTelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface VerificationResult {
  valid: boolean;
  user?: VerifiedTelegramUser;
  authDate?: Date;
  error?: string;
  errorCode?: string;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen !== bLen) return false;

  let mismatch = 0;
  for (let i = 0; i < aLen; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Validates Telegram WebApp initData string using Web Cryptography API
 * Supports official Telegram specification, modern Bot API 7+ (with signature parameter),
 * and raw character preservation.
 * 
 * @param initData Raw query string from window.Telegram.WebApp.initData
 * @param botToken Official bot token issued by BotFather
 * @param maxAgeSeconds Maximum allowed age of auth_date (default: 86400s / 24h)
 * @param clockToleranceSeconds Allowed future clock drift (default: 300s / 5m)
 */
export async function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
  clockToleranceSeconds = 300
): Promise<VerificationResult> {
  if (!initData || typeof initData !== 'string' || initData.trim() === '') {
    return { valid: false, error: 'Missing or empty Telegram initData string', errorCode: 'MISSING_INIT_DATA' };
  }

  if (!botToken || typeof botToken !== 'string' || botToken.trim() === '') {
    return { valid: false, error: 'Server TELEGRAM_BOT_TOKEN is not configured', errorCode: 'SERVER_MISCONFIG' };
  }

  try {
    // Strip leading hash fragments or prefix if forwarded from webview URL hash
    let rawInitData = initData.trim().replace(/^#/, '');
    if (rawInitData.startsWith('tgWebAppData=')) {
      rawInitData = rawInitData.replace(/^tgWebAppData=/, '');
    }

    const urlParams = new URLSearchParams(rawInitData);
    const hash = urlParams.get('hash');

    if (!hash) {
      return { valid: false, error: 'initData is missing required "hash" parameter', errorCode: 'MISSING_HASH' };
    }

    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      return { valid: false, error: 'Invalid hash format. Expected 64-character hexadecimal signature.', errorCode: 'INVALID_HASH_FORMAT' };
    }

    // 1. Check auth_date
    const authDateStr = urlParams.get('auth_date');
    if (!authDateStr) {
      return { valid: false, error: 'initData is missing "auth_date" parameter', errorCode: 'MISSING_AUTH_DATE' };
    }

    const authDateUnix = parseInt(authDateStr, 10);
    const currentUnix = Math.floor(Date.now() / 1000);

    if (isNaN(authDateUnix) || authDateUnix <= 0) {
      return { valid: false, error: 'Invalid "auth_date" timestamp format', errorCode: 'INVALID_AUTH_DATE' };
    }

    // Reject future timestamps outside clock tolerance (5 minutes drift allowed)
    if (authDateUnix > currentUnix + clockToleranceSeconds) {
      return { 
        valid: false, 
        error: `Future "auth_date" timestamp rejected (exceeds clock tolerance of ${clockToleranceSeconds}s)`, 
        errorCode: 'FUTURE_TIMESTAMP' 
      };
    }

    // Reject expired session
    if (currentUnix - authDateUnix > maxAgeSeconds) {
      return { 
        valid: false, 
        error: `Authentication expired. Session was generated over ${maxAgeSeconds / 3600} hours ago.`, 
        errorCode: 'AUTH_DATE_EXPIRED' 
      };
    }

    // Sanitize bot token (strip surrounding quotes and whitespace)
    const cleanBotToken = botToken.trim().replace(/^["']|["']$/g, '').trim();

    // 2. Prepare candidate dataCheckStrings:
    // Candidate A: all keys except 'hash' (as in official @telegram-apps/init-data-node)
    const pairsAll: string[] = [];
    // Candidate B: all keys except 'hash' and 'signature' (for legacy or third-party detached signatures)
    const pairsNoSig: string[] = [];

    urlParams.forEach((value, key) => {
      if (key !== 'hash') {
        pairsAll.push(`${key}=${value}`);
        if (key !== 'signature') {
          pairsNoSig.push(`${key}=${value}`);
        }
      }
    });

    pairsAll.sort();
    pairsNoSig.sort();

    const dataCheckStringA = pairsAll.join('\n');
    const dataCheckStringB = pairsNoSig.join('\n');

    // Telegram secret_key = HMAC_SHA256(key="WebAppData", message=bot_token).
    const encoder = new TextEncoder();
    const derivationKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const secretKeyBuffer = await crypto.subtle.sign(
      'HMAC',
      derivationKey,
      encoder.encode(cleanBotToken)
    );

    // Validate the official data-check-string using every field except hash.
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      secretKeyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      hmacKey,
      encoder.encode(dataCheckStringA)
    );
    const calculatedHash = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const matched = constantTimeCompare(calculatedHash.toLowerCase(), hash.toLowerCase());

    if (!matched) {
      return {
        valid: false,
        error: 'Cryptographic signature mismatch. Untrusted or tampered initData.',
        errorCode: 'INVALID_SIGNATURE'
      };
    }

    // Constant-time string comparison to prevent timing attacks
    if (!matched) {
      return { 
        valid: false, 
        error: 'Cryptographic signature mismatch. Untrusted or tampered initData.', 
        errorCode: 'INVALID_SIGNATURE' 
      };
    }

    // 5. Extract and validate user payload
    const userStr = urlParams.get('user');
    if (!userStr) {
      return { valid: false, error: 'initData does not contain user object', errorCode: 'MISSING_USER_OBJECT' };
    }

    let userData: any;
    try {
      userData = JSON.parse(userStr);
    } catch {
      return { valid: false, error: 'Malformed user object JSON in initData', errorCode: 'MALFORMED_USER_JSON' };
    }

    if (!userData || typeof userData.id !== 'number' || userData.id <= 0) {
      return { valid: false, error: 'User data missing required positive Telegram ID', errorCode: 'INVALID_TELEGRAM_ID' };
    }

    const verifiedUser: VerifiedTelegramUser = {
      id: userData.id,
      first_name: String(userData.first_name || 'Telegram User').slice(0, 100),
      last_name: userData.last_name ? String(userData.last_name).slice(0, 100) : undefined,
      username: userData.username ? String(userData.username).slice(0, 100) : undefined,
      language_code: userData.language_code ? String(userData.language_code).slice(0, 10) : undefined,
      is_premium: Boolean(userData.is_premium),
    };

    return {
      valid: true,
      user: verifiedUser,
      authDate: new Date(authDateUnix * 1000),
    };
  } catch (err: any) {
    return { valid: false, error: `Telegram verification failed: ${err.message}`, errorCode: 'VERIFICATION_EXCEPTION' };
  }
}
// supabase/functions/_shared/telegram-verification.ts
// Official Telegram WebApp initData HMAC-SHA256 verification procedure

export interface VerifiedTelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface VerificationResult {
  valid: boolean;
  user?: VerifiedTelegramUser;
  authDate?: Date;
  error?: string;
  errorCode?: string;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen !== bLen) return false;

  let mismatch = 0;
  for (let i = 0; i < aLen; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Validates Telegram WebApp initData string using Web Cryptography API
 * Supports official Telegram specification, modern Bot API 7+ (with signature parameter),
 * and raw character preservation.
 * 
 * @param initData Raw query string from window.Telegram.WebApp.initData
 * @param botToken Official bot token issued by BotFather
 * @param maxAgeSeconds Maximum allowed age of auth_date (default: 86400s / 24h)
 * @param clockToleranceSeconds Allowed future clock drift (default: 300s / 5m)
 */
export async function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
  clockToleranceSeconds = 300
): Promise<VerificationResult> {
  if (!initData || typeof initData !== 'string' || initData.trim() === '') {
    return { valid: false, error: 'Missing or empty Telegram initData string', errorCode: 'MISSING_INIT_DATA' };
  }

  if (!botToken || typeof botToken !== 'string' || botToken.trim() === '') {
    return { valid: false, error: 'Server TELEGRAM_BOT_TOKEN is not configured', errorCode: 'SERVER_MISCONFIG' };
  }

  try {
    // Strip leading hash fragments or prefix if forwarded from webview URL hash
    let rawInitData = initData.trim().replace(/^#/, '');
    if (rawInitData.startsWith('tgWebAppData=')) {
      rawInitData = rawInitData.replace(/^tgWebAppData=/, '');
    }

    const urlParams = new URLSearchParams(rawInitData);
    const hash = urlParams.get('hash');

    if (!hash) {
      return { valid: false, error: 'initData is missing required "hash" parameter', errorCode: 'MISSING_HASH' };
    }

    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      return { valid: false, error: 'Invalid hash format. Expected 64-character hexadecimal signature.', errorCode: 'INVALID_HASH_FORMAT' };
    }

    // 1. Check auth_date
    const authDateStr = urlParams.get('auth_date');
    if (!authDateStr) {
      return { valid: false, error: 'initData is missing "auth_date" parameter', errorCode: 'MISSING_AUTH_DATE' };
    }

    const authDateUnix = parseInt(authDateStr, 10);
    const currentUnix = Math.floor(Date.now() / 1000);

    if (isNaN(authDateUnix) || authDateUnix <= 0) {
      return { valid: false, error: 'Invalid "auth_date" timestamp format', errorCode: 'INVALID_AUTH_DATE' };
    }

    // Reject future timestamps outside clock tolerance (5 minutes drift allowed)
    if (authDateUnix > currentUnix + clockToleranceSeconds) {
      return { 
        valid: false, 
        error: `Future "auth_date" timestamp rejected (exceeds clock tolerance of ${clockToleranceSeconds}s)`, 
        errorCode: 'FUTURE_TIMESTAMP' 
      };
    }

    // Reject expired session
    if (currentUnix - authDateUnix > maxAgeSeconds) {
      return { 
        valid: false, 
        error: `Authentication expired. Session was generated over ${maxAgeSeconds / 3600} hours ago.`, 
        errorCode: 'AUTH_DATE_EXPIRED' 
      };
    }

    // Sanitize bot token (strip surrounding quotes and whitespace)
    const cleanBotToken = botToken.trim().replace(/^["']|["']$/g, '').trim();

    // 2. Prepare candidate dataCheckStrings:
    // Candidate A: all keys except 'hash' (as in official @telegram-apps/init-data-node)
    const pairsAll: string[] = [];
    // Candidate B: all keys except 'hash' and 'signature' (for legacy or third-party detached signatures)
    const pairsNoSig: string[] = [];

    urlParams.forEach((value, key) => {
      if (key !== 'hash') {
        pairsAll.push(`${key}=${value}`);
        if (key !== 'signature') {
          pairsNoSig.push(`${key}=${value}`);
        }
      }
    });

    pairsAll.sort();
    pairsNoSig.sort();

    const dataCheckStringA = pairsAll.join('\n');
    const dataCheckStringB = pairsNoSig.join('\n');

    // Telegram secret_key = HMAC_SHA256(key="WebAppData", message=bot_token).
    const encoder = new TextEncoder();
    const derivationKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const secretKeyBuffer = await crypto.subtle.sign(
      'HMAC',
      derivationKey,
      encoder.encode(cleanBotToken)
    );

    // Validate the official data-check-string using every field except hash.
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      secretKeyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      hmacKey,
      encoder.encode(dataCheckStringA)
    );
    const calculatedHash = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const matched = constantTimeCompare(calculatedHash.toLowerCase(), hash.toLowerCase());

    if (!matched) {
      return {
        valid: false,
        error: 'Cryptographic signature mismatch. Untrusted or tampered initData.',
        errorCode: 'INVALID_SIGNATURE'
      };
    }

    // Constant-time string comparison to prevent timing attacks
    if (!matched) {
      return { 
        valid: false, 
        error: 'Cryptographic signature mismatch. Untrusted or tampered initData.', 
        errorCode: 'INVALID_SIGNATURE' 
      };
    }

    // 5. Extract and validate user payload
    const userStr = urlParams.get('user');
    if (!userStr) {
      return { valid: false, error: 'initData does not contain user object', errorCode: 'MISSING_USER_OBJECT' };
    }

    let userData: any;
    try {
      userData = JSON.parse(userStr);
    } catch {
      return { valid: false, error: 'Malformed user object JSON in initData', errorCode: 'MALFORMED_USER_JSON' };
    }

    if (!userData || typeof userData.id !== 'number' || userData.id <= 0) {
      return { valid: false, error: 'User data missing required positive Telegram ID', errorCode: 'INVALID_TELEGRAM_ID' };
    }

    const verifiedUser: VerifiedTelegramUser = {
      id: userData.id,
      first_name: String(userData.first_name || 'Telegram User').slice(0, 100),
      last_name: userData.last_name ? String(userData.last_name).slice(0, 100) : undefined,
      username: userData.username ? String(userData.username).slice(0, 100) : undefined,
      language_code: userData.language_code ? String(userData.language_code).slice(0, 10) : undefined,
      is_premium: Boolean(userData.is_premium),
    };

    return {
      valid: true,
      user: verifiedUser,
      authDate: new Date(authDateUnix * 1000),
    };
  } catch (err: any) {
    return { valid: false, error: `Telegram verification failed: ${err.message}`, errorCode: 'VERIFICATION_EXCEPTION' };
  }
}
// supabase/functions/_shared/telegram-verification.ts
// Official Telegram WebApp initData HMAC-SHA256 verification procedure

export interface VerifiedTelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface VerificationResult {
  valid: boolean;
  user?: VerifiedTelegramUser;
  authDate?: Date;
  error?: string;
  errorCode?: string;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen !== bLen) return false;

  let mismatch = 0;
  for (let i = 0; i < aLen; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Validates Telegram WebApp initData string using Web Cryptography API
 * Supports official Telegram specification, modern Bot API 7+ (with signature parameter),
 * and raw character preservation.
 * 
 * @param initData Raw query string from window.Telegram.WebApp.initData
 * @param botToken Official bot token issued by BotFather
 * @param maxAgeSeconds Maximum allowed age of auth_date (default: 86400s / 24h)
 * @param clockToleranceSeconds Allowed future clock drift (default: 300s / 5m)
 */
export async function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
  clockToleranceSeconds = 300
): Promise<VerificationResult> {
  if (!initData || typeof initData !== 'string' || initData.trim() === '') {
    return { valid: false, error: 'Missing or empty Telegram initData string', errorCode: 'MISSING_INIT_DATA' };
  }

  if (!botToken || typeof botToken !== 'string' || botToken.trim() === '') {
    return { valid: false, error: 'Server TELEGRAM_BOT_TOKEN is not configured', errorCode: 'SERVER_MISCONFIG' };
  }

  try {
    // Strip leading hash fragments or prefix if forwarded from webview URL hash
    let rawInitData = initData.trim().replace(/^#/, '');
    if (rawInitData.startsWith('tgWebAppData=')) {
      rawInitData = rawInitData.replace(/^tgWebAppData=/, '');
    }

    const urlParams = new URLSearchParams(rawInitData);
    const hash = urlParams.get('hash');

    if (!hash) {
      return { valid: false, error: 'initData is missing required "hash" parameter', errorCode: 'MISSING_HASH' };
    }

    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      return { valid: false, error: 'Invalid hash format. Expected 64-character hexadecimal signature.', errorCode: 'INVALID_HASH_FORMAT' };
    }

    // 1. Check auth_date
    const authDateStr = urlParams.get('auth_date');
    if (!authDateStr) {
      return { valid: false, error: 'initData is missing "auth_date" parameter', errorCode: 'MISSING_AUTH_DATE' };
    }

    const authDateUnix = parseInt(authDateStr, 10);
    const currentUnix = Math.floor(Date.now() / 1000);

    if (isNaN(authDateUnix) || authDateUnix <= 0) {
      return { valid: false, error: 'Invalid "auth_date" timestamp format', errorCode: 'INVALID_AUTH_DATE' };
    }

    // Reject future timestamps outside clock tolerance (5 minutes drift allowed)
    if (authDateUnix > currentUnix + clockToleranceSeconds) {
      return { 
        valid: false, 
        error: `Future "auth_date" timestamp rejected (exceeds clock tolerance of ${clockToleranceSeconds}s)`, 
        errorCode: 'FUTURE_TIMESTAMP' 
      };
    }

    // Reject expired session
    if (currentUnix - authDateUnix > maxAgeSeconds) {
      return { 
        valid: false, 
        error: `Authentication expired. Session was generated over ${maxAgeSeconds / 3600} hours ago.`, 
        errorCode: 'AUTH_DATE_EXPIRED' 
      };
    }

    // Sanitize bot token (strip surrounding quotes and whitespace)
    const cleanBotToken = botToken.trim().replace(/^["']|["']$/g, '').trim();

    // 2. Prepare candidate dataCheckStrings:
    // Candidate A: all keys except 'hash' (as in official @telegram-apps/init-data-node)
    const pairsAll: string[] = [];
    // Candidate B: all keys except 'hash' and 'signature' (for legacy or third-party detached signatures)
    const pairsNoSig: string[] = [];

    urlParams.forEach((value, key) => {
      if (key !== 'hash') {
        pairsAll.push(`${key}=${value}`);
        if (key !== 'signature') {
          pairsNoSig.push(`${key}=${value}`);
        }
      }
    });

    pairsAll.sort();
    pairsNoSig.sort();

    const dataCheckStringA = pairsAll.join('\n');
    const dataCheckStringB = pairsNoSig.join('\n');

    // Telegram secret_key = HMAC_SHA256(key="WebAppData", message=bot_token).
    const encoder = new TextEncoder();
    const derivationKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const secretKeyBuffer = await crypto.subtle.sign(
      'HMAC',
      derivationKey,
      encoder.encode(cleanBotToken)
    );

    // Validate the official data-check-string using every field except hash.
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      secretKeyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      hmacKey,
      encoder.encode(dataCheckStringA)
    );
    const calculatedHash = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const matched = constantTimeCompare(calculatedHash.toLowerCase(), hash.toLowerCase());

    if (!matched) {
      return {
        valid: false,
        error: 'Cryptographic signature mismatch. Untrusted or tampered initData.',
        errorCode: 'INVALID_SIGNATURE'
      };
    }

    // Constant-time string comparison to prevent timing attacks
    if (!matched) {
      return { 
        valid: false, 
        error: 'Cryptographic signature mismatch. Untrusted or tampered initData.', 
        errorCode: 'INVALID_SIGNATURE' 
      };
    }

    // 5. Extract and validate user payload
    const userStr = urlParams.get('user');
    if (!userStr) {
      return { valid: false, error: 'initData does not contain user object', errorCode: 'MISSING_USER_OBJECT' };
    }

    let userData: any;
    try {
      userData = JSON.parse(userStr);
    } catch {
      return { valid: false, error: 'Malformed user object JSON in initData', errorCode: 'MALFORMED_USER_JSON' };
    }

    if (!userData || typeof userData.id !== 'number' || userData.id <= 0) {
      return { valid: false, error: 'User data missing required positive Telegram ID', errorCode: 'INVALID_TELEGRAM_ID' };
    }

    const verifiedUser: VerifiedTelegramUser = {
      id: userData.id,
      first_name: String(userData.first_name || 'Telegram User').slice(0, 100),
      last_name: userData.last_name ? String(userData.last_name).slice(0, 100) : undefined,
      username: userData.username ? String(userData.username).slice(0, 100) : undefined,
      language_code: userData.language_code ? String(userData.language_code).slice(0, 10) : undefined,
      is_premium: Boolean(userData.is_premium),
    };

    return {
      valid: true,
      user: verifiedUser,
      authDate: new Date(authDateUnix * 1000),
    };
  } catch (err: any) {
    return { valid: false, error: `Telegram verification failed: ${err.message}`, errorCode: 'VERIFICATION_EXCEPTION' };
  }
}
