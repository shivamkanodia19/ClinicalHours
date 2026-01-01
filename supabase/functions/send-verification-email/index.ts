import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Validate API key is configured
if (!RESEND_API_KEY) {
  console.error("RESEND_API_KEY is not configured. Please set it in Supabase Edge Functions secrets.");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendVerificationEmailRequest {
  userId: string;
  email: string;
  fullName: string;
  origin: string;
}

// Rate limiting per user to prevent abuse
const userRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const USER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_EMAILS_PER_USER = 3; // Reduced to 3 verification emails per user per hour for security

function isUserRateLimited(userId: string): boolean {
  const now = Date.now();
  const record = userRateLimitMap.get(userId);

  if (!record || now > record.resetTime) {
    userRateLimitMap.set(userId, { count: 1, resetTime: now + USER_RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (record.count >= MAX_EMAILS_PER_USER) {
    return true;
  }

  record.count++;
  return false;
}

// Clean up old entries periodically
function cleanupRateLimitMap(): void {
  const now = Date.now();
  for (const [key, value] of userRateLimitMap.entries()) {
    if (now > value.resetTime) {
      userRateLimitMap.delete(key);
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Cleanup old entries occasionally
  if (Math.random() < 0.01) {
    cleanupRateLimitMap();
  }

  try {
    // Verify JWT - this function requires authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the JWT and get user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Invalid token or user not found:', userError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { userId, email, fullName, origin }: SendVerificationEmailRequest = await req.json();

    // Validate that the request is for the authenticated user (or user can only send to themselves)
    if (userId !== user.id) {
      console.error(`User ${user.id} attempted to send verification email for different user ${userId}`);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending verification email to ${email} for user ${userId}`);

    // Check rate limit
    if (isUserRateLimited(userId)) {
      console.warn(`Rate limit exceeded for user: ${userId}`);
      return new Response(
        JSON.stringify({ error: "Too many verification emails sent. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || email.length > 254) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate a secure token
    const verificationToken = crypto.randomUUID() + "-" + crypto.randomUUID();
    
    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Delete any existing tokens for this user
    await supabaseAdmin
      .from("email_verification_tokens")
      .delete()
      .eq("user_id", userId);

    // Insert new token
    const { error: insertError } = await supabaseAdmin
      .from("email_verification_tokens")
      .insert({
        user_id: userId,
        email: email,
        token: verificationToken,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error inserting token:", insertError);
      throw new Error("Failed to create verification token");
    }

    // Validate origin
    const allowedOrigins = [
      'https://sysbtcikrbrrgafffody.lovableproject.com',
      'https://lovable.dev',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8080',
    ];
    
    const isAllowedOrigin = origin && (
      allowedOrigins.includes(origin) || 
      origin.endsWith('.lovableproject.com') || 
      origin.endsWith('.lovable.dev')
    );
    
    const safeOrigin = isAllowedOrigin ? origin : allowedOrigins[0];
    const verificationLink = `${safeOrigin}/verify?token=${verificationToken}`;

    // Sanitize fullName for HTML
    const safeName = fullName
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    // Validate API key before attempting to send
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service is not configured. Please contact support." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send branded email via Resend HTTP API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ClinicalHours <support@clinicalhours.org>",
        to: [email],
        subject: "Verify your ClinicalHours account",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f8;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td align="center" style="padding: 40px 0;">
                  <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); border-radius: 16px 16px 0 0;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">ClinicalHours</h1>
                        <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Your Path to Clinical Experience</p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px; font-weight: 600;">Welcome, ${safeName}! 👋</h2>
                        <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                          Thank you for joining ClinicalHours! Please verify your email address to complete your registration and start discovering clinical opportunities.
                        </p>
                        
                        <!-- CTA Button -->
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td align="center" style="padding: 20px 0;">
                              <a href="${verificationLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
                                Verify Email Address
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                          This link will expire in 24 hours. If you didn't create an account with ClinicalHours, you can safely ignore this email.
                        </p>
                        
                        <!-- Alternative Link -->
                        <div style="margin-top: 24px; padding: 16px; background-color: #f9fafb; border-radius: 8px;">
                          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">If the button doesn't work, copy and paste this link:</p>
                          <p style="margin: 0; color: #7c3aed; font-size: 12px; word-break: break-all;">${verificationLink}</p>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 24px 40px; background-color: #f9fafb; border-radius: 0 0 16px 16px; text-align: center;">
                        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                          © ${new Date().getFullYear()} ClinicalHours. All rights reserved.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json().catch(() => ({}));
      console.error("Failed to send verification email:", errorData);
      
      // Provide helpful error messages for common issues
      let errorMessage = "Failed to send email";
      if (errorData.message) {
        if (errorData.message.includes("domain") || errorData.message.includes("Domain")) {
          errorMessage = "Email domain not verified. Please verify your domain in Resend dashboard.";
        } else if (errorData.message.includes("API key") || errorData.message.includes("Unauthorized")) {
          errorMessage = "Email service configuration error. Please contact support.";
        } else {
          errorMessage = errorData.message;
        }
      }
      
      throw new Error(errorMessage);
    }

    console.log("Verification email sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-verification-email function:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
