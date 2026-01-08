import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, getSessionCookie, parseCookies } from "../_shared/auth.ts";

/**
 * Get refresh token from httpOnly cookie
 */
function getRefreshTokenFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  const cookies = parseCookies(cookieHeader);
  return cookies["refresh-token"] || null;
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

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    // Get refresh token from httpOnly cookie (persistent "remember me" token)
    const refreshToken = getRefreshTokenFromCookie(req);

    if (!refreshToken) {
      return new Response(
        JSON.stringify({ success: false, error: "No session found" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use the refresh token to get a new access token
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    // Create a client to refresh the session
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Refresh the session using the stored refresh token
    const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (refreshError || !refreshData.session) {
      console.error("Failed to refresh session:", refreshError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Session expired. Please log in again." }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { session, user } = refreshData;

    // Return the new tokens so frontend can restore the Supabase session
    return new Response(
      JSON.stringify({ 
        success: true,
        user: {
          id: user?.id,
          email: user?.email,
        },
        accessToken: session.access_token,
        refreshToken: session.refresh_token, // New refresh token (tokens rotate)
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("Error in restore-session:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

