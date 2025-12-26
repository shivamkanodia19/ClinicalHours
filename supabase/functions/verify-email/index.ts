import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyEmailRequest {
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token }: VerifyEmailRequest = await req.json();

    console.log(`Verifying email with token: ${token.substring(0, 8)}...`);

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
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
      .from("email_verification_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token not found:", tokenError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired verification link" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if already verified
    if (tokenData.verified_at) {
      return new Response(
        JSON.stringify({ error: "Email already verified", alreadyVerified: true }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      console.error("Token expired");
      return new Response(
        JSON.stringify({ error: "Verification link has expired. Please request a new one." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Mark token as verified
    const { error: updateTokenError } = await supabaseAdmin
      .from("email_verification_tokens")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    if (updateTokenError) {
      console.error("Error updating token:", updateTokenError);
      throw new Error("Failed to verify email");
    }

    // Update user profile to mark email as verified
    const { error: updateProfileError } = await supabaseAdmin
      .from("profiles")
      .update({ email_verified: true })
      .eq("id", tokenData.user_id);

    if (updateProfileError) {
      console.error("Error updating profile:", updateProfileError);
      // Don't throw - token is already marked verified
    }

    console.log(`Email verified successfully for user ${tokenData.user_id}`);

    return new Response(
      JSON.stringify({ success: true, email: tokenData.email }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in verify-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
