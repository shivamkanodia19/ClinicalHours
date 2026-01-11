import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS - restrict to production and development
const ALLOWED_ORIGINS = [
  "https://clinicalhours.org",
  "https://www.clinicalhours.org",
  "https://sysbtcikrbrrgafffody.lovableproject.com",
  "https://lovable.dev",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8086",
];

// Session configuration
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const REMEMBER_ME_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Rate limit configuration
interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
  blockDurationSeconds?: number;
  maxFailedAttempts?: number;
}

// Default rate limit configs for different use cases
export const RATE_LIMIT_CONFIGS = {
  PASSWORD_RESET: { windowSeconds: 3600, maxRequests: 3, blockDurationSeconds: 1800, maxFailedAttempts: 5 },
  CONTACT_FORM: { windowSeconds: 60, maxRequests: 3 },
  ADMIN_IMPORT: { windowSeconds: 3600, maxRequests: 5 },
  LOGIN: { windowSeconds: 300, maxRequests: 10, blockDurationSeconds: 900, maxFailedAttempts: 5 },
} as const;

export interface AuthResult {
  success: boolean;
  user?: { id: string; email?: string };
  error?: string;
  statusCode?: number;
}

export interface CSRFResult {
  valid: boolean;
  error?: string;
}

/**
 * Parse cookies from request headers
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name && rest.length > 0) {
      cookies[name.trim()] = rest.join('=').trim();
    }
  });

  return cookies;
}

/**
 * Get session cookie from request
 */
export function getSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  const cookies = parseCookies(cookieHeader);
  return cookies.session || null;
}

/**
 * Get CSRF token from cookie
 */
export function getCSRFTokenFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  const cookies = parseCookies(cookieHeader);
  return cookies["csrf-token"] || null;
}

/**
 * Get CSRF token from header (double-submit pattern)
 */
export function getCSRFTokenFromHeader(req: Request): string | null {
  return req.headers.get("x-csrf-token");
}

/**
 * Validate CSRF token using double-submit cookie pattern
 */
export function validateCSRFToken(req: Request): CSRFResult {
  // Only validate CSRF for state-changing methods
  const stateChangingMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (!stateChangingMethods.includes(req.method)) {
    return { valid: true };
  }

  const cookieToken = getCSRFTokenFromCookie(req);
  const headerToken = getCSRFTokenFromHeader(req);

  if (!cookieToken || !headerToken) {
    return {
      valid: false,
      error: "CSRF token missing"
    };
  }

  if (cookieToken !== headerToken) {
    return {
      valid: false,
      error: "CSRF token mismatch"
    };
  }

  return { valid: true };
}

/**
 * Validate Origin/Referer headers
 */
export function validateOrigin(req: Request): { valid: boolean; error?: string } {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // For same-origin requests, origin might be null (browsers don't always send it)
  // In that case, check referer
  const source = origin || (referer ? new URL(referer).origin : null);

  if (!source) {
    // Allow requests without origin/referer for same-origin requests
    // This handles cases where browsers don't send these headers
    return { valid: true };
  }

  // Check if origin matches allowed origins
  const isAllowed = ALLOWED_ORIGINS.some(allowed =>
    source === allowed ||
    source.endsWith('.lovableproject.com') ||
    source.endsWith('.lovable.dev') ||
    source.endsWith('.lovable.app') ||
    source.endsWith('.clinicalhours.org')
  );

  if (!isAllowed) {
    return {
      valid: false,
      error: `Origin ${source} is not allowed`
    };
  }

  return { valid: true };
}

/**
 * Get Supabase admin client (singleton pattern for reuse)
 */
function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Create a new session in the database
 */
export async function createSession(
  userId: string,
  sessionToken: string,
  csrfToken: string,
  refreshToken?: string,
  rememberMe: boolean = false,
  req?: Request
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const expiresAt = new Date(Date.now() + (rememberMe ? REMEMBER_ME_DURATION_MS : SESSION_DURATION_MS));
    
    const userAgent = req?.headers.get("user-agent") || null;
    const ipAddress = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                      req?.headers.get("cf-connecting-ip") || null;

    const { error } = await supabase
      .from("sessions")
      .insert({
        user_id: userId,
        session_token: sessionToken,
        csrf_token: csrfToken,
        refresh_token: refreshToken || null,
        expires_at: expiresAt.toISOString(),
        remember_me: rememberMe,
        user_agent: userAgent,
        ip_address: ipAddress,
      });

    if (error) {
      console.error("Error creating session:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Exception creating session:", error);
    return { success: false, error: "Failed to create session" };
  }
}

