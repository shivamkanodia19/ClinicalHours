import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCSRFToken, validateOrigin, getCorsHeaders, authenticateFromCookie, checkAdminRole } from "../_shared/auth.ts";

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate Origin header
  const originValidation = validateOrigin(req);
  if (!originValidation.valid) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid origin" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Validate CSRF token
  const csrfValidation = validateCSRFToken(req);
  if (!csrfValidation.valid) {
    return new Response(
      JSON.stringify({ success: false, error: csrfValidation.error || "CSRF validation failed" }),
      { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    // Authenticate user
    const authResult = await authenticateFromCookie(req);
    if (!authResult.success || !authResult.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check admin role
    const adminCheck = await checkAdminRole(authResult.user.id);
    if (!adminCheck.isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all opportunities
    const { data: opportunities, error: fetchError } = await supabase
      .from("opportunities")
      .select("id, name, location, created_at")
      .order("created_at", { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    if (!opportunities || opportunities.length === 0) {
      return new Response(
        JSON.stringify({ success: true, removed: 0, message: "No opportunities found" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Group by name + location (case-insensitive)
    const groups = new Map<string, typeof opportunities>();
    for (const opp of opportunities) {
      const key = `${opp.name.toLowerCase().trim()}|${opp.location.toLowerCase().trim()}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(opp);
    }

    // Find duplicates (keep oldest, remove rest)
    const idsToRemove: string[] = [];
    const duplicateGroups: Array<{ name: string; location: string; keep: string; remove: string[] }> = [];

    for (const [key, records] of groups.entries()) {
      if (records.length > 1) {
        const keep = records[0]; // Oldest
        const remove = records.slice(1);
        idsToRemove.push(...remove.map(r => r.id));
        duplicateGroups.push({
          name: keep.name,
          location: keep.location,
          keep: keep.id,
          remove: remove.map(r => r.id),
        });
      }
    }

    if (idsToRemove.length === 0) {
      return new Response(
        JSON.stringify({ success: true, removed: 0, message: "No duplicates found" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Delete duplicates in batches
    const BATCH_SIZE = 100;
    let removed = 0;
    const errors: string[] = [];

    for (let i = 0; i < idsToRemove.length; i += BATCH_SIZE) {
      const batch = idsToRemove.slice(i, i + BATCH_SIZE);
      const { error: deleteError } = await supabase
        .from("opportunities")
        .delete()
        .in("id", batch);

      if (deleteError) {
        errors.push(`Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${deleteError.message}`);
      } else {
        removed += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        removed,
        duplicateGroups: duplicateGroups.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error removing duplicates:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

