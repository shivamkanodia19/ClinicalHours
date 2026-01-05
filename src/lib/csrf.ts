// CSRF Protection Utilities
// Implements double-submit cookie pattern for CSRF protection
// CSRF token is stored in httpOnly cookie (set by backend) and sent in X-CSRF-Token header

import { getCSRFToken as getCSRFTokenFromAuth } from "@/hooks/useAuth";
import { getCSRFToken as fetchCSRFToken } from "@/lib/authCookie";

/**
 * Get CSRF token for use in request headers
 * Token is stored in memory after login (from auth hook)
 * Falls back to fetching from backend if not available
 */
export async function getCSRFToken(): Promise<string | null> {
  // First try to get from auth hook (in-memory)
  const token = getCSRFTokenFromAuth();
  if (token) {
    console.log('[CSRF] Got token from auth hook (in-memory)');
    return token;
  }

  // If not available, fetch from backend
  try {
    console.log('[CSRF] Token not in memory, fetching from backend...');
    const fetchedToken = await fetchCSRFToken();
    if (fetchedToken) {
      console.log('[CSRF] Successfully fetched token from backend');
    } else {
      console.warn('[CSRF] Backend returned null token');
    }
    return fetchedToken;
  } catch (error) {
    console.error("Error fetching CSRF token:", error);
    return null;
  }
}

/**
 * Get CSRF token synchronously (from in-memory storage)
 * Returns null if not available - use async getCSRFToken() for guaranteed token
 */
export function getCSRFTokenSync(): string | null {
  return getCSRFTokenFromAuth();
}

/**
 * Clear CSRF token (on logout)
 * Note: Cookie is cleared by backend logout endpoint
 * This just clears in-memory token
 */
export function clearCSRFToken(): void {
  // Token is stored in auth hook, will be cleared on logout
  // This function is kept for API compatibility
}

