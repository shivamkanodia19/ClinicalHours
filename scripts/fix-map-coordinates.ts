import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://sysbtcikrbrrgafffody.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5c2J0Y2lrcmJycmdhZmZmb2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNTc5MzUsImV4cCI6MjA3ODYzMzkzNX0.5jN1B2RIscA42w7FYfwxaQHFW6ROldslPzUFYtQCgLc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Opportunity {
  id: string;
  name: string;
  location: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

async function geocodeAddress(address: string, mapboxToken: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&country=US&limit=1`;
    
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

async function fixMapCoordinates() {
  console.log('🗺️  Fixing map coordinates for hospitals...\n');

  const MAPBOX_TOKEN = process.env.VITE_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoicmFnaGF2dDIwMDciLCJhIjoiY21oeTJzb2dvMDhsdDJ3cTZqMzVtc3Q4cCJ9.DXBjsf0TdbDT_KFXcc2mpg';

  try {
    // Get all opportunities without coordinates or with invalid coordinates
    const { data: opportunities, error } = await supabase
      .from('opportunities')
      .select('id, name, location, address, latitude, longitude')
      .order('name');

    if (error) {
      console.error('❌ Error fetching opportunities:', error);
      return;
    }

    if (!opportunities || opportunities.length === 0) {
      console.log('✅ No opportunities found');
      return;
    }

    console.log(`📊 Found ${opportunities.length} total opportunities`);

    // Find opportunities missing coordinates or with invalid coordinates
    const needsGeocoding: Opportunity[] = [];
    const hasValidCoords: Opportunity[] = [];

    for (const opp of opportunities) {
      const lat = opp.latitude;
      const lon = opp.longitude;
      
      // Check if coordinates are valid (within US bounds roughly)
      const isValid = lat !== null && lon !== null && 
                     !isNaN(lat) && !isNaN(lon) &&
                     lat >= 24 && lat <= 50 && // US latitude range
                     lon >= -130 && lon <= -65; // US longitude range

      if (isValid) {
        hasValidCoords.push(opp);
      } else {
        needsGeocoding.push(opp);
      }
    }

    console.log(`\n📊 Status:`);
    console.log(`   ✅ Has valid coordinates: ${hasValidCoords.length}`);
    console.log(`   ❌ Needs geocoding: ${needsGeocoding.length}`);

    if (needsGeocoding.length === 0) {
      console.log('\n✅ All hospitals have valid coordinates!');
      return;
    }

    // Geocode missing coordinates via edge function (processes in batches)
    console.log(`\n🌍 Geocoding ${needsGeocoding.length} hospitals via edge function...`);
    console.log(`   (Processing in batches to respect rate limits)`);
    
    const idsToGeocode = needsGeocoding.map(opp => opp.id);
    const BATCH_SIZE = 10; // Process 10 at a time
    let totalGeocoded = 0;
    let totalFailed = 0;
    let remaining = needsGeocoding.length;

    for (let i = 0; i < idsToGeocode.length; i += BATCH_SIZE) {
      const batch = idsToGeocode.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(idsToGeocode.length / BATCH_SIZE);
      const progress = ((i + batch.length) / idsToGeocode.length * 100).toFixed(1);

      console.log(`\n📦 Batch ${batchNum}/${totalBatches} [${progress}%]`);

      try {
        const { data, error } = await supabase.functions.invoke('fix-coordinates', {
          body: {
            opportunityIds: batch,
            batchSize: batch.length,
          },
        });

        if (error) {
          console.error(`   ❌ Edge function error: ${error.message}`);
          totalFailed += batch.length;
          continue;
        }

        if (data?.error) {
          console.error(`   ❌ Error: ${data.error}`);
          totalFailed += batch.length;
          continue;
        }

        const geocoded = data?.geocoded || 0;
        const failed = data?.failed || 0;
        totalGeocoded += geocoded;
        totalFailed += failed;
        remaining = data?.remaining || remaining - geocoded;

        console.log(`   ✅ Geocoded: ${geocoded}`);
        if (failed > 0) {
          console.log(`   ❌ Failed: ${failed}`);
        }

        // Rate limiting between batches
        if (i + BATCH_SIZE < idsToGeocode.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        console.error(`   ❌ Exception:`, error);
        totalFailed += batch.length;
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log('📊 GEOCODING SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Successfully geocoded: ${totalGeocoded}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`📝 Total processed: ${needsGeocoding.length}`);
    console.log(`⏳ Remaining: ${remaining}`);
    console.log('='.repeat(50));

    if (remaining > 0) {
      console.log(`\n⚠️  ${remaining} hospitals still need coordinates`);
      console.log(`   Run the script again to process more batches`);
    } else {
      console.log(`\n🎉 All hospitals now have coordinates!`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixMapCoordinates().catch(console.error);

