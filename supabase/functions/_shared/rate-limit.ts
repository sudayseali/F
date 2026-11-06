// supabase/functions/_shared/rate-limit.ts
// Dual-layer distributed and in-memory rate limiting for Supabase Edge Functions

const memoryStore = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime?: number;
}

/**
 * Fast in-memory L1 sliding-window rate limit
 */
export function checkRateLimit(
  key: string,
  maxRequests = 30,
  windowMs = 60000
): RateLimitResult {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || now > record.resetTime) {
    memoryStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count, resetTime: record.resetTime };
}

/**
 * Distributed L2 PostgreSQL rate limit check
 * Coordinates rate limits across all distributed Edge Function instances and regions
 */
export async function checkDistributedRateLimit(
  supabaseClient: any,
  key: string,
  maxRequests = 30,
  windowSeconds = 60
): Promise<RateLimitResult> {
  // First run fast L1 check
  const localCheck = checkRateLimit(key, maxRequests, windowSeconds * 1000);
  if (!localCheck.allowed) {
    return localCheck;
  }

  try {
    const { data, error } = await supabaseClient.rpc('check_distributed_rate_limit', {
      p_key: key,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });

    if (error || !data) {
      // Graceful fallback to L1 in-memory check if table or RPC is not reachable
      console.warn('[RATE_LIMIT_DB_FALLBACK]', error?.message || 'RPC returned no data');
      return localCheck;
    }

    return {
      allowed: Boolean(data.allowed),
      remaining: typeof data.remaining === 'number' ? data.remaining : 0,
    };
  } catch (err: any) {
    console.warn('[RATE_LIMIT_EXCEPTION_FALLBACK]', err.message);
    return localCheck;
  }
}

// Clean up stale in-memory records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (now > value.resetTime) {
      memoryStore.delete(key);
    }
  }
}, 300000);
