// CSRF Protection Utilities
// Note: For a SPA with Supabase, CSRF protection is primarily handled by:
// 1. Supabase's built-in JWT token validation
// 2. SameSite cookies (configured in Supabase)
// 3. Origin validation in edge functions
// This utility provides additional client-side CSRF token generation for extra security

/**
 * Generate a CSRF token (simple implementation)
 * In production, this should be generated server-side and stored in httpOnly cookie
 */
export function generateCSRFToken(): string {
  // Generate a random token
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch (error) {
    // Fallback if crypto is not available
  }
  // Fallback: use Math.random if crypto is not available
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/**
 * Store CSRF token in sessionStorage (temporary until we implement httpOnly cookies)
 */
export function storeCSRFToken(): string {
  try {
    const token = generateCSRFToken();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('csrf_token', token);
    }
    return token;
  } catch (error) {
    // If sessionStorage is not available, return a token anyway
    return generateCSRFToken();
  }
}

/**
 * Get CSRF token from sessionStorage
 */
export function getCSRFToken(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('csrf_token');
    }
  } catch (error) {
    // Ignore errors
  }
  return null;
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string | null): boolean {
  const storedToken = getCSRFToken();
  return storedToken !== null && storedToken === token;
}

/**
 * Clear CSRF token (on logout)
 */
export function clearCSRFToken(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('csrf_token');
    }
  } catch (error) {
    // Ignore errors
  }
}

