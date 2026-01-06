import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://sysbtcikrbrrgafffody.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5c2J0Y2lrcmJycmdhZmZmb2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNTc5MzUsImV4cCI6MjA3ODYzMzkzNX0.5jN1B2RIscA42w7FYfwxaQHFW6ROldslPzUFYtQCgLc';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Try service role key first, fallback to anon key
let supabase;
if (SUPABASE_SERVICE_ROLE_KEY) {
  console.log('✅ Using service role key (bypasses RLS)\n');
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
} else {
  console.log('⚠️  Service role key not found, using anon key (may fail on updates due to RLS)\n');
  console.log('   To fix this, add SUPABASE_SERVICE_ROLE_KEY to your .env file');
  console.log('   Get it from: Supabase Dashboard → Project Settings → API → service_role key\n');
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const MAPBOX_TOKEN = process.env.VITE_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoicmFnaGF2dDIwMDciLCJhIjoiY21oeTJzb2dvMDhsdDJ3cTZqMzVtc3Q4cCJ9.DXBjsf0TdbDT_KFXcc2mpg';

interface Opportunity {
  id: string;
  name: string;
  location: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  type?: string;
}

function isValidCoordinate(lat: number | null, lon: number | null): boolean {
  if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
    return false;
  }
  return lat >= 24 && lat <= 50 && lon >= -130 && lon <= -65;
}

async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_TOKEN}&country=US&limit=1`;
    
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`   ❌ Geocoding API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return { latitude, longitude };
    }
    return null;
  } catch (error) {
    console.error(`   ❌ Geocoding exception:`, error);
    return null;
  }
}

function buildAddressString(opp: Opportunity): string {
  const addressParts: string[] = [];
  
  if (opp.address && opp.address.trim()) {
    addressParts.push(opp.address.trim());
  }
  
  if (opp.location && opp.location.trim()) {
    const locationLower = opp.location.trim().toLowerCase();
    if (!opp.address || !opp.address.toLowerCase().includes(locationLower)) {
      addressParts.push(opp.location.trim());
    }
  }
  
  if (addressParts.length === 0 && opp.name && opp.name.trim()) {
    return opp.name.trim();
  }
  
  return addressParts.join(', ') || opp.location || opp.name || 'Unknown';
}

function findDuplicateCoordinates(opportunities: Opportunity[]): Map<string, string[]> {
  const coordMap = new Map<string, string[]>();
  
  opportunities.forEach(opp => {
    if (opp.latitude !== null && opp.longitude !== null) {
      // Round to 4 decimal places (~11 meters) to detect duplicates
      const key = `${opp.latitude.toFixed(4)},${opp.longitude.toFixed(4)}`;
      if (!coordMap.has(key)) {
        coordMap.set(key, []);
      }
      coordMap.get(key)!.push(opp.id);
    }
  });
  
  // Only return groups with more than 1 entry
  const duplicates = new Map<string, string[]>();
  coordMap.forEach((ids, key) => {
    if (ids.length > 1) {
      duplicates.set(key, ids);
    }
  });
  
  return duplicates;
}

