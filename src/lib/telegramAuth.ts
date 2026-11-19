export interface AuthAttemptOutcome {
  kind: 'success' | 'channel_gate' | 'vpn_blocked' | 'fatal' | 'transient';
  retryable: boolean;
  status?: number;
  code?: string;
  error?: string;
  data?: any;
}

const NON_RETRYABLE_CODES = new Set([
  'INVALID_SIGNATURE',
  'AUTH_DATE_EXPIRED',
  'FUTURE_TIMESTAMP',
  'MISSING_INIT_DATA',
  'INVALID_HASH_FORMAT',
  'MISSING_AUTH_DATE',
  'ACCOUNT_SUSPENDED',
  'VPN_DETECTED',
  'CORS_ORIGIN_DENIED',
  'METHOD_NOT_ALLOWED',
]);

export function classifyAuthResponse(
  status: number | undefined,
  body: any,
  fallbackMessage?: string
): AuthAttemptOutcome {
  const code = typeof body?.code === 'string' ? body.code : undefined;
  const rawError =
    (typeof body?.error === 'string' && body.error) ||
    (typeof body?.message === 'string' && body.message) ||
    fallbackMessage ||
    'Failed to authenticate session with server.';

  if (
    code === 'VPN_DETECTED' ||
    body?.error === 'VPN Blocked' ||
    body?.isVpnBlock === true
  ) {
    return {
      kind: 'vpn_blocked',
      retryable: false,
      status: status ?? 403,
      code: code || 'VPN_DETECTED',
      error: rawError,
      data: body,
    };
  }

  const payload = body?.data ?? body;
  if (payload?.requires_channel_join) {
    return {
      kind: 'channel_gate',
      retryable: false,
      status: status ?? 200,
      data: payload,
    };
  }

  if (
    body &&
    body.success !== false &&
    (body.success === true || body.data || body.access_token)
  ) {
    return {
      kind: 'success',
      retryable: false,
      status: status ?? 200,
      data: payload,
    };
  }

  if (
    (status !== undefined && status >= 400 && status < 500) ||
    (code && NON_RETRYABLE_CODES.has(code))
  ) {
    return {
      kind: 'fatal',
      retryable: false,
      status,
      code,
      error: rawError,
      data: body,
    };
  }

  return {
    kind: 'transient',
    retryable: true,
    status,
    code,
    error: rawError,
    data: body,
  };
}

export async function runWithTransientRetry(
  attemptFn: (attemptIndex: number) => Promise<AuthAttemptOutcome>,
  options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    sleepFn?: (ms: number) => Promise<void>;
  }
): Promise<AuthAttemptOutcome> {
  const maxRetries = Math.max(0, options?.maxRetries ?? 2);
  const baseDelayMs = Math.max(0, options?.baseDelayMs ?? 400);
  const sleep =
    options?.sleepFn ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let lastOutcome: AuthAttemptOutcome = {
    kind: 'transient',
    retryable: true,
    error: 'Authentication failed.',
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      lastOutcome = await attemptFn(attempt);
    } catch (err: any) {
      lastOutcome = {
        kind: 'transient',
        retryable: true,
        error: err?.message || 'Network error while contacting authentication server.',
      };
    }

    if (!lastOutcome.retryable || attempt >= maxRetries) {
      return lastOutcome;
    }

    const delayMs = baseDelayMs * Math.pow(2, attempt);
    await sleep(delayMs);
  }

  return lastOutcome;
}

export function createSingleFlightRunner<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  let inFlight: Promise<TResult> | null = null;
  return (...args: TArgs) => {
    if (inFlight) {
      return inFlight;
    }
    const promise = fn(...args).finally(() => {
      inFlight = null;
    });
    inFlight = promise;
    return promise;
  };
}
