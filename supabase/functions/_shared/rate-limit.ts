// supabase/functions/_shared/rate-limit.ts
// In-memory token bucket / sliding window rate limiting for Edge Functions

const requestCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * Validates whether an IP or identifier has exceeded allowed requests
 * @param key Identifier (e.g., client IP or user ID)
 * @param maxRequests Maximum requests allowed within window
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(key: string, maxRequests = 30, windowMs = 60000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = requestCounts.get(key);

  if (!record || now > record.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: maxRequests - record.count };
}

// Cleanup stale keys every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 300000);
