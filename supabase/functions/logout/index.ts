import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { validateOrigin, getCorsHeaders } from "../_shared/auth.ts";

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

    // Clear both session and CSRF cookies
    const clearSessionCookie = createClearCookie("session", isProduction);
    const clearCSRFCookie = createClearCookie("csrf-token", isProduction);

    // TODO: Invalidate session in database if you're storing sessions server-side
    // For now, clearing cookies is sufficient

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
          "Set-Cookie": `${clearSessionCookie}, ${clearCSRFCookie}`,
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

