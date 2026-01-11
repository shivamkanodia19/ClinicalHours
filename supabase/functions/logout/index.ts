import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { validateOrigin, getCorsHeaders, getSessionCookie, deleteSession } from "../_shared/auth.ts";

// Create cookie clearing strings
function createClearCookie(name: string, isProduction: boolean): string {
  const secureFlag = isProduction ? "; Secure" : "";
  return `${name}=; HttpOnly; SameSite=Lax${secureFlag}; Path=/; Max-Age=0`;
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
    // Determine if we're in production
    const isProduction = Deno.env.get("ENVIRONMENT") === "production" || 
                        !Deno.env.get("ENVIRONMENT");

    // Clear session, CSRF, and refresh token cookies
    const clearSessionCookie = createClearCookie("session", isProduction);
    const clearCSRFCookie = createClearCookie("csrf-token", isProduction);
    const clearRefreshTokenCookie = createClearCookie("refresh-token", isProduction);

    // Invalidate session in database
    const sessionToken = getSessionCookie(req);
    if (sessionToken) {
      const deleteResult = await deleteSession(sessionToken);
      if (deleteResult.success) {
        console.log("Session deleted from database");
      } else {
        console.warn("Failed to delete session from database (continuing with cookie clear)");
      }
    }

    // Return response with cleared cookies
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Logged out successfully"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `${clearSessionCookie}, ${clearCSRFCookie}, ${clearRefreshTokenCookie}`,
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Error in logout:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

