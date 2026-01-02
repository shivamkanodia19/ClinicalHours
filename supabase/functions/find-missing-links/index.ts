import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Delay between requests (in milliseconds)
const REQUEST_DELAY_MS = 2500; // 2.5 seconds

// User agent for web scraping
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

interface ScrapingResult {
  id: string;
  name: string;
  website_found: boolean;
  email_found: boolean;
  website?: string | null;
  email?: string | null;
  error?: string;
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

/**
 * Check if domain should be excluded
 */
function isExcludedDomain(url: string): boolean {
  const domain = extractDomain(url);
  if (!domain) return true;
  
  return EXCLUDED_DOMAINS.some(excluded => domain.includes(excluded));
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Check if email domain matches website domain
 */
function emailDomainMatchesWebsite(email: string, website: string): boolean {
  const emailDomain = email.split('@')[1]?.toLowerCase();
  const websiteDomain = extractDomain(website)?.toLowerCase();
  
  if (!emailDomain || !websiteDomain) return false;
  
  // Exact match or subdomain match
  return emailDomain === websiteDomain || emailDomain.endsWith('.' + websiteDomain);
}

/**
 * Search for official website using DuckDuckGo
 */
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
    
    // Extract URLs from search results
    const urlPattern = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"/gi;
    const matches = [];
    let match;
    
    while ((match = urlPattern.exec(html)) !== null && matches.length < 5) {
      const url = match[1];
      if (!isExcludedDomain(url)) {
        matches.push(url);
      }
    }
    
    // If no results, try to construct a likely website URL
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
          // Continue to next pattern
        }
      }
    }
    
    return matches.length > 0 ? matches[0] : null;
  } catch (error) {
    console.error(`Error searching for website: ${error}`);
    return null;
  }
}

/**
 * Verify website is official by checking accessibility and content
 */
async function verifyWebsite(website: string, name: string): Promise<boolean> {
  try {
    const response = await fetch(website, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      return false;
    }
    
    // Check if domain contains organization name keywords
    const domain = extractDomain(website);
    if (!domain) return false;
    
    const nameWords = name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const domainLower = domain.toLowerCase();
    
    // At least one significant word from name should be in domain
    const hasNameMatch = nameWords.some(word => domainLower.includes(word));
    
    return hasNameMatch;
  } catch (error) {
    console.error(`Error verifying website ${website}: ${error}`);
    return false;
  }
}

/**
 * Scrape website for email addresses
 */
async function findEmailOnWebsite(website: string): Promise<string | null> {
  try {
    const response = await fetch(website, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    
    // Common email patterns to look for
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
    
    // Prefer contact/info emails
    const preferredEmails = Array.from(foundEmails).filter(e => 
      e.startsWith('contact@') || e.startsWith('info@') || e.startsWith('volunteer@')
    );
    
    return preferredEmails.length > 0 ? preferredEmails[0] : (Array.from(foundEmails)[0] || null);
  } catch (error) {
    console.error(`Error finding email on ${website}: ${error}`);
    return null;
  }
}

/**
 * Process a single opportunity to find missing links
 */
async function processOpportunity(
  opp: Opportunity,
  supabase: any
): Promise<ScrapingResult> {
  const result: ScrapingResult = {
    id: opp.id,
    name: opp.name,
    website_found: false,
    email_found: false,
  };
  
  try {
    // Find website if missing
    if (!opp.website) {
      console.log(`Searching for website: ${opp.name} in ${opp.location}`);
      const website = await searchForWebsite(opp.name, opp.location);
      
      if (website) {
        const isValid = await verifyWebsite(website, opp.name);
        if (isValid) {
          result.website = website;
          result.website_found = true;
          
          // Update database
          const { error } = await supabase
            .from('opportunities')
            .update({ website })
            .eq('id', opp.id);
          
          if (error) {
            console.error(`Error updating website for ${opp.id}:`, error);
            result.error = `Failed to update website: ${error.message}`;
          } else {
            console.log(`Updated website for ${opp.name}: ${website}`);
          }
        } else {
          result.error = 'Website found but failed verification';
        }
      } else {
        result.error = 'No website found in search results';
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
    } else {
      result.website = opp.website;
      result.website_found = true;
    }
    
    // Find email if missing
    if (!opp.email) {
      const websiteToCheck = result.website || opp.website;
      
      if (websiteToCheck) {
        console.log(`Searching for email on: ${websiteToCheck}`);
        const email = await findEmailOnWebsite(websiteToCheck);
        
        if (email && isValidEmail(email) && emailDomainMatchesWebsite(email, websiteToCheck)) {
          result.email = email;
          result.email_found = true;
          
          // Update database
          const { error } = await supabase
            .from('opportunities')
            .update({ email })
            .eq('id', opp.id);
          
          if (error) {
            console.error(`Error updating email for ${opp.id}:`, error);
            result.error = result.error 
              ? `${result.error}; Failed to update email: ${error.message}`
              : `Failed to update email: ${error.message}`;
          } else {
            console.log(`Updated email for ${opp.name}: ${email}`);
          }
        } else {
          if (!result.error) {
            result.error = 'No valid email found on website';
          }
        }
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
      } else {
        if (!result.error) {
          result.error = 'Cannot find email without website';
        }
      }
    } else {
      result.email = opp.email;
      result.email_found = true;
    }
  } catch (error) {
    console.error(`Error processing opportunity ${opp.id}:`, error);
    result.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // === AUTHENTICATION CHECK ===
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      console.error('Invalid authentication:', userError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role using service role key
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      console.error('Admin role check failed:', roleError?.message || 'Not an admin');
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${user.id} authenticated successfully`);
    // === END AUTHENTICATION CHECK ===

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(1, parseInt(String(body.limit)) || 50), 100);
    const opportunityType = body.opportunityType || null;

    console.log(`Starting link discovery: limit=${limit}, type=${opportunityType || 'all'}`);

    // Query opportunities missing website or email
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
      throw new Error(`Database query error: ${queryError.message}`);
    }

    if (!opportunities || opportunities.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0,
        updated: 0,
        failed: 0,
        skipped: 0,
        details: [],
        message: 'No opportunities found missing website or email'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${opportunities.length} opportunities missing links`);

    const results: ScrapingResult[] = [];
    let updated = 0;
    let failed = 0;
    let skipped = 0;

    // Process each opportunity
    for (let i = 0; i < opportunities.length; i++) {
      const opp = opportunities[i];
      console.log(`Processing ${i + 1}/${opportunities.length}: ${opp.name}`);

      const result = await processOpportunity(opp, supabase);
      results.push(result);

      if (result.error) {
        failed++;
      } else if (result.website_found || result.email_found) {
        updated++;
      } else {
        skipped++;
      }

      // Add delay between opportunities
      if (i < opportunities.length - 1) {
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
      }
    }

    console.log(`Processing complete: processed=${results.length}, updated=${updated}, failed=${failed}, skipped=${skipped}`);

    return new Response(JSON.stringify({ 
      success: true,
      processed: results.length,
      updated,
      failed,
      skipped,
      details: results,
      message: `Successfully processed ${results.length} opportunities, updated ${updated}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error finding missing links:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
