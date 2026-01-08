import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  validateCSRFToken, 
  validateOrigin, 
  getCorsHeaders, 
  checkRateLimit, 
  recordFailedAttempt as recordDbFailedAttempt,
  clearFailedAttempts
} from "../_shared/auth.ts";

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// Rate limit config for password reset
const RESET_PASSWORD_RATE_LIMIT = {
  windowSeconds: 60,
  maxRequests: 5,
  blockDurationSeconds: 1800, // 30 minutes
  maxFailedAttempts: 5
};

// Validate password strength
// Requirements: letters and numbers (both required) and at least 8 characters
function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  // Minimum length: 8 characters
  if (password.length < 8) {
    return { valid: false, error: "Use letters and numbers (both required) and at least 8 digits" };
  }

  // Maximum length: 128 characters
  if (password.length > 128) {
    return { valid: false, error: "Use letters and numbers (both required) and at least 8 digits" };
  }

  // Check for letters
  const hasLetter = /[a-zA-Z]/.test(password);
  // Check for numbers
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    return { valid: false, error: "Use letters and numbers (both required) and at least 8 digits" };
  }

  return { valid: true };
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

  // Validate CSRF token for POST requests
  const csrfValidation = validateCSRFToken(req);
  if (!csrfValidation.valid) {
    console.warn(`CSRF validation failed: ${csrfValidation.error}`);
    return new Response(
      JSON.stringify({ error: csrfValidation.error || "CSRF validation failed" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Get client IP for rate limiting
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                   req.headers.get("cf-connecting-ip") || 
                   "unknown";

  // Check rate limit (using database-backed rate limiting)
  const rateLimitKey = `reset_password:${clientIp}`;
  const rateLimitResult = await checkRateLimit(rateLimitKey, RESET_PASSWORD_RATE_LIMIT);
  
  if (!rateLimitResult.allowed) {
    console.warn(`Rate limit/block for IP ${clientIp}: ${rateLimitResult.blockReason}`);
    return new Response(
      JSON.stringify({ error: rateLimitResult.blockReason || "Too many requests. Please try again later." }),
      { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const { token, newPassword }: ResetPasswordRequest = await req.json();

    console.log("Processing password reset with token");

    // Validate token format
    if (!token || typeof token !== 'string' || token.length < 10 || token.length > 200) {
      await recordDbFailedAttempt(rateLimitKey, RESET_PASSWORD_RATE_LIMIT);
      return new Response(
        JSON.stringify({ error: "Invalid token format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate password
    if (!newPassword || typeof newPassword !== 'string') {
      return new Response(
        JSON.stringify({ error: "Use letters and numbers (both required) and at least 8 digits" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return new Response(
        JSON.stringify({ error: passwordValidation.error }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find the token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("password_reset_tokens")
      .select("*")
      .eq("token", token)
      .eq("used", false)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token not found or already used:", tokenError);
      await recordDbFailedAttempt(rateLimitKey, RESET_PASSWORD_RATE_LIMIT);
      return new Response(
        JSON.stringify({ error: "Invalid or expired reset link" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      console.log("Token expired");
      return new Response(
        JSON.stringify({ error: "Reset link has expired. Please request a new one." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      tokenData.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      throw new Error("Failed to update password");
    }

    // Mark token as used
    await supabaseAdmin
      .from("password_reset_tokens")
      .update({ used: true })
      .eq("id", tokenData.id);

    console.log("Password reset successful for user:", tokenData.user_id);

    return new Response(
      JSON.stringify({ success: true, message: "Password reset successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in reset-password function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
