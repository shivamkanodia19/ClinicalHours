import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HospitalCSVRow {
  name: string;
  city: string;
  state: string;
  street: string;
  housenumber: string;
  postcode: string;
  lat: number;
  lon: number;
  phone: string;
  website: string;
  email: string;
  description: string;
  beds: string;
  emergency: string;
  specialty: string;
}

// Parse the CSV data
function parseCSVData(csvData: HospitalCSVRow[]): {
  name: string;
  location: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  description: string | null;
  type: 'hospital' | 'clinic';
  hours_required: string;
  acceptance_likelihood: 'medium' | 'high' | 'low';
}[] {
  const hospitals: ReturnType<typeof parseCSVData> = [];
  
  for (const row of csvData) {
    if (!row.name) continue;
    
    // Build location string
    const city = row.city || '';
    const state = row.state || 'TX';
    const location = city ? `${city}, ${state}` : `Texas`;
    
    // Build address
    const parts: string[] = [];
    if (row.housenumber) parts.push(row.housenumber);
    if (row.street) parts.push(row.street);
    if (row.city) parts.push(row.city);
    if (row.state || !row.city) parts.push(row.state || 'TX');
    if (row.postcode) parts.push(row.postcode);
    const address = parts.join(', ') || null;
    
    // Parse coordinates
    const latitude = row.lat && !isNaN(row.lat) ? row.lat : null;
    const longitude = row.lon && !isNaN(row.lon) ? row.lon : null;
    
    // Clean website URL
    let website = row.website?.trim() || null;
    if (website && !website.startsWith('http')) {
      website = `https://${website}`;
    }
    
    // Determine type based on name/specialty
    const nameLower = row.name.toLowerCase();
    const specialty = (row.specialty || '').toLowerCase();
    const isClinic = nameLower.includes('clinic') || 
                     specialty.includes('clinic') ||
                     nameLower.includes('center') && !nameLower.includes('medical center');
    
    hospitals.push({
      name: row.name,
      location,
      address,
      latitude,
      longitude,
      phone: row.phone?.trim() || null,
      website,
      email: row.email?.trim() || null,
      description: row.description?.trim() || null,
      type: isClinic ? 'clinic' : 'hospital',
      hours_required: 'Flexible',
      acceptance_likelihood: 'medium',
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
    
    // Get the CSV data from request body
    const { csvData } = await req.json();
    
    if (!csvData || !Array.isArray(csvData)) {
      console.error("Invalid CSV data provided");
      return new Response(
        JSON.stringify({ error: "Invalid CSV data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Received ${csvData.length} rows to process`);
    
    // Parse the CSV data into hospital records
    const hospitals = parseCSVData(csvData);
    console.log(`Parsed ${hospitals.length} valid hospitals`);
    
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
