import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, checkAdminRole } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface GetUsersRequest {
  userIds?: string[];
  page?: number;
  pageSize?: number;
  searchTerm?: string;
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
      console.warn(`Non-admin user ${user.email} attempted to access user list`);
      return new Response(
        JSON.stringify({ success: false, error: adminError || "Admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse request body
    let payload: GetUsersRequest;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { userIds, page, pageSize, searchTerm } = payload;
    const currentPage = Math.max(1, Math.floor(Number(page || 1)));
    const perPage = Math.min(100, Math.max(1, Math.floor(Number(pageSize || 20))));
    const search = (searchTerm || "").trim();

    // Fetch profiles with pagination (service role bypasses RLS)
    let profileQuery = supabaseAdmin
      .from("profiles")
      .select(
        "id, full_name, university, major, graduation_year, city, state, phone, clinical_hours, email_opt_in, email_verified, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range((currentPage - 1) * perPage, currentPage * perPage - 1);

    if (search) {
      profileQuery = profileQuery.or(
        `full_name.ilike.%${search}%,university.ilike.%${search}%,major.ilike.%${search}%`
      );
    }

    if (userIds && userIds.length > 0) {
      profileQuery = profileQuery.in("id", userIds);
    }

    const { data: profiles, error: profilesError, count } = await profileQuery;
    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw new Error("Failed to fetch profiles");
    }

    const profileIds = new Set((profiles || []).map((p) => p.id));
    const emailMap: Record<string, string> = {};

    if (profileIds.size > 0) {
      // Fetch auth users with pagination and map emails
      const AUTH_PAGE_SIZE = 1000;
      for (let pageIndex = 1; ; pageIndex += 1) {
        const { data: authData, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers({
          page: pageIndex,
          perPage: AUTH_PAGE_SIZE,
        });

        if (authUsersError) {
          console.error("Error fetching auth users:", authUsersError);
          throw new Error("Failed to fetch users");
        }

        const users = authData?.users ?? [];
        if (users.length === 0) break;

        for (const user of users) {
          if (user.email && profileIds.has(user.id)) {
            emailMap[user.id] = user.email;
          }
        }

        if (users.length < AUTH_PAGE_SIZE || Object.keys(emailMap).length === profileIds.size) {
          break;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        profiles: profiles || [],
        emails: emailMap,
        total: count || 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in admin-get-users:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch users",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
