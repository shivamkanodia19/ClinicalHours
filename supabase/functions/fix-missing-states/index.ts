import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders, authenticateFromCookie, checkAdminRole } from "../_shared/auth.ts";

interface Opportunity {
  id: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
}

// Reverse geocode using Mapbox to get state from coordinates
async function getStateFromCoordinates(
  lat: number,
  lng: number,
  mapboxToken: string
): Promise<string | null> {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=region&access_token=${mapboxToken}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Mapbox API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      // The region feature contains the state
      const state = data.features[0].text;
      return state;
    }
    
    return null;
  } catch (error) {
    console.error("Error reverse geocoding:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Origin header
    const originValidation = validateOrigin(req);
    if (!originValidation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid origin" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Authenticate user
    const authResult = await authenticateFromCookie(req);
    if (!authResult.success || !authResult.user) {
      return new Response(
        JSON.stringify({ success: false, error: authResult.error || "Authentication required" }),
        { status: authResult.statusCode || 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const mapboxToken = Deno.env.get("MAPBOX_PUBLIC_TOKEN");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!mapboxToken) {
      throw new Error("MAPBOX_PUBLIC_TOKEN environment variable is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the action from query params
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "preview";
    const limit = parseInt(url.searchParams.get("limit") || "100");

    // Find opportunities where location doesn't contain a comma (missing state)
    // Also ensure they have valid coordinates
    const { data: opportunities, error: fetchError } = await supabase
      .from("opportunities")
      .select("id, location, latitude, longitude")
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (fetchError) {
      throw fetchError;
    }

    // Filter to only those missing a state (no comma in location)
    const missingState = (opportunities as Opportunity[]).filter(
      (opp) => opp.location && !opp.location.includes(",")
    );

    console.log(`Found ${missingState.length} opportunities missing state`);

    if (action === "preview") {
      // Just return the list of opportunities that need fixing
      return new Response(
        JSON.stringify({
          success: true,
          action: "preview",
          count: missingState.length,
          opportunities: missingState.slice(0, limit).map((opp) => ({
            id: opp.id,
            currentLocation: opp.location,
            coordinates: { lat: opp.latitude, lng: opp.longitude },
          })),
          message: `Found ${missingState.length} opportunities missing state. Use action=fix to update them.`,
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (action === "fix") {
      const results: Array<{
        id: string;
        oldLocation: string;
        newLocation: string;
        status: string;
      }> = [];
      
      let fixed = 0;
      let failed = 0;

      // Process in batches to respect rate limits
      const toProcess = missingState.slice(0, limit);
      
      for (const opp of toProcess) {
        if (!opp.latitude || !opp.longitude) {
          results.push({
            id: opp.id,
            oldLocation: opp.location,
            newLocation: opp.location,
            status: "skipped - no coordinates",
          });
          continue;
        }

        // Get state from coordinates
        const state = await getStateFromCoordinates(
          opp.latitude,
          opp.longitude,
          mapboxToken
        );

        if (state) {
          const newLocation = `${opp.location}, ${state}`;
          
          // Update the database
          const { error: updateError } = await supabase
            .from("opportunities")
            .update({ location: newLocation })
            .eq("id", opp.id);

          if (updateError) {
            console.error(`Error updating ${opp.id}:`, updateError);
            results.push({
              id: opp.id,
              oldLocation: opp.location,
              newLocation: opp.location,
              status: `failed - ${updateError.message}`,
            });
            failed++;
          } else {
            results.push({
              id: opp.id,
              oldLocation: opp.location,
              newLocation: newLocation,
              status: "fixed",
            });
            fixed++;
          }
        } else {
          results.push({
            id: opp.id,
            oldLocation: opp.location,
            newLocation: opp.location,
            status: "failed - could not reverse geocode",
          });
          failed++;
        }

        // Small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "fix",
          totalMissingState: missingState.length,
          processed: toProcess.length,
          fixed,
          failed,
          results,
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Invalid action. Use action=preview or action=fix",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const origin = req.headers.get("origin");
    const errorCorsHeaders = getCorsHeaders(origin);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...errorCorsHeaders },
      }
    );
  }
});

