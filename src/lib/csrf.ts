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
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Store CSRF token in sessionStorage (temporary until we implement httpOnly cookies)
 */
export function storeCSRFToken(): string {
  const token = generateCSRFToken();
  sessionStorage.setItem('csrf_token', token);
  return token;
}

/**
 * Get CSRF token from sessionStorage
 */
export function getCSRFToken(): string | null {
  return sessionStorage.getItem('csrf_token');
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
  sessionStorage.removeItem('csrf_token');
}

