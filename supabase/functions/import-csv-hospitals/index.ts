import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CSVRow {
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

function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const rows: CSVRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Handle CSV parsing with quotes
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row as unknown as CSVRow);
  }
  
  return rows;
}

function inferOpportunityType(name: string): 'hospital' | 'clinic' | 'hospice' | 'emt' | 'volunteer' {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('hospice')) return 'hospice';
  if (lowerName.includes('ems') || lowerName.includes('emt') || lowerName.includes('ambulance')) return 'emt';
  if (lowerName.includes('clinic') || lowerName.includes('center') || lowerName.includes('med spa')) return 'clinic';
  if (lowerName.includes('volunteer')) return 'volunteer';
  
  return 'hospital';
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvData, clearExisting } = await req.json();

    if (clearExisting) {
      // Delete all existing opportunities
      const { error: deleteError } = await supabase
        .from("opportunities")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all rows
      
      if (deleteError) {
        console.error("Error clearing opportunities:", deleteError);
        throw new Error(`Failed to clear existing data: ${deleteError.message}`);
      }
      console.log("Cleared existing opportunities");
    }

    // Parse CSV data
    const rows = parseCSV(csvData);
    console.log(`Parsed ${rows.length} rows from CSV`);

    // Transform and insert in batches
    const batchSize = 50;
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const opportunities = batch
        .filter(row => row.name && row.lat && row.lon)
        .map(row => {
          const lat = parseFloat(row.lat);
          const lon = parseFloat(row.lon);
          
          if (isNaN(lat) || isNaN(lon)) return null;
          
          const location = [row.city, row.state].filter(Boolean).join(', ') || 'Texas';
          
          return {
            name: row.name.replace(/^"|"$/g, ''),
            type: inferOpportunityType(row.name),
            location,
            latitude: lat,
            longitude: lon,
            phone: row.phone || null,
            email: row.email || null,
            website: row.website || null,
            description: null,
            hours_required: "Varies",
            acceptance_likelihood: "medium" as const,
            requirements: [],
          };
        })
        .filter(Boolean);

      if (opportunities.length > 0) {
        const { error: insertError } = await supabase
          .from("opportunities")
          .insert(opportunities);

        if (insertError) {
          console.error(`Batch ${i / batchSize + 1} insert error:`, insertError);
          failed += batch.length;
        } else {
          imported += opportunities.length;
          console.log(`Imported batch ${i / batchSize + 1}: ${opportunities.length} records`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        failed,
        total: rows.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Import error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