/**
 * Validate session from database and return user info
 */
export async function validateSession(sessionToken: string): Promise<AuthResult> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: session, error } = await supabase
      .from("sessions")
      .select("user_id, csrf_token, expires_at, remember_me")
      .eq("session_token", sessionToken)
      .single();

    if (error || !session) {
      return { success: false, error: "Invalid session", statusCode: 401 };
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      // Delete expired session
      await supabase.from("sessions").delete().eq("session_token", sessionToken);
      return { success: false, error: "Session expired", statusCode: 401 };
    }

    // Update last activity timestamp
    await supabase
      .from("sessions")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("session_token", sessionToken);

    // Get user info
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(session.user_id);
    
    if (userError || !user) {
      return { success: false, error: "User not found", statusCode: 401 };
    }

    return {
      success: true,
      user: { id: user.id, email: user.email }
    };
  } catch (error) {
    console.error("Exception validating session:", error);
    return { success: false, error: "Session validation failed", statusCode: 500 };
  }
}

/**
 * Delete a session from the database
 */
export async function deleteSession(sessionToken: string): Promise<{ success: boolean }> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("sessions").delete().eq("session_token", sessionToken);
    return { success: true };
  } catch (error) {
    console.error("Error deleting session:", error);
    return { success: false };
  }
}

/**
 * Delete all sessions for a user (logout from all devices)
 */
export async function deleteAllUserSessions(userId: string): Promise<{ success: boolean }> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("sessions").delete().eq("user_id", userId);
    return { success: true };
  } catch (error) {
    console.error("Error deleting user sessions:", error);
    return { success: false };
  }
}

/**
 * Authenticate user from session cookie (database-backed)
 */
export async function authenticateFromCookie(req: Request): Promise<AuthResult> {
  const sessionToken = getSessionCookie(req);

  // Try session cookie first (database-backed)
  if (sessionToken) {
    const sessionResult = await validateSession(sessionToken);
    if (sessionResult.success) {
      return sessionResult;
    }
  }

  // Fallback to Authorization header (JWT) for gradual migration
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    
    const supabaseAdmin = getSupabaseAdmin();
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return {
        success: false,
        error: "Invalid authentication token",
        statusCode: 401
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
      }
    };
  }

  return {
    success: false,
    error: "Authentication required",
    statusCode: 401
  };
}

// ===========================================
// DATABASE-BACKED RATE LIMITING
// ===========================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  blocked: boolean;
  blockReason?: string;
}

/**
 * Check rate limit using database storage
 * @param key - Unique key for rate limiting (e.g., "ip:192.168.1.1" or "email:user@example.com")
 * @param config - Rate limit configuration
 * @returns RateLimitResult
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();

    // Try to get existing rate limit record
    const { data: existing, error: fetchError } = await supabase
      .from("rate_limits")
      .select("*")
      .eq("key", key)
      .single();

    // Check if blocked
    if (existing?.blocked_until && new Date(existing.blocked_until) > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(existing.blocked_until),
        blocked: true,
        blockReason: "Too many failed attempts. Please try again later."
      };
    }

    // Calculate window end time
    const windowEnd = existing 
      ? new Date(new Date(existing.window_start).getTime() + (existing.window_duration_seconds * 1000))
      : new Date(now.getTime() + (config.windowSeconds * 1000));

    // Check if we're still in the same window
    if (existing && windowEnd > now) {
      // Same window - check if limit exceeded
      if (existing.count >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: windowEnd,
          blocked: false,
          blockReason: "Rate limit exceeded. Please try again later."
        };
      }

      // Increment counter
      const { error: updateError } = await supabase
        .from("rate_limits")
        .update({ 
          count: existing.count + 1,
          updated_at: now.toISOString()
        })
        .eq("key", key);

      if (updateError) {
        console.error("Error updating rate limit:", updateError);
      }

      return {
        allowed: true,
        remaining: config.maxRequests - existing.count - 1,
        resetAt: windowEnd,
        blocked: false
      };
    }

    // New window or no existing record - create/reset
    const { error: upsertError } = await supabase
      .from("rate_limits")
      .upsert({
        key,
        count: 1,
        window_start: now.toISOString(),
        window_duration_seconds: config.windowSeconds,
        failed_attempts: 0,
        blocked_until: null,
        updated_at: now.toISOString()
      }, { onConflict: "key" });

    if (upsertError) {
      console.error("Error upserting rate limit:", upsertError);
    }

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: new Date(now.getTime() + (config.windowSeconds * 1000)),
      blocked: false
    };
  } catch (error) {
    console.error("Rate limit check error:", error);
    // On error, allow the request (fail open) but log it
    return {
      allowed: true,
      remaining: -1,
      resetAt: new Date(),
      blocked: false
    };
  }
}

/**
 * Record a failed attempt (for blocking after too many failures)
 */
