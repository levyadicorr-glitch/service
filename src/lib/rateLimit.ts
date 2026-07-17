interface RateLimitInfo {
  attempts: number;
  resetTime: number;
}

const limits = new Map<string, RateLimitInfo>();

export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  let info = limits.get(key);

  if (!info || info.resetTime <= now) {
    info = { attempts: 0, resetTime: now + windowMs };
  }

  info.attempts++;
  limits.set(key, info);

  // Clean up expired entries (simple approach)
  for (const [k, v] of limits.entries()) {
    if (v.resetTime <= now) {
      limits.delete(k);
    }
  }

  if (info.attempts > maxAttempts) {
    return { allowed: false, retryAfterMs: info.resetTime - now };
  }

  return { allowed: true, retryAfterMs: 0 };
}
