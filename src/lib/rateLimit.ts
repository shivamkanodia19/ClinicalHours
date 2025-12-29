// Client-side rate limiting utility
// This provides basic protection, but server-side rate limiting should also be implemented
// 
// NOTE: Client-side rate limiting can be bypassed by:
// - Clearing browser storage/localStorage
// - Using incognito mode
// - Opening multiple tabs
// Server-side rate limiting (already implemented) is the real protection.

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const MAX_STORE_SIZE = 1000; // Limit map size to prevent memory leaks

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  
  // Clean up expired entries before checking
  cleanupExpiredEntries(now);
  
  // If store is too large, remove oldest entries
  if (rateLimitStore.size >= MAX_STORE_SIZE) {
    const entries = Array.from(rateLimitStore.entries());
    // Sort by reset time and remove oldest 20%
    entries.sort((a, b) => a[1].resetTime - b[1].resetTime);
    const toRemove = Math.floor(MAX_STORE_SIZE * 0.2);
    for (let i = 0; i < toRemove; i++) {
      rateLimitStore.delete(entries[i][0]);
    }
  }
  
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // Create new window
    const resetAt = now + windowMs;
    rateLimitStore.set(key, {
      count: 1,
      resetTime: resetAt,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt,
    };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetTime,
  };
}

function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up old entries periodically (every 30 seconds for better memory management)
setInterval(() => {
  cleanupExpiredEntries(Date.now());
}, 30000); // Clean up every 30 seconds

