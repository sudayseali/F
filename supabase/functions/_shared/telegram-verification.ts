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
}

/**
 * Validates Telegram WebApp initData string using Web Cryptography API
 * @param initData Raw query string from window.Telegram.WebApp.initData
 * @param botToken Official bot token issued by BotFather
 * @param maxAgeSeconds Maximum allowed age of auth_date (default: 86400s / 24h)
 */
export async function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400
): Promise<VerificationResult> {
  if (!initData || typeof initData !== 'string') {
    return { valid: false, error: 'Missing or empty Telegram initData string' };
  }

  if (!botToken) {
    return { valid: false, error: 'Server TELEGRAM_BOT_TOKEN is not configured' };
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');

    if (!hash) {
      return { valid: false, error: 'initData is missing required "hash" parameter' };
    }

    // 1. Check auth_date for expiration (Replay attack defense)
    const authDateStr = urlParams.get('auth_date');
    if (!authDateStr) {
      return { valid: false, error: 'initData is missing "auth_date" parameter' };
    }

    const authDateUnix = parseInt(authDateStr, 10);
    const currentUnix = Math.floor(Date.now() / 1000);

    if (isNaN(authDateUnix) || authDateUnix <= 0) {
      return { valid: false, error: 'Invalid "auth_date" timestamp' };
    }

    if (currentUnix - authDateUnix > maxAgeSeconds) {
      return { valid: false, error: `Authentication expired. Session was generated over ${maxAgeSeconds / 3600} hours ago.` };
    }

    // 2. Sort all parameters alphabetically (excluding 'hash')
    const pairs: string[] = [];
    urlParams.forEach((value, key) => {
      if (key !== 'hash') {
        pairs.push(`${key}=${value}`);
      }
    });
    pairs.sort();
    const dataCheckString = pairs.join('\n');

    // 3. Derive Secret Key: HMAC-SHA256 of botToken with key "WebAppData"
    const encoder = new TextEncoder();
    const keyData = encoder.encode('WebAppData');
    const secretKeyMaterial = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const secretKeyBuffer = await crypto.subtle.sign(
      'HMAC',
      secretKeyMaterial,
      encoder.encode(botToken)
    );

    // 4. Compute HMAC-SHA256 signature over data_check_string
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
      encoder.encode(dataCheckString)
    );

    // Convert signature to hex
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const calculatedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Constant-time string comparison to prevent timing attacks
    if (calculatedHash.toLowerCase() !== hash.toLowerCase()) {
      return { valid: false, error: 'Cryptographic signature mismatch. Untrusted or tampered initData.' };
    }

    // 5. Extract user payload
    const userStr = urlParams.get('user');
    if (!userStr) {
      return { valid: false, error: 'initData does not contain user object' };
    }

    const userData: VerifiedTelegramUser = JSON.parse(userStr);
    if (!userData.id) {
      return { valid: false, error: 'User data missing required Telegram ID' };
    }

    return {
      valid: true,
      user: userData,
      authDate: new Date(authDateUnix * 1000),
    };
  } catch (err: any) {
    return { valid: false, error: `Telegram verification failed: ${err.message}` };
  }
}
