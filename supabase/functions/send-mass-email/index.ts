import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, checkAdminRole } from "../_shared/auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface MassEmailRequest {
  subject: string;
  body: string;
}

// HTML escape function to prevent XSS
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Convert line breaks to HTML
function formatBodyHtml(body: string): string {
  return escapeHtml(body).replace(/\n/g, "<br>");
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate Origin
  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    console.warn(`Origin validation failed: ${originValidation.error}`);
    return new Response(
      JSON.stringify({ success: false, error: "Invalid origin" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify user token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check admin role
    const { isAdmin, error: adminError } = await checkAdminRole(user.id);
    if (!isAdmin) {
      console.warn(`Non-admin user ${user.email} attempted to send mass email`);
      return new Response(
        JSON.stringify({ success: false, error: adminError || "Admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse request body
    let payload: MassEmailRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const { subject, body } = payload;

    // Validate inputs
    if (!subject || !subject.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Email subject is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!body || !body.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Email body is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate API key
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get all opted-in users with their emails (paginate to avoid missing data)
    const profiles: Array<{ id: string; full_name: string | null }> = [];
    const PROFILE_PAGE_SIZE = 1000;
    for (let offset = 0; ; offset += PROFILE_PAGE_SIZE) {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .eq("email_opt_in", true)
        .range(offset, offset + PROFILE_PAGE_SIZE - 1);

      if (error) {
        console.error("Error fetching profiles:", error);
        throw new Error("Failed to fetch subscribers");
      }

      if (!data || data.length === 0) {
        break;
      }

      profiles.push(...data);
      if (data.length < PROFILE_PAGE_SIZE) {
        break;
      }
    }

    if (profiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscribers found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get emails from auth.users for each profile (paginate and short-circuit)
    const userIds = new Set(profiles.map((p) => p.id));
    const userEmailMap = new Map<string, string>();
    const USER_PAGE_SIZE = 1000;
    for (let page = 1; ; page += 1) {
      const { data: authUsers, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: USER_PAGE_SIZE,
      });

      if (authUsersError) {
        console.error("Error fetching auth users:", authUsersError);
        throw new Error("Failed to fetch user emails");
      }

      const users = authUsers?.users ?? [];
      if (users.length === 0) {
        break;
      }

      for (const user of users) {
        if (user.email && userIds.has(user.id)) {
          userEmailMap.set(user.id, user.email);
          if (userEmailMap.size === userIds.size) {
            break;
          }
        }
      }

      if (users.length < USER_PAGE_SIZE || userEmailMap.size === userIds.size) {
        break;
      }
    }

    // Build list of subscribers with emails
    const subscribers = profiles
      .map((p) => ({
        id: p.id,
        name: p.full_name || "User",
        email: userEmailMap.get(p.id),
      }))
      .filter((s) => s.email);

    console.log(`Sending mass email to ${subscribers.length} subscribers`);

    // Send emails (batch to avoid rate limits)
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Resend supports batch sending up to 100 emails at a time
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);
      
      // Send individual emails in the batch
      for (const subscriber of batch) {
        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "ClinicalHours <updates@clinicalhours.org>",
              to: [subscriber.email],
              subject: subject,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #1a1a2e;">Hi ${escapeHtml(subscriber.name)},</h2>
                  <div style="line-height: 1.6; color: #333;">
                    ${formatBodyHtml(body)}
                  </div>
                  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
                  <p style="font-size: 12px; color: #888;">
                    You're receiving this email because you opted in to updates from ClinicalHours.
                    <br />
                    To unsubscribe, go to your <a href="https://clinicalhours.org/profile" style="color: #3b82f6;">profile settings</a>.
                  </p>
                </div>
              `,
            }),
          });

          if (emailResponse.ok) {
            sent++;
          } else {
            const errorData = await emailResponse.json().catch(() => ({}));
            console.error(`Failed to send to ${subscriber.email}:`, errorData);
            failed++;
            if (errors.length < 5) {
              errors.push(`${subscriber.email}: ${errorData.message || "Unknown error"}`);
            }
          }
        } catch (err) {
          console.error(`Error sending to ${subscriber.email}:`, err);
          failed++;
        }

        // Small delay between emails to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Delay between batches
      if (i + BATCH_SIZE < subscribers.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`Mass email complete: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total: subscribers.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in send-mass-email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send emails",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
