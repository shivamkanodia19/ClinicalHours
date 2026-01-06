import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OpportunityInsert {
  name: string;
  type: 'hospital' | 'clinic' | 'hospice' | 'emt' | 'volunteer';
  location: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  hours_required: string;
  acceptance_likelihood: 'high' | 'medium' | 'low';
  requirements: string[];
}

Deno.serve(async (req) => {
  console.log("Import function called, method:", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing env vars");
      throw new Error("Missing Supabase configuration");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { opportunities, clearExisting } = body as { 
      opportunities: OpportunityInsert[]; 
      clearExisting?: boolean 
    };
    
    console.log(`Received ${opportunities?.length || 0} opportunities, clearExisting: ${clearExisting}`);

    if (clearExisting) {
      const { error: deleteError } = await supabase
        .from("opportunities")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      
      if (deleteError) {
        console.error("Error clearing opportunities:", deleteError);
        throw new Error(`Failed to clear existing data: ${deleteError.message}`);
      }
      console.log("Cleared existing opportunities");
    }

    if (!opportunities || opportunities.length === 0) {
      return new Response(
        JSON.stringify({ success: true, imported: 0, message: "No opportunities to import" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert the batch
    const { error: insertError } = await supabase
      .from("opportunities")
      .insert(opportunities);

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(`Insert failed: ${insertError.message}`);
    }

    console.log(`Imported ${opportunities.length} opportunities`);

    return new Response(
      JSON.stringify({
        success: true,
        imported: opportunities.length,
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
