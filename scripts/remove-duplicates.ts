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
  latitude: number | null;
  longitude: number | null;
  type: string;
}

async function removeDuplicates() {
  console.log('🔍 Finding duplicate hospitals...\n');

  try {
    // Get all opportunities
    const { data: opportunities, error } = await supabase
      .from('opportunities')
      .select('id, name, location, latitude, longitude, type, created_at')
      .order('created_at', { ascending: true }); // Keep oldest ones

    if (error) {
      console.error('❌ Error fetching opportunities:', error);
      return;
    }

    if (!opportunities || opportunities.length === 0) {
      console.log('✅ No opportunities found');
      return;
    }

    console.log(`📊 Found ${opportunities.length} total opportunities`);

    // Group by name + location (case-insensitive)
    const groups = new Map<string, Opportunity[]>();
    
    for (const opp of opportunities) {
      const key = `${opp.name.toLowerCase().trim()}|${opp.location.toLowerCase().trim()}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(opp);
    }

    // Find duplicates
    const duplicates: { key: string; records: Opportunity[]; keep: Opportunity; remove: Opportunity[] }[] = [];
    
    for (const [key, records] of groups.entries()) {
      if (records.length > 1) {
        // Keep the oldest one (first in sorted array)
        const keep = records[0];
        const remove = records.slice(1);
        duplicates.push({ key, records, keep, remove });
      }
    }

    console.log(`\n🔍 Found ${duplicates.length} duplicate groups`);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    // Show summary
    let totalToRemove = 0;
    for (const dup of duplicates) {
      totalToRemove += dup.remove.length;
      console.log(`\n📋 "${dup.keep.name}" in ${dup.keep.location}:`);
      console.log(`   ✅ Keeping: ${dup.keep.id} (created: ${dup.keep.created_at})`);
      for (const rem of dup.remove) {
        console.log(`   ❌ Removing: ${rem.id} (created: ${rem.created_at})`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total duplicate groups: ${duplicates.length}`);
    console.log(`   Records to remove: ${totalToRemove}`);

    // Remove duplicates via edge function (requires admin auth)
    console.log(`\n🗑️  Removing duplicates via edge function...`);
    
    try {
      const { data, error } = await supabase.functions.invoke('remove-duplicates', {
        body: {},
      });

      if (error) {
        console.error('❌ Edge function error:', error.message);
        console.log('\n⚠️  Note: You need to be signed in as an admin to remove duplicates.');
        console.log('   Alternatively, you can run this from the admin panel.');
        return;
      }

      if (data?.error) {
        console.error('❌ Error:', data.error);
        return;
      }

      const removed = data?.removed || 0;
      const duplicateGroups = data?.duplicateGroups || 0;

      console.log(`\n✅ Removed ${removed} duplicate records`);
      console.log(`📊 Duplicate groups found: ${duplicateGroups}`);
      console.log(`📊 Remaining opportunities: ${opportunities.length - removed}`);

      if (data?.errors && data.errors.length > 0) {
        console.log(`\n⚠️  Some errors occurred:`);
        data.errors.forEach((err: string) => console.log(`   - ${err}`));
      }

    } catch (error) {
      console.error('❌ Error calling edge function:', error);
      console.log('\n⚠️  Note: You need to be signed in as an admin to remove duplicates.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

removeDuplicates().catch(console.error);

