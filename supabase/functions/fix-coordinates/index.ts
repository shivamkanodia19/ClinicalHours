import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateCSRFToken, validateOrigin, getCorsHeaders, authenticateFromCookie, checkAdminRole } from "../_shared/auth.ts";

const MAPBOX_TOKEN = Deno.env.get("MAPBOX_PUBLIC_TOKEN") || "";

async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  if (!MAPBOX_TOKEN) {
    console.error("MAPBOX_PUBLIC_TOKEN not configured");
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_TOKEN}&country=US&limit=1`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return { latitude, longitude };
    }
    return null;
  } catch (error) {
    console.error(`Geocoding error for ${address}:`, error);
    return null;
  }
}

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

    const { opportunityIds, batchSize = 10 } = await req.json().catch(() => ({}));

    // Get opportunities missing coordinates or with invalid coordinates
    let query = supabase
      .from("opportunities")
      .select("id, name, location, address, latitude, longitude");

    if (opportunityIds && Array.isArray(opportunityIds) && opportunityIds.length > 0) {
      query = query.in("id", opportunityIds);
    } else {
      // Get all opportunities - we'll filter invalid coords client-side
      query = query.select("id, name, location, address, latitude, longitude");
    }

    const { data: opportunities, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!opportunities || opportunities.length === 0) {
      return new Response(
        JSON.stringify({ success: true, geocoded: 0, message: "No opportunities found" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Filter opportunities that need geocoding
    const needsGeocoding = opportunities.filter(opp => {
      const lat = opp.latitude;
      const lon = opp.longitude;
      // Check if coordinates are valid (within US bounds roughly)
      const isValid = lat !== null && lon !== null && 
                     !isNaN(lat) && !isNaN(lon) &&
                     lat >= 24 && lat <= 50 && // US latitude range
                     lon >= -130 && lon <= -65; // US longitude range
      return !isValid;
    });

    if (needsGeocoding.length === 0) {
      return new Response(
        JSON.stringify({ success: true, geocoded: 0, message: "All opportunities have valid coordinates" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Geocode missing coordinates
    let geocoded = 0;
    let failed = 0;
    const updates: Array<{ id: string; latitude: number; longitude: number }> = [];

    for (let i = 0; i < Math.min(needsGeocoding.length, batchSize || 10); i++) {
      const opp = needsGeocoding[i];
      
      // Build address string
      const addressParts = [];
      if (opp.address) addressParts.push(opp.address);
      if (opp.location) addressParts.push(opp.location);
      const address = addressParts.join(', ') || opp.location || opp.name;

      const coords = await geocodeAddress(address);

      if (coords) {
        updates.push({
          id: opp.id,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        geocoded++;
      } else {
        failed++;
      }

      // Rate limiting
      if (i < needsGeocoding.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Update opportunities in batch
    if (updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from("opportunities")
          .update({
            latitude: update.latitude,
            longitude: update.longitude,
          })
          .eq("id", update.id);

        if (updateError) {
          console.error(`Error updating ${update.id}:`, updateError);
          failed++;
          geocoded--;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        geocoded,
        failed,
        remaining: needsGeocoding.length - geocoded,
        processed: Math.min(needsGeocoding.length, batchSize || 10),
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error fixing coordinates:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

