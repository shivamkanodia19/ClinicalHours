/**
 * Script to find and update missing website/email links in the database
 * Run with: node scripts/update-missing-links.js
 * 
 * Requires environment variables:
 * - VITE_SUPABASE_URL or SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (for admin access)
 */

import https from 'https';
import http from 'http';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const EXCLUDED_DOMAINS = [
  'yelp.com', 'healthgrades.com', 'vitals.com', 'webmd.com', 'wikipedia.org',
  'facebook.com', 'linkedin.com', 'twitter.com', 'instagram.com',
  'yellowpages.com', 'whitepages.com', 'bbb.org', 'indeed.com', 'glassdoor.com',
  'google.com/maps', 'mapquest.com',
];

const REQUEST_DELAY_MS = 2500;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

function isExcludedDomain(url) {
  const domain = extractDomain(url);
  if (!domain) return true;
  return EXCLUDED_DOMAINS.some(excluded => domain.includes(excluded));
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

function emailDomainMatchesWebsite(email, website) {
  const emailDomain = email.split('@')[1]?.toLowerCase();
  const websiteDomain = extractDomain(website)?.toLowerCase();
  if (!emailDomain || !websiteDomain) return false;
  return emailDomain === websiteDomain || emailDomain.endsWith('.' + websiteDomain);
}

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        ...options.headers,
      },
      timeout: options.timeout || 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, status: res.statusCode, text: () => Promise.resolve(data) });
        } else {
          resolve({ ok: false, status: res.statusCode, text: () => Promise.resolve(data) });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function searchForWebsite(name, location) {
  try {
    const query = encodeURIComponent(`${name} ${location} official website`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${query}`;
    
    const response = await fetchUrl(searchUrl, {
      headers: {
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
          const testResponse = await fetchUrl(pattern, { method: 'HEAD', timeout: 5000 });
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
    console.error(`Error searching for website: ${error.message}`);
    return null;
  }
}

async function verifyWebsite(website, name) {
  try {
    const response = await fetchUrl(website, { method: 'HEAD', timeout: 10000 });
    if (!response.ok) return false;
    
    const domain = extractDomain(website);
    if (!domain) return false;
    
    const nameWords = name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const domainLower = domain.toLowerCase();
    const hasNameMatch = nameWords.some(word => domainLower.includes(word));
    
    return hasNameMatch;
  } catch (error) {
    console.error(`Error verifying website ${website}: ${error.message}`);
    return false;
  }
}

async function findEmailOnWebsite(website) {
  try {
    const response = await fetchUrl(website, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 10000,
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
    
    const foundEmails = new Set();
    
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
    console.error(`Error finding email on ${website}: ${error.message}`);
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processOpportunity(opp, supabase) {
  let websiteUpdated = false;
  let emailUpdated = false;
  let error;

  try {
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
      
      await sleep(REQUEST_DELAY_MS);
    } else {
      console.log(`\n[${opp.name}] Website already exists: ${opp.website}`);
    }
    
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
        
        await sleep(REQUEST_DELAY_MS);
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
    error = err.message || 'Unknown error';
    console.error(`  ❌ Error: ${error}`);
  }
  
  return { updated: websiteUpdated || emailUpdated, error };
}

async function main() {
  // Try to load environment variables
  dotenv.config();
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    console.error('Please set these environment variables or create a .env file');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const limit = 10; // Start with 10 to test
  
  console.log('🔍 Finding opportunities missing website or email...\n');
  
  const { data: opportunities, error: queryError } = await supabase
    .from('opportunities')
    .select('id, name, type, location, address, phone, website, email')
    .or('website.is.null,email.is.null')
    .limit(limit);
  
  if (queryError) {
    console.error('Database query error:', queryError);
    process.exit(1);
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
      await sleep(REQUEST_DELAY_MS);
    }
  }
  
  console.log(`\n\n📊 Summary:`);
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ⚠️  Skipped: ${skipped}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📝 Total: ${opportunities.length}`);
}

main().catch(console.error);