async function main() {
  console.log('🗺️  Fixing coordinates directly in database...\n');

  const startTime = Date.now();

  try {
    // Fetch all opportunities
    console.log('📥 Fetching all opportunities from database...');
    const { data: opportunities, error: fetchError } = await supabase
      .from('opportunities')
      .select('id, name, location, address, latitude, longitude, type')
      .order('name');

    if (fetchError) {
      console.error('❌ Error fetching opportunities:', fetchError);
      process.exit(1);
    }

    if (!opportunities || opportunities.length === 0) {
      console.log('✅ No opportunities found');
      return;
    }

    console.log(`✅ Found ${opportunities.length} total opportunities\n`);

    // Analyze coordinates
    console.log('🔍 Analyzing coordinate distribution...\n');
    
    const valid: Opportunity[] = [];
    const invalid: Opportunity[] = [];
    const missing: Opportunity[] = [];

    opportunities.forEach(opp => {
      if (opp.latitude === null || opp.longitude === null) {
        missing.push(opp);
      } else if (!isValidCoordinate(opp.latitude, opp.longitude)) {
        invalid.push(opp);
      } else {
        valid.push(opp);
      }
    });

    const duplicateMap = findDuplicateCoordinates(opportunities);
    const duplicateIds = new Set<string>();
    duplicateMap.forEach(ids => {
      ids.forEach(id => duplicateIds.add(id));
    });

    console.log('='.repeat(60));
    console.log('📊 COORDINATE ANALYSIS');
    console.log('='.repeat(60));
    console.log(`Total opportunities:     ${opportunities.length}`);
    console.log(`✅ Valid coordinates:    ${valid.length}`);
    console.log(`❌ Invalid coordinates:  ${invalid.length}`);
    console.log(`⚠️  Missing coordinates: ${missing.length}`);
    console.log(`🔄 Duplicate coordinates: ${duplicateIds.size}`);
    console.log('='.repeat(60));

    // Show duplicate groups
    if (duplicateMap.size > 0) {
      console.log('\n🔄 Duplicate coordinate groups:\n');
      const sortedGroups = Array.from(duplicateMap.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10);
      
      sortedGroups.forEach(([coords, ids], index) => {
        console.log(`   ${index + 1}. ${coords} - ${ids.length} opportunities`);
      });
      
      if (duplicateMap.size > 10) {
        console.log(`   ... and ${duplicateMap.size - 10} more duplicate groups`);
      }
      console.log('');
    }

    // Determine which opportunities need geocoding
    // We'll re-geocode ALL opportunities to ensure accuracy
    const needsGeocoding = opportunities;
    
    console.log(`\n🌍 Re-geocoding ALL ${needsGeocoding.length} opportunities...`);
    console.log(`   (This ensures accuracy and fixes duplicates)\n`);

    let geocoded = 0;
    let failed = 0;
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(needsGeocoding.length / BATCH_SIZE);

    for (let i = 0; i < needsGeocoding.length; i += BATCH_SIZE) {
      const batch = needsGeocoding.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const progress = ((i / needsGeocoding.length) * 100).toFixed(1);
      
      console.log(`📦 Batch ${batchNum}/${totalBatches} [${progress}%] - Processing ${batch.length} opportunities...`);

      for (const opp of batch) {
        const address = buildAddressString(opp);
        
        const coords = await geocodeAddress(address);
        
        if (coords) {
          // Update database directly
          const { error: updateError } = await supabase
            .from('opportunities')
            .update({
              latitude: coords.latitude,
              longitude: coords.longitude,
              updated_at: new Date().toISOString(),
            })
            .eq('id', opp.id);

          if (updateError) {
            console.error(`   ❌ Failed to update ${opp.name}:`, updateError.message);
            if (updateError.message.includes('permission') || updateError.message.includes('RLS')) {
              console.error(`   ⚠️  RLS policy blocking update - need service role key`);
              console.error(`   Add SUPABASE_SERVICE_ROLE_KEY to .env file`);
              process.exit(1);
            }
            failed++;
          } else {
            geocoded++;
            if (geocoded % 10 === 0) {
              process.stdout.write(`   ✅ Geocoded ${geocoded} so far...\r`);
            }
          }
        } else {
          console.error(`   ❌ Failed to geocode: ${opp.name} (${address})`);
          failed++;
        }

        // Rate limiting: 100ms delay between requests
        if (i < needsGeocoding.length - BATCH_SIZE) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`   ✅ Batch ${batchNum} complete: ${geocoded} geocoded, ${failed} failed`);
    }

    const totalTime = (Date.now() - startTime) / 1000;

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully geocoded: ${geocoded}`);
    console.log(`❌ Failed:               ${failed}`);
    console.log(`📝 Total processed:      ${needsGeocoding.length}`);
    console.log(`⏱️  Total time:           ${Math.round(totalTime)}s`);
    console.log(`📊 Success rate:         ${((geocoded / needsGeocoding.length) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));

    if (failed > 0) {
      console.log(`\n⚠️  ${failed} opportunities failed to geocode`);
      console.log(`   These may need manual review`);
    } else {
      console.log(`\n🎉 All opportunities have been updated successfully!`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main().catch(console.error);