export async function recordFailedAttempt(
  key: string,
  config: RateLimitConfig
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const maxFailed = config.maxFailedAttempts || 5;
    const blockDuration = config.blockDurationSeconds || 1800; // 30 minutes default

    const { data: existing } = await supabase
      .from("rate_limits")
      .select("failed_attempts")
      .eq("key", key)
      .single();

    const newFailedCount = (existing?.failed_attempts || 0) + 1;
    const shouldBlock = newFailedCount >= maxFailed;

    await supabase
      .from("rate_limits")
      .upsert({
        key,
        count: 1,
        window_start: now.toISOString(),
        window_duration_seconds: config.windowSeconds,
        failed_attempts: newFailedCount,
        blocked_until: shouldBlock ? new Date(now.getTime() + (blockDuration * 1000)).toISOString() : null,
        updated_at: now.toISOString()
      }, { onConflict: "key" });

    if (shouldBlock) {
      console.warn(`Rate limit key ${key} blocked for ${blockDuration} seconds after ${newFailedCount} failed attempts`);
    }
  } catch (error) {
    console.error("Error recording failed attempt:", error);
  }
}

/**
 * Clear failed attempts (e.g., after successful authentication)
 */
export async function clearFailedAttempts(key: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from("rate_limits")
      .update({ failed_attempts: 0, blocked_until: null })
      .eq("key", key);
  } catch (error) {
    console.error("Error clearing failed attempts:", error);
  }
}

/**
 * Get CORS headers with proper origin
 * IMPORTANT: With credentials: 'include', Access-Control-Allow-Origin MUST be the exact origin, not '*'
 * This function should only be called after validating the origin is allowed
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  // Check if origin is allowed
  const isAllowed = origin && ALLOWED_ORIGINS.some(allowed =>
    origin === allowed ||
    origin.endsWith('.lovableproject.com') ||
    origin.endsWith('.lovable.dev') ||
    origin.endsWith('.lovable.app') ||
    origin.endsWith('.clinicalhours.org')
  );

  // For credentials: 'include', we MUST return the exact origin, not '*' or a fallback
  // If origin is not allowed, return the first allowed origin as fallback (but this should be validated before calling)
  // NEVER return '*' when credentials are included
  const allowedOrigin = isAllowed && origin ? origin : ALLOWED_ORIGINS[0];

  return {
    // CORS headers
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-csrf-token",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    // Security headers - prevent clickjacking
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "frame-ancestors 'none'",
    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",
    // Enforce HTTPS (1 year)
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    // Control referrer information
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Prevent XSS attacks in older browsers
    "X-XSS-Protection": "1; mode=block",
  };
}

/**
 * Check if user has admin role
 */
export async function checkAdminRole(userId: string): Promise<{ isAdmin: boolean; error?: string }> {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      return { isAdmin: false, error: "Admin access required" };
    }

    return { isAdmin: true };
  } catch (error) {
    console.error("Error checking admin role:", error);
    return { isAdmin: false, error: "Failed to verify admin role" };
  }
}

