import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HospitalCSVRow {
  name: string;
  website: string;
  email: string;
  phone: string;
  bio: string;
  city: string;
  state: string;
  lat: string;
  lon: string;
  source: string;
}

// Parse the CSV data (already parsed by local script, just validate and format)
function parseCSVData(csvData: HospitalCSVRow[]): {
  name: string;
  type: 'hospital' | 'clinic' | 'hospice' | 'emt' | 'volunteer';
  location: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  hours_required: string;
  acceptance_likelihood: 'medium' | 'high' | 'low';
  phone: string | null;
  email: string | null;
  website: string | null;
  requirements: string[];
  description: string | null;
}[] {
  const hospitals: ReturnType<typeof parseCSVData> = [];
  
  for (const row of csvData) {
    if (!row.name || !row.city) continue;
    
    // Build location string
    const location = row.state 
      ? `${row.city}, ${row.state}` 
      : row.city;
    
    // Parse coordinates
    const latitude = row.lat ? parseFloat(row.lat) : null;
    const longitude = row.lon ? parseFloat(row.lon) : null;
    
    // Validate coordinates
    if (latitude === null || longitude === null || isNaN(latitude) || isNaN(longitude)) {
      continue;
    }
    
    // Infer type from name/bio (default to hospital)
    let type: 'hospital' | 'clinic' | 'hospice' | 'emt' | 'volunteer' = 'hospital';
    const nameLower = row.name.toLowerCase();
    const bioLower = (row.bio || '').toLowerCase();
    
    if (nameLower.includes('clinic') || bioLower.includes('clinic')) {
      type = 'clinic';
    } else if (nameLower.includes('hospice') || bioLower.includes('hospice')) {
      type = 'hospice';
    } else if (nameLower.includes('emt') || nameLower.includes('emergency medical')) {
      type = 'emt';
    } else if (nameLower.includes('volunteer') || bioLower.includes('volunteer')) {
      type = 'volunteer';
    }
    
    // Clean phone number
    const phone = row.phone?.trim() || null;
    
    // Clean email
    const email = row.email?.trim() || null;
    
    // Clean website
    const website = row.website?.trim() || null;
    
    // Use bio as description
    const description = row.bio?.trim() || null;
    
    hospitals.push({
      name: row.name.trim(),
      type,
      location,
      address: null, // Not in CSV
      latitude,
      longitude,
      hours_required: '4-8 hours/week',
      acceptance_likelihood: 'medium',
      phone,
      email,
      website,
      requirements: [],
      description,
    });
  }
  
  return hospitals;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get the CSV data from request body (already parsed by local script)
    const { csvData } = await req.json();
    
    if (!csvData || !Array.isArray(csvData)) {
      console.error("Invalid CSV data provided");
      return new Response(
        JSON.stringify({ error: "Invalid CSV data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Received ${csvData.length} pre-parsed records to process`);
    
    // Validate and format the data (already mostly parsed by local script)
    const hospitals = parseCSVData(csvData);
    console.log(`Validated ${hospitals.length} valid hospitals`);
    
    // Fetch existing opportunities to check for duplicates
    const { data: existingOpps, error: fetchError } = await supabase
      .from("opportunities")
      .select("name, location");
    
    if (fetchError) {
      console.error("Error fetching existing opportunities:", fetchError);
      throw fetchError;
    }
    
    // Create a set of existing hospital names (lowercase for comparison)
    const existingNames = new Set(
      (existingOpps || []).map((opp: { name: string; location: string }) => 
        `${opp.name.toLowerCase().trim()}|${opp.location.toLowerCase().trim()}`
      )
    );
    
    console.log(`Found ${existingNames.size} existing opportunities`);
    
    // Filter out duplicates
    const newHospitals = hospitals.filter(h => {
      const key = `${h.name.toLowerCase().trim()}|${h.location.toLowerCase().trim()}`;
      return !existingNames.has(key);
    });
    
    // Also dedupe within the import data itself
    const seenKeys = new Set<string>();
    const uniqueNewHospitals = newHospitals.filter(h => {
      const key = `${h.name.toLowerCase().trim()}|${h.location.toLowerCase().trim()}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
    
    console.log(`After deduplication: ${uniqueNewHospitals.length} new hospitals to insert`);
    
    if (uniqueNewHospitals.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No new hospitals to import - all are duplicates",
          imported: 0,
          duplicates: hospitals.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Insert in batches to avoid timeouts
    const BATCH_SIZE = 100;
    let insertedCount = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < uniqueNewHospitals.length; i += BATCH_SIZE) {
      const batch = uniqueNewHospitals.slice(i, i + BATCH_SIZE);
      console.log(`Inserting batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(uniqueNewHospitals.length/BATCH_SIZE)}`);
      
      const { error: insertError, data: inserted } = await supabase
        .from("opportunities")
        .insert(batch)
        .select("id");
      
      if (insertError) {
        console.error(`Error inserting batch:`, insertError);
        errors.push(`Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${insertError.message}`);
      } else {
        insertedCount += inserted?.length || 0;
      }
    }
    
    console.log(`Successfully imported ${insertedCount} hospitals`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully imported ${insertedCount} hospitals`,
        imported: insertedCount,
        duplicates: hospitals.length - uniqueNewHospitals.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error: unknown) {
    console.error("Import error:", error);
    const message = error instanceof Error ? error.message : "Import failed";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
