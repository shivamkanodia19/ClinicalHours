import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { validateOrigin, getCorsHeaders } from "../_shared/auth.ts";

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_MAX_AGE = 30 * 60; // 30 minutes in seconds

// Generate a secure random token
async function generateSecureToken(length: number): Promise<string> {
  const array = new Uint8Array(length);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Create CSRF cookie string
function createCSRFCookie(token: string, isProduction: boolean): string {
  const secureFlag = isProduction ? "; Secure" : "";
  return `csrf-token=${token}; HttpOnly; SameSite=Lax${secureFlag}; Path=/; Max-Age=${CSRF_TOKEN_MAX_AGE}`;
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

  // Allow GET and POST for CSRF token retrieval
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    // Generate new CSRF token (rotate on each request for security)
    const csrfToken = await generateSecureToken(CSRF_TOKEN_LENGTH);

    // Determine if we're in production
    const isProduction = Deno.env.get("ENVIRONMENT") === "production" || 
                        !Deno.env.get("ENVIRONMENT");

    // Create cookie header
    const csrfCookie = createCSRFCookie(csrfToken, isProduction);

    // Return response with cookie and token in body (for double-submit pattern)
    return new Response(
      JSON.stringify({ 
        success: true,
        csrfToken, // Return token for X-CSRF-Token header
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": csrfCookie,
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Error in csrf-token:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

