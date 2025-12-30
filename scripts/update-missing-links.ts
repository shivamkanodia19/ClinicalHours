/**
 * Script to find and update missing website/email links in the database
 * Run with: deno run --allow-net --allow-env scripts/update-missing-links.ts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Directory sites to exclude
const EXCLUDED_DOMAINS = [
  'yelp.com',
  'healthgrades.com',
  'vitals.com',
  'webmd.com',
  'wikipedia.org',
  'facebook.com',
  'linkedin.com',
  'twitter.com',
  'instagram.com',
  'yellowpages.com',
  'whitepages.com',
  'bbb.org',
  'indeed.com',
  'glassdoor.com',
  'google.com/maps',
  'mapquest.com',
];

const REQUEST_DELAY_MS = 2500;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface Opportunity {
  id: string;
  name: string;
  type: string;
  location: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
}

function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

function isExcludedDomain(url: string): boolean {
  const domain = extractDomain(url);
  if (!domain) return true;
  return EXCLUDED_DOMAINS.some(excluded => domain.includes(excluded));
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

function emailDomainMatchesWebsite(email: string, website: string): boolean {
  const emailDomain = email.split('@')[1]?.toLowerCase();
  const websiteDomain = extractDomain(website)?.toLowerCase();
  if (!emailDomain || !websiteDomain) return false;
  return emailDomain === websiteDomain || emailDomain.endsWith('.' + websiteDomain);
}

async function searchForWebsite(name: string, location: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`${name} ${location} official website`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${query}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    
    if (!response.ok) {
      console.error(`Search failed with status: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    const urlPattern = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"/gi;
    const matches = [];
    let match;
    
    while ((match = urlPattern.exec(html)) !== null && matches.length < 5) {
      const url = match[1];
      if (!isExcludedDomain(url)) {
        matches.push(url);
      }
    }
    
    if (matches.length === 0) {
      const cleanName = name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '')
        .substring(0, 30);
      
      const patterns = [
        `https://www.${cleanName}.org`,
        `https://www.${cleanName}.com`,
        `https://${cleanName}.org`,
        `https://${cleanName}.com`,
      ];
      
      for (const pattern of patterns) {
        try {
          const testResponse = await fetch(pattern, {
            method: 'HEAD',
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(5000),
          });
          
          if (testResponse.ok) {
            return pattern;
          }
        } catch {
          // Continue
        }
      }
    }
    
    return matches.length > 0 ? matches[0] : null;
  } catch (error) {
    console.error(`Error searching for website: ${error}`);
    return null;
  }
}

async function verifyWebsite(website: string, name: string): Promise<boolean> {
  try {
    const response = await fetch(website, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) return false;
    
    const domain = extractDomain(website);
    if (!domain) return false;
    
    const nameWords = name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const domainLower = domain.toLowerCase();
    const hasNameMatch = nameWords.some(word => domainLower.includes(word));
    
    return hasNameMatch;
  } catch (error) {
    console.error(`Error verifying website ${website}: ${error}`);
    return false;
  }
}

async function findEmailOnWebsite(website: string): Promise<string | null> {
  try {
    const response = await fetch(website, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const emailPatterns = [
      /contact@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /info@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /volunteer@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /hr@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /volunteers@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    ];
    
    const foundEmails = new Set<string>();
    
    for (const pattern of emailPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const email = match[1] || match[0];
        const cleanEmail = email.replace('mailto:', '').trim().toLowerCase();
        
        if (isValidEmail(cleanEmail) && emailDomainMatchesWebsite(cleanEmail, website)) {
          foundEmails.add(cleanEmail);
        }
      }
    }
    
    const preferredEmails = Array.from(foundEmails).filter(e => 
      e.startsWith('contact@') || e.startsWith('info@') || e.startsWith('volunteer@')
    );
    
    return preferredEmails.length > 0 ? preferredEmails[0] : (Array.from(foundEmails)[0] || null);
  } catch (error) {
    console.error(`Error finding email on ${website}: ${error}`);
    return null;
  }
}

async function processOpportunity(opp: Opportunity, supabase: any): Promise<{ updated: boolean; website?: string; email?: string; error?: string }> {
  let websiteUpdated = false;
  let emailUpdated = false;
  let error: string | undefined;

  try {
    // Find website if missing
    if (!opp.website) {
      console.log(`\n[${opp.name}] Searching for website...`);
      const website = await searchForWebsite(opp.name, opp.location);
      
      if (website) {
        const isValid = await verifyWebsite(website, opp.name);
        if (isValid) {
          const { error: updateError } = await supabase
            .from('opportunities')
            .update({ website })
            .eq('id', opp.id);
          
          if (updateError) {
            error = `Failed to update website: ${updateError.message}`;
            console.error(`  ❌ ${error}`);
          } else {
            websiteUpdated = true;
            console.log(`  ✅ Updated website: ${website}`);
          }
        } else {
          error = 'Website found but failed verification';
          console.log(`  ⚠️  ${error}`);
        }
      } else {
        error = 'No website found';
        console.log(`  ⚠️  ${error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
    } else {
      console.log(`\n[${opp.name}] Website already exists: ${opp.website}`);
    }
    
    // Find email if missing
    if (!opp.email) {
      const websiteToCheck = websiteUpdated ? undefined : opp.website;
      
      if (websiteToCheck) {
        console.log(`  Searching for email on: ${websiteToCheck}`);
        const email = await findEmailOnWebsite(websiteToCheck);
        
        if (email && isValidEmail(email) && emailDomainMatchesWebsite(email, websiteToCheck)) {
          const { error: updateError } = await supabase
            .from('opportunities')
            .update({ email })
            .eq('id', opp.id);
          
          if (updateError) {
            error = error ? `${error}; Failed to update email: ${updateError.message}` : `Failed to update email: ${updateError.message}`;
            console.error(`  ❌ ${error}`);
          } else {
            emailUpdated = true;
            console.log(`  ✅ Updated email: ${email}`);
          }
        } else {
          if (!error) {
            error = 'No valid email found';
            console.log(`  ⚠️  ${error}`);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
      } else if (!opp.website) {
        if (!error) {
          error = 'Cannot find email without website';
          console.log(`  ⚠️  ${error}`);
        }
      }
    } else {
      console.log(`  Email already exists: ${opp.email}`);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
    console.error(`  ❌ Error: ${error}`);
  }
  
  return { 
    updated: websiteUpdated || emailUpdated, 
    website: websiteUpdated ? undefined : undefined,
    email: emailUpdated ? undefined : undefined,
    error 
  };
}

async function main() {
  const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('VITE_SUPABASE_ANON_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) must be set');
    Deno.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const limit = 20; // Process 20 at a time
  const opportunityType = null; // Process all types
  
  console.log('🔍 Finding opportunities missing website or email...\n');
  
  let query = supabase
    .from('opportunities')
    .select('id, name, type, location, address, phone, website, email')
    .or('website.is.null,email.is.null')
    .limit(limit);
  
  if (opportunityType) {
    query = query.eq('type', opportunityType);
  }
  
  const { data: opportunities, error: queryError } = await query;
  
  if (queryError) {
    console.error('Database query error:', queryError);
    Deno.exit(1);
  }
  
  if (!opportunities || opportunities.length === 0) {
    console.log('✅ No opportunities found missing website or email');
    return;
  }
  
  console.log(`Found ${opportunities.length} opportunities to process\n`);
  
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  
  for (let i = 0; i < opportunities.length; i++) {
    const opp = opportunities[i];
    console.log(`\n[${i + 1}/${opportunities.length}] Processing: ${opp.name} (${opp.type})`);
    
    const result = await processOpportunity(opp, supabase);
    
    if (result.error) {
      failed++;
    } else if (result.updated) {
      updated++;
    } else {
      skipped++;
    }
    
    if (i < opportunities.length - 1) {
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
    }
  }
  
  console.log(`\n\n📊 Summary:`);
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ⚠️  Skipped: ${skipped}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📝 Total: ${opportunities.length}`);
}

main().catch(console.error);

