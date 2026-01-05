import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateOrigin, getCorsHeaders } from "../_shared/auth.ts";

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
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`Geocoding API error for "${address}": ${response.status} ${response.statusText} - ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      console.log(`Successfully geocoded "${address}" to (${latitude}, ${longitude})`);
      return { latitude, longitude };
    } else {
      console.warn(`No geocoding results found for "${address}"`);
      return null;
    }
  } catch (error) {
    console.error(`Geocoding exception for "${address}":`, error);
    return null;
  }
}

// Build address string with priority: address > location > name
function buildAddressString(opp: { address: string | null; location: string; name: string }): string {
  const addressParts: string[] = [];
  
  // Prioritize full address if available
  if (opp.address && opp.address.trim()) {
    addressParts.push(opp.address.trim());
  }
  
  // Add location if available and not already included in address
  if (opp.location && opp.location.trim()) {
    const locationLower = opp.location.trim().toLowerCase();
    if (!opp.address || !opp.address.toLowerCase().includes(locationLower)) {
      addressParts.push(opp.location.trim());
    }
  }
  
  // Use name as fallback if we have nothing else
  if (addressParts.length === 0 && opp.name && opp.name.trim()) {
    return opp.name.trim();
  }
  
  return addressParts.join(', ') || opp.location || opp.name || 'Unknown';
}

// Check if coordinates are valid (within US bounds roughly)
function isValidCoordinate(lat: number | null, lon: number | null): boolean {
  if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
    return false;
  }
  // US latitude range: ~24°N to 50°N
  // US longitude range: ~-130°W to -65°W
  return lat >= 24 && lat <= 50 && lon >= -130 && lon <= -65;
}

// Find duplicate coordinates - opportunities sharing the same lat/long
function findDuplicateCoordinates(opportunities: Array<{ id: string; latitude: number | null; longitude: number | null }>): Set<string> {
  const coordMap = new Map<string, string[]>();
  const duplicateIds = new Set<string>();
  
  opportunities.forEach(opp => {
    if (opp.latitude !== null && opp.longitude !== null) {
      // Round to 4 decimal places (~11 meters precision) to detect true duplicates
      const key = `${opp.latitude.toFixed(4)},${opp.longitude.toFixed(4)}`;
      if (!coordMap.has(key)) {
        coordMap.set(key, []);
      }
      coordMap.get(key)!.push(opp.id);
    }
  });
  
  // Mark all IDs in coordinate groups with more than 1 entry as duplicates
  coordMap.forEach((ids, key) => {
    if (ids.length > 1) {
      ids.forEach(id => duplicateIds.add(id));
      console.log(`Found ${ids.length} opportunities with duplicate coordinates: ${key}`);
    }
  });
  
  return duplicateIds;
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

  try {
    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { opportunityIds, batchSize = 50, forceRegeocode = false } = await req.json().catch(() => ({}));

    // Get opportunities
    let query = supabase
      .from("opportunities")
      .select("id, name, location, address, latitude, longitude");

    if (opportunityIds && Array.isArray(opportunityIds) && opportunityIds.length > 0) {
      query = query.in("id", opportunityIds);
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

    console.log(`Processing ${opportunities.length} opportunities (forceRegeocode: ${forceRegeocode}, batchSize: ${batchSize || 50})`);

    // Find duplicate coordinates if not forcing re-geocode
    let duplicateIds = new Set<string>();
    if (!forceRegeocode) {
      duplicateIds = findDuplicateCoordinates(opportunities);
      console.log(`Found ${duplicateIds.size} opportunities with duplicate coordinates`);
    }

    // Filter opportunities that need geocoding
    let needsGeocoding;
    if (forceRegeocode) {
      // Re-geocode all opportunities
      needsGeocoding = opportunities;
      console.log(`Force re-geocoding enabled: processing all ${opportunities.length} opportunities`);
    } else {
      // Only geocode invalid coordinates and duplicates
      needsGeocoding = opportunities.filter(opp => {
        const isValid = isValidCoordinate(opp.latitude, opp.longitude);
        const isDuplicate = duplicateIds.has(opp.id);
        return !isValid || isDuplicate;
      });
      console.log(`Found ${needsGeocoding.length} opportunities needing geocoding (invalid or duplicates)`);
    }

    if (needsGeocoding.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          geocoded: 0, 
          message: "All opportunities have valid coordinates",
          duplicates: duplicateIds.size,
        }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Process batch
    const actualBatchSize = Math.min(batchSize || 50, needsGeocoding.length);
    const batchToProcess = needsGeocoding.slice(0, actualBatchSize);
    
    console.log(`Processing batch of ${batchToProcess.length} opportunities`);

    // Geocode coordinates
    let geocoded = 0;
    let failed = 0;
    const updates: Array<{ id: string; latitude: number; longitude: number }> = [];
    const failures: Array<{ id: string; name: string; error: string }> = [];

    for (let i = 0; i < batchToProcess.length; i++) {
      const opp = batchToProcess[i];
      
      // Build address string with improved logic
      const address = buildAddressString(opp);

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
        failures.push({
          id: opp.id,
          name: opp.name,
          error: `Failed to geocode address: ${address}`,
        });
        console.error(`Failed to geocode opportunity "${opp.name}" (${opp.id}) with address: ${address}`);
      }

      // Rate limiting: 100ms delay between requests (~10 req/sec)
      if (i < batchToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Update opportunities in batch
    if (updates.length > 0) {
      // Use bulk update for better performance
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from("opportunities")
          .update({
            latitude: update.latitude,
            longitude: update.longitude,
            updated_at: new Date().toISOString(),
          })
          .eq("id", update.id);

        if (updateError) {
          console.error(`Database update error for ${update.id}:`, updateError);
          failed++;
          geocoded--;
          
          // Find the failed update to add to failures list
          const updateIndex = updates.findIndex(u => u.id === update.id);
          if (updateIndex !== -1) {
            const opp = batchToProcess[updateIndex];
            failures.push({
              id: update.id,
              name: opp.name,
              error: `Database update failed: ${updateError.message}`,
            });
          }
        }
      }
      console.log(`Successfully updated ${geocoded} opportunities in database`);
    }

    const remaining = needsGeocoding.length - (geocoded + failed);

    return new Response(
      JSON.stringify({
        success: true,
        geocoded,
        failed,
        remaining,
        processed: batchToProcess.length,
        total: opportunities.length,
        needsGeocoding: needsGeocoding.length,
        duplicates: duplicateIds.size,
        failures: failures.length > 0 ? failures.slice(0, 10) : [], // Return first 10 failures
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

