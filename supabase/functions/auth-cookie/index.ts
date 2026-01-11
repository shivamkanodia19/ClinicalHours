import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, createSession } from "../_shared/auth.ts";

interface AuthCookieRequest {
  accessToken: string;
  refreshToken?: string;
  rememberMe?: boolean; // If true, persist session across browser closes
}

// Session configuration
const SESSION_MAX_AGE = 30 * 60; // 30 minutes in seconds (for short-lived session cookie)
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 days for "remember me" (refresh token cookie)
const CSRF_TOKEN_LENGTH = 32;

// Generate a secure random token
async function generateSecureToken(length: number): Promise<string> {
  const array = new Uint8Array(length);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Generate CSRF token
async function generateCSRFToken(): Promise<string> {
  return generateSecureToken(CSRF_TOKEN_LENGTH);
}

// Create session cookie string
function createSessionCookie(sessionId: string, isProduction: boolean): string {
  const secureFlag = isProduction ? "; Secure" : "";
  return `session=${sessionId}; HttpOnly; SameSite=Lax${secureFlag}; Path=/; Max-Age=${SESSION_MAX_AGE}`;
}

// Create CSRF cookie string
function createCSRFCookie(token: string, isProduction: boolean): string {
  const secureFlag = isProduction ? "; Secure" : "";
  return `csrf-token=${token}; HttpOnly; SameSite=Lax${secureFlag}; Path=/; Max-Age=${SESSION_MAX_AGE}`;
}

// Create refresh token cookie string (long-lived for "remember me")
function createRefreshTokenCookie(refreshToken: string, isProduction: boolean): string {
  const secureFlag = isProduction ? "; Secure" : "";
  return `refresh-token=${refreshToken}; HttpOnly; SameSite=Lax${secureFlag}; Path=/; Max-Age=${REFRESH_TOKEN_MAX_AGE}`;
}

// Clear refresh token cookie
function clearRefreshTokenCookie(isProduction: boolean): string {
  const secureFlag = isProduction ? "; Secure" : "";
  return `refresh-token=; HttpOnly; SameSite=Lax${secureFlag}; Path=/; Max-Age=0`;
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate Origin header
  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    console.warn(`Origin validation failed: ${originValidation.error}`);
    return new Response(
      JSON.stringify({ error: "Invalid origin" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const { accessToken, refreshToken, rememberMe }: AuthCookieRequest = await req.json();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Access token required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role to verify token
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the JWT token and get user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      console.error('Invalid token:', userError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate session ID (secure random token)
    const sessionId = await generateSecureToken(64);
    
    // Generate CSRF token
    const csrfToken = await generateCSRFToken();

    // Store session in database
    const sessionResult = await createSession(
      user.id,
      sessionId,
      csrfToken,
      refreshToken,
      rememberMe,
      req
    );

    if (!sessionResult.success) {
      console.error("Failed to create session in database:", sessionResult.error);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Session created for user ${user.id} (rememberMe: ${rememberMe})`)

    // Determine if we're in production
    const isProduction = Deno.env.get("ENVIRONMENT") === "production" || 
                        !Deno.env.get("ENVIRONMENT");

    // Create cookie headers
    const sessionCookie = createSessionCookie(sessionId, isProduction);
    const csrfCookie = createCSRFCookie(csrfToken, isProduction);
    
    // Build cookies array
    const cookies = [sessionCookie, csrfCookie];
    
    // If "remember me" is enabled and we have a refresh token, store it in a persistent cookie
    if (rememberMe && refreshToken) {
      const refreshCookie = createRefreshTokenCookie(refreshToken, isProduction);
      cookies.push(refreshCookie);
    } else if (!rememberMe) {
      // Clear any existing refresh token cookie if user didn't opt for "remember me"
      cookies.push(clearRefreshTokenCookie(isProduction));
    }

    // Return response with cookies
    return new Response(
      JSON.stringify({ 
        success: true,
        csrfToken, // Return CSRF token for double-submit pattern
        user: {
          id: user.id,
          email: user.email,
        },
        rememberMe: !!rememberMe, // Echo back for confirmation
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookies.join(", "),
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Error in auth-cookie:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

